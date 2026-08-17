/**
 * Atelier — AI custom garment design studio (MVP cut).
 * Zero-dependency Node server, port 4141.
 *
 *   GET  /                -> public/index.html (the whole app)
 *   GET  /api/credits     -> { balance } live YouCam balance
 *   POST /api/brief       -> { spec } structured design spec from a plain-language brief.
 *                            Uses ANTHROPIC_API_KEY if present in .env.local, else an
 *                            honest on-device rule parser (labeled in the response).
 *   POST /api/tryon       -> { url, units, cached } — cloth-v4 drape of the composed
 *                            garment PNG (rasterized client-side from the SVG canvas)
 *                            onto the customer photo. Cached by content hash.
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import {
  ROOT, loadEnv, hasKey, uploadBytes, runTask, download,
  creditBalance, ledger, ensureDir,
} from "./youcam.mjs";

const PUB = join(ROOT, "public");
const RENDERS = join(PUB, "renders");
const CACHE_PATH = join(ROOT, "server", "cache.json");
const PORT = 4141;
const sha = (s) => createHash("sha256").update(s).digest("hex");

let cache = {};
try { cache = JSON.parse(await readFile(CACHE_PATH, "utf8")); } catch {}
const saveCache = () => writeFile(CACHE_PATH, JSON.stringify(cache, null, 2)).catch(() => {});

await loadEnv();

/* ---------------- brief parser ---------------- */
const GARMENTS = [
  ["lehenga", /lehenga|lahenga|ghagra/i], ["saree blouse", /blouse/i],
  ["saree", /saree|sari/i], ["sherwani", /sherwani|bandhgala|achkan/i],
  ["kurta", /kurta|kurti/i], ["anarkali", /anarkali/i], ["gown", /gown/i],
];
const FABRICS = [
  ["silk", /\bsilk\b|pattu/i], ["velvet", /velvet/i], ["georgette", /georgette/i],
  ["organza", /organza/i], ["chanderi", /chanderi/i], ["cotton", /cotton/i],
  ["khadi", /khadi/i], ["brocade", /brocade|banarasi/i], ["chiffon", /chiffon/i],
];
const COLOURS = [
  ["wine red", /wine|maroon|burgundy/i], ["red", /\bred\b|scarlet/i],
  ["rani pink", /rani|pink|magenta/i], ["emerald", /emerald|green/i],
  ["royal blue", /royal blue|\bblue\b/i], ["indigo", /indigo/i],
  ["ivory", /ivory|cream|off.?white|white/i], ["gold", /\bgold(en)?\b/i],
  ["mustard", /mustard|yellow|haldi/i], ["teal", /teal|peacock/i], ["black", /black/i],
];
const OCCASIONS = [
  ["wedding", /wedding|shaadi|marriage|bridal|pelli/i], ["reception", /reception/i],
  ["sangeet", /sangeet|mehendi|haldi/i], ["festive", /festival|diwali|pongal|eid|festive/i],
  ["party", /party|cocktail/i], ["daily wear", /daily|casual|office/i],
];
const EMB = [
  ["zari", /zari|zardozi/i], ["mirror work", /mirror|sheesha/i],
  ["chikankari", /chikan/i], ["sequins", /sequin/i], ["kundan", /kundan/i],
  ["pearls", /pearl|moti/i], ["gota patti", /gota/i], ["resham", /resham|thread ?work/i],
];
const pick = (table, text) => table.find(([, re]) => re.test(text))?.[0] || null;
const pickAll = (table, text) => table.filter(([, re]) => re.test(text)).map(([n]) => n);

function parseBrief(text) {
  const season = /december|january|winter/i.test(text) ? "winter"
    : /summer|april|may|june/i.test(text) ? "summer" : null;
  const weight = /heavy|grand|bridal/i.test(text) ? "heavy"
    : /light|simple|minimal|breath/i.test(text) ? "light" : "medium";
  return {
    garment: pick(GARMENTS, text) || "lehenga",
    primaryColour: pick(COLOURS, text) || "wine red",
    fabricHints: pickAll(FABRICS, text),
    occasion: pick(OCCASIONS, text),
    season,
    embellishments: pickAll(EMB, text),
    weight,
    notes: text.trim().slice(0, 300),
  };
}

async function briefWithClaude(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5", max_tokens: 500,
      messages: [{ role: "user", content:
        `Parse this garment brief into JSON with keys garment, primaryColour, fabricHints[], occasion, season, embellishments[], weight (light|medium|heavy), notes. JSON only, no prose.\nBrief: ${text}` }],
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  try { return JSON.parse(j.content[0].text.replace(/^```json?|```$/g, "").trim()); }
  catch { return null; }
}

