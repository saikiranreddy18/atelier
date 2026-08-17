/**
 * YouCam API client — verified surface only (docs.makeupar.com, 2026-08-16).
 *
 * Auth:    plain `Authorization: Bearer <key>`. No handshake.
 * Upload:  POST /s2s/v2.0/file  -> presigned PUT -> file_id   (uploads cost 0 units)
 * Task:    POST /s2s/v2.0/task/<feature>  -> { data: { task_id } }
 * Poll:    GET  /s2s/v2.0/task/<feature>/<task_id> -> { data: { task_status, results } }
 *
 * Gotchas handled here:
 *  - task ids exceed 2^53 — we never JSON.parse them into numbers; we regex the
 *    raw body for "task_id" and keep it as a string.
 *  - result URLs expire in 2h — callers must download() anything they keep.
 *  - rate limit 250 req/300s — a global ~4 QPS throttle guards every call.
 */

import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");
const BASE = "https://yce-api-01.makeupar.com";
const LEDGER = join(ROOT, "credit-ledger.jsonl");

let KEY = process.env.YOUCAM_API_KEY;

export async function loadEnv() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  KEY = process.env.YOUCAM_API_KEY;
}

export function hasKey() { return Boolean(KEY); }

// ---- global throttle: stay well under 250 req / 300 s -----------------------
let last = 0;
async function throttle() {
  const gap = 260; // ~3.8 QPS
  const wait = last + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

export async function api(method, path, { body, headers = {}, raw = false } = {}) {
  await throttle();
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await fetch(url, {
    method,
    headers: {
      ...(path.startsWith("http") ? {} : { Authorization: `Bearer ${KEY}` }),
      ...(body && !raw ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, ok: res.ok, json, text };
}

/** Observed spend only. Never write an estimate here. */
export async function ledger(entry) {
  await appendFile(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

export async function creditBalance() {
  const r = await api("GET", "/s2s/v1.0/client/credit");
  const entries = r.json?.results ?? r.json?.result ?? [];
  const balance = Array.isArray(entries)
    ? entries.reduce((n, e) => n + Number(e.amount_dec ?? e.amount ?? 0), 0)
    : null;
  return { balance, entries };
}

/** Register + PUT bytes. Costs 0 units. Returns file_id. */
export async function uploadBytes(bytes, fileName, contentType) {
  const reg = await api("POST", "/s2s/v2.0/file", {
    body: { files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }] },
  });
  if (!reg.ok) throw new Error(`file register ${reg.status}: ${(reg.text || "").slice(0, 200)}`);
  const entry = reg.json?.data?.files?.[0];
  const req = entry?.requests?.[0];
  if (!req) throw new Error("no presigned request in file response");
  const put = await api(req.method ?? "PUT", req.url, {
    raw: true, body: bytes, headers: req.headers ?? { "Content-Type": contentType },
  });
  if (!put.ok) throw new Error(`presigned PUT ${put.status}`);
  return entry.file_id;
}

/** Extract task_id as a STRING from the raw body (ids exceed 2^53). */
function taskIdOf(r) {
  const m = (r.text || "").match(/"task_id"\s*:\s*"?([\w-]+)"?/);
  return m ? m[1] : null;
}

/**
 * Start a task and poll to completion.
 * Returns { taskId, resultUrl, raw } or throws with the API's error string.
 */
export async function runTask(feature, payload, { pollMs = 2000, maxPolls = 60 } = {}) {
  const start = await api("POST", `/s2s/v2.0/task/${feature}`, { body: payload });
  if (!start.ok) {
    const err = start.json?.error ?? start.json?.error_code ?? start.text?.slice(0, 200);
    throw new Error(`task/${feature} ${start.status}: ${err}`);
  }
  const taskId = taskIdOf(start);
  if (!taskId) throw new Error(`task/${feature}: no task_id in response`);

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollMs));
    const st = await api("GET", `/s2s/v2.0/task/${feature}/${taskId}`);
    const status = st.json?.data?.task_status;
    if (status === "success") {
      const results = st.json?.data?.results ?? {};
      const resultUrl = results.url ?? results.output?.[0]?.url ?? null;
      return { taskId, resultUrl, raw: st.json };
    }
    if (status === "error" || status === "failed") {
      throw new Error(`task/${feature}: ${st.json?.data?.error ?? "task failed"}`);
    }
  }
  throw new Error(`task/${feature}: timed out after ${(pollMs * maxPolls) / 1000}s`);
}

export async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function ensureDir(p) { await mkdir(p, { recursive: true }); }
export async function saveJson(p, obj) { await ensureDir(dirname(p)); await writeFile(p, JSON.stringify(obj, null, 2)); }
