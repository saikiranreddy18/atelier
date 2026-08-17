/**
 * Pass B — one AI swatch image per catalog entry, driven by that entry's own
 * texture_prompt. Run after tools/seed-catalog.mjs.
 *
 *   node tools/seed-swatches.mjs             # generate everything still missing
 *   node tools/seed-swatches.mjs --limit 1   # try a single one first
 *   node tools/seed-swatches.mjs --only velvet,kanchipuram
 *
 * Resumable by design: an entry whose file already exists on disk is skipped,
 * so an interrupted run costs nothing to continue. 1 unit per generated swatch.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEnv, hasKey, runTask, download, ensureDir, ledger, creditBalance } from "../server/youcam.mjs";

const OUT = join(ROOT, "public", "swatches");
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const LIMIT = Number(flag("--limit", Infinity));
const ONLY = flag("--only", "")?.split(",").filter(Boolean);
const CONCURRENCY = Number(flag("--concurrency", 3));

await loadEnv();
if (!hasKey()) { console.error("YOUCAM_API_KEY missing in .env.local"); process.exit(1); }
await ensureDir(OUT);

const { materials } = JSON.parse(await readFile(join(ROOT, "catalog.json"), "utf8"));
const todo = materials
  .filter(m => (!ONLY.length || ONLY.includes(m.id)) && !existsSync(join(OUT, `${m.id}.jpg`)))
  .slice(0, LIMIT);

console.log(`${materials.length} in catalog · ${todo.length} to generate · ~${todo.length} units`);
if (!todo.length) process.exit(0);

const NEG = "text, watermark, logo, person, hands, mannequin, garment, seam, fold, wrinkle, shadow, border, frame, collage";
let done = 0, spent = 0, failed = [];

async function one(m) {
  try {
    const r = await runTask("text-to-image/youcam", {
      model: "youcam-image-v2",
      prompt: m.texture_prompt,
      negative_prompt: NEG,
      size: "1328*1328", // the only square the engine accepts — swatches must tile
      prompt_extend: false, // the texture_prompt is already precise; let it stand
    });
    const bytes = await download(r.resultUrl); // result URLs expire in 2h
    await writeFile(join(OUT, `${m.id}.jpg`), bytes);
    spent += 1;
    await ledger({ at: new Date().toISOString(), feature: "text-to-image/youcam", taskId: r.taskId, key: `swatch:${m.id}`, observedDelta: 1, ok: true });
    console.log(`  [${++done}/${todo.length}] ${m.id}`);
  } catch (err) {
    failed.push([m.id, String(err.message || err)]);
    console.log(`  [${++done}/${todo.length}] ${m.id} — FAILED: ${err.message || err}`);
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
  while (queue.length) await one(queue.shift());
}));

const bal = await creditBalance().then(r => r.balance).catch(() => null);
console.log(`\ngenerated ${spent} swatches · ${failed.length} failed · balance ${bal ?? "?"}u`);
if (failed.length) console.log(failed.map(([id, e]) => `  ${id}: ${e}`).join("\n"));