/* ---------------- http ---------------- */
const MIME = { ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css", ".js": "text/javascript" };
const readBody = (req) => new Promise((ok, no) => {
  let chunks = []; let n = 0;
  req.on("data", (c) => { n += c.length; if (n > 25e6) { no(new Error("body too large")); req.destroy(); } chunks.push(c); });
  req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
  req.on("error", no);
});
const sendJson = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && url.pathname === "/api/credits") {
      try { return sendJson(res, 200, { balance: (await creditBalance()).balance }); }
      catch { return sendJson(res, 200, { balance: null }); }
    }

    if (req.method === "GET" && url.pathname === "/api/catalog") {
      const cat = JSON.parse(await readFile(join(ROOT, "catalog.json"), "utf8"));
      // tell the client which swatches Pass B has actually produced
      for (const m of cat.materials) {
        m.swatch = existsSync(join(PUB, "swatches", `${m.id}.jpg`)) ? `/swatches/${m.id}.jpg` : null;
        m.thumb = existsSync(join(PUB, "thumbs", `${m.id}.jpg`)) ? `/thumbs/${m.id}.jpg` : m.swatch;
      }
      return sendJson(res, 200, cat);
    }

    if (req.method === "POST" && url.pathname === "/api/brief") {
      const { text } = JSON.parse(await readBody(req));
      if (!text?.trim()) return sendJson(res, 400, { error: "empty brief" });
      const viaClaude = await briefWithClaude(text).catch(() => null);
      return sendJson(res, 200, {
        spec: viaClaude || parseBrief(text),
        parser: viaClaude ? "claude" : "on-device rules",
      });
    }

    if (req.method === "POST" && url.pathname === "/api/_snapshot") { // local QA only
      const { png, name } = JSON.parse(await readBody(req));
      const safe = String(name || "qa").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "qa";
      await ensureDir(RENDERS);
      await writeFile(join(RENDERS, `_${safe}.png`), Buffer.from(String(png).replace(/^data:image\/png;base64,/, ""), "base64"));
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/tryon") {
      if (!hasKey()) return sendJson(res, 500, { error: "YOUCAM_API_KEY missing in .env.local" });
      const body = JSON.parse(await readBody(req));
      const g64 = String(body.garmentBase64 || "").replace(/^data:image\/\w+;base64,/, "");
      const p64 = String(body.personBase64 || "").replace(/^data:image\/\w+;base64,/, "");
      if (!g64 || !p64) return sendJson(res, 400, { error: "garmentBase64 and personBase64 required" });
      const category = ["upper_body", "lower_body", "full_body"].includes(body.category) ? body.category : "full_body";

      const key = sha(`vto|${sha(g64)}|${sha(p64)}|${category}`);
      const hit = cache[key];
      if (hit?.ok && existsSync(join(RENDERS, hit.file)))
        return sendJson(res, 200, { url: "/renders/" + hit.file, units: 0, cached: true });
      if (hit && !hit.ok)
        return sendJson(res, 422, { error: `This exact combination failed before (${hit.error}). Change the garment or photo — retrying a known failure would still spend units.` });

      try {
        const before = await creditBalance().then(r => r.balance).catch(() => null);
        const refId = await uploadBytes(Buffer.from(g64, "base64"), "garment.png", "image/png");
        const srcId = await uploadBytes(Buffer.from(p64, "base64"), "person.jpg", "image/jpeg");
        const r = await runTask("cloth-v4", { src_file_id: srcId, ref_file_id: refId, garment_category: category });
        const after = await creditBalance().then(r => r.balance).catch(() => null);
        const units = (before != null && after != null) ? before - after : 2;
        await ledger({ at: new Date().toISOString(), feature: "cloth-v4", taskId: r.taskId, key: key.slice(0, 12), observedDelta: units, balanceAfter: after, ok: true });
        const bytes = await download(r.resultUrl); // result URLs die in 2h
        await ensureDir(RENDERS);
        const file = `t-${key.slice(0, 12)}.jpg`;
        await writeFile(join(RENDERS, file), bytes);
        cache[key] = { ok: true, file, taskId: r.taskId, at: new Date().toISOString() };
        await saveCache();
        return sendJson(res, 200, { url: "/renders/" + file, units, cached: false });
      } catch (err) {
        cache[key] = { ok: false, error: String(err.message || err), at: new Date().toISOString() };
        await saveCache();
        return sendJson(res, 502, { error: String(err.message || err) });
      }
    }

    // static
    let p = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = join(PUB, decodeURIComponent(p));
    if (!file.startsWith(PUB) || !existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    return res.end(await readFile(file));
  } catch (err) {
    return sendJson(res, 500, { error: String(err.message || err) });
  }
}).listen(PORT, () => console.log(`Atelier on http://localhost:${PORT} — YouCam key ${hasKey() ? "loaded" : "MISSING"}`));
