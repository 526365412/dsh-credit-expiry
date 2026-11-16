/**
 * dsh-credit-expiry - host half.
 *
 * One same-origin endpoint feeding both surfaces of the panel:
 *   - the compact row in the left sidebar footer,
 *   - the full page opened from that row.
 *
 *   GET /credit-expiry/api/data
 *     -> { updatedAt, errors: [], wb, tr, mm, qd, usage }
 *
 * Two independent things are reported, and they are NOT derived from each other:
 *
 *   1. Credits. How many credits a pool burned is the platform's own number
 *      (Trae reports consumed, WorkBuddy/Qoder expose pack size minus remain).
 *      Nothing local can reproduce it, and the old 'CNY / 0.15' division was
 *      wrong the moment cache reads entered the picture. So a pool total is the
 *      platform's number and the per-day / per-session split is that total
 *      apportioned by each entry's share of list price.
 *
 *   2. Money. The CNY figure is what those tokens would cost at official list
 *      price, computed per entry from the actual input / cache-read / output
 *      split. Prices are fetched live from OpenRouter's model catalogue (which
 *      publishes prompt, completion and cache-read prices for every model these
 *      pools serve), cached for an hour and persisted, so the panel still
 *      renders offline.
 *
 * Usage is scoped to the credit pools only: DeepSeek direct and the CLI proxies
 * are cash spend and would otherwise dominate a panel about expiring credits.
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const name = 'dsh-credit-expiry';

/** Array form only: this Cordis reads an object's KEYS as service names. */
export const inject = ['webServer'];

const PREFIX = '/credit-expiry/api';
const ROUTES = {
  wb: '/plugins/dsh-connect-workbuddy/usage',
  tr: '/plugins/dsh-connect-trae/usage',
  mm: '/plugins/dsh-connect-minimaxcode/status',
  qd: '/plugins/dsh-connect-qoder/usage'
};
const TIMEOUT_MS = 8000;
const DAILY_WINDOW = 14;
const SESSION_LIMIT = 24;

/** Only the pools this panel tracks. Everything else is cash, not credits. */
const CREDIT_PROVIDERS = ['workbuddy', 'trae', 'minimaxcode', 'qoder'];
const CREDIT_PROVIDER_SET = new Set(CREDIT_PROVIDERS);

/** provider id -> the short pool id the panel paints with. */
const PROVIDER_POOL = { workbuddy: 'wb', trae: 'tr', minimaxcode: 'mm', qoder: 'qd' };

/* ------------------------------------------------------------------ *
 * Prices - the vendors' own list price, in CNY per million tokens
 * ------------------------------------------------------------------ */

/**
 * Official vendor pages. OpenRouter was the wrong source: it lists glm-5.3 at
 * roughly 0.47 / 9.3 CNY per million while Zhipu's own domestic page says
 * 8 / 28, so mixing the two made one pool look fine and the next one an order
 * of magnitude off. These three pages are the vendors' own numbers and each is
 * parsed below.
 */
const PRICE_SOURCES = {
  deepseek: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing.md',
  zhipu: 'https://docs.bigmodel.cn/cn/guide/start/pricing.md',
  minimax: 'https://platform.minimaxi.com/document/price'
};

const PRICE_TTL_MS = 6 * 60 * 60 * 1000;
const PRICE_TIMEOUT_MS = 8000;

function flat(vendor, input, cached, output) {
  const rate = { input, cached, output };
  return { vendor, offPeak: rate, peak: rate };
}

function split(vendor, offPeak, peak) {
  return { vendor, offPeak, peak };
}

/**
 * Bundled snapshot, captured from the three pages above on 2026-11-16. Used only
 * before the first successful parse (cold install, offline) and flagged as such
 * in the UI; a live parse always wins.
 */
const FALLBACK_PRICES = {
  'deepseek-flash': split('deepseek', { input: 1, cached: 0.02, output: 4 }, { input: 2, cached: 0.04, output: 8 }),
  'deepseek-v4.1-flash': split('deepseek', { input: 1, cached: 0.02, output: 4 }, { input: 2, cached: 0.04, output: 8 }),
  'deepseek-v4-pro': split('deepseek', { input: 4.5, cached: 0.15, output: 13.5 }, { input: 9, cached: 0.30, output: 27 }),
  'glm-5.3': flat('zhipu', 8, 2, 28),
  'glm-5.3-flash': flat('zhipu', 0.8, 0.23, 2.8),
  'glm-5.3-flashx': flat('zhipu', 2, 0.57, 7),
  'minimax-m3.1-flash': flat('minimax', 1, 0.1, 4),
  'minimax-m3': flat('minimax', 4.2, 0.84, 16.8)
};

/** Ledger ids that are the same model under an older name. */
const MODEL_ALIAS = {
  'deepseek-v4.1-flash': 'deepseek-flash',
  'deepseek-v4.1-flash-1017': 'deepseek-flash',
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-v4-pro-official': 'deepseek-v4-pro',
  'glm-5.3-flashx-legal': 'glm-5.3-flashx'
};

/**
 * Bumped whenever the stored table changes shape or currency. A cache written by
 * a different version is thrown away instead of being merged: the first build
 * stored USD numbers under model ids this build now resolves, and merging those
 * would quietly price CNY calls at a fraction of their real rate.
 */
const PRICE_CACHE_SCHEMA = 2;

/**
 * DeepSeek's peak window, taken from the same pricing page: Beijing time,
 * Monday to Friday, 09:00-12:00 and 14:00-18:00, and a Chinese statutory
 * holiday is off peak for the whole day. Everything else is idle, which the
 * page prices at exactly half. Only DeepSeek bills this way; the other vendors
 * hand back one rate for both slots.
 */
const DEEPSEEK_PEAK_WINDOWS = [[9, 12], [14, 18]];
const BJ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Chinese statutory holidays the panel knows without asking anyone. */
const BUNDLED_HOLIDAYS = [
  '2026-01-01',
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'
];

function holidaySet(extra) {
  const set = new Set(BUNDLED_HOLIDAYS);
  if (Array.isArray(extra)) {
    for (const day of extra) if (typeof day === 'string' && day) set.add(day);
  }
  return set;
}

/** True when a call made at the given millisecond stamp bills at DeepSeek's peak rate. */
function isPeak(ms, holidays) {
  if (!(ms > 0)) return false;
  const local = new Date(ms + BJ_OFFSET_MS);
  const dow = local.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (holidays && holidays.has(local.toISOString().slice(0, 10))) return false;
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  for (const window of DEEPSEEK_PEAK_WINDOWS) {
    if (hour >= window[0] && hour < window[1]) return true;
  }
  return false;
}

function homeDir() {
  const env = process.env.DSH_HOME;
  return env && env.trim() ? env.trim() : join(homedir(), '.dsh');
}

function priceStatePath() {
  return join(homeDir(), 'storages', 'credit-expiry', 'prices.json');
}

/** Latest good table; survives restarts and renders while offline. */
let priceMemo = null;

/**
 * A table written by an older version stored one flat USD rate per model. Wrap
 * such a row into the off-peak / peak shape so a stale cache cannot crash a
 * render - the next successful fetch replaces it anyway.
 */
function normalizeTable(table) {
  const out = {};
  for (const [id, row] of Object.entries(table || {})) {
    if (!row || typeof row !== 'object') continue;
    if (row.offPeak && row.peak) {
      out[id] = row;
    } else if (typeof row.input === 'number' && typeof row.output === 'number') {
      out[id] = flat(row.vendor || 'unknown', row.input, typeof row.cached === 'number' ? row.cached : row.input, row.output);
    }
  }
  return out;
}

async function loadPriceState() {
  try {
    const parsed = JSON.parse(await readFile(priceStatePath(), 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.table && parsed.schema === PRICE_CACHE_SCHEMA) {
      return { fetchedAt: parsed.fetchedAt || 0, table: normalizeTable(parsed.table), source: parsed.source, vendors: parsed.vendors };
    }
  } catch {
    /* first run, or the file was never written */
  }
  return null;
}

async function savePriceState(state) {
  try {
    await mkdir(join(homeDir(), 'storages', 'credit-expiry'), { recursive: true });
    await writeFile(priceStatePath(), JSON.stringify(state), 'utf8');
  } catch {
    /* a read-only home only costs a refetch on the next start */
  }
}

async function timedFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRICE_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: { accept: 'text/plain,text/html,*/*' } });
  } finally {
    clearTimeout(timer);
  }
}

function cellNumber(text) {
  const n = Number(String(text).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function cellsOf(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

/**
 * DeepSeek publishes one row per (token kind, time slot) with the models as
 * columns, so the model names come out of the header row and the values out of
 * the row body.
 */
function parseDeepseek(markdown) {
  const rows = markdown.split('\n').filter((line) => line.trim().startsWith('|')).map(cellsOf);
  const header = rows.find((cells) => cells.length >= 5 && cells.some((cell) => /^deepseek-flash/.test(cell)));
  if (!header) throw new Error('no model header');
  const names = header.slice(3).map((cell) => cell.replace(/\(\d+\)$/, '').trim().toLowerCase()).filter(Boolean);
  const pick = (labelTest, slotTest) => {
    const row = rows.find((cells) => cells.length >= 5 && labelTest(cells[1] || '') && slotTest(cells[2] || ''));
    return row ? names.map((unused, index) => cellNumber(row[3 + index])) : null;
  };
  const hitOff = pick((t) => /缓存命中/.test(t) && !/未命中/.test(t), (s) => s.includes('空闲'));
  const hitPeak = pick((t) => /缓存命中/.test(t) && !/未命中/.test(t), (s) => s.includes('高峰'));
  const missOff = pick((t) => /未命中/.test(t), (s) => s.includes('空闲'));
  const missPeak = pick((t) => /未命中/.test(t), (s) => s.includes('高峰'));
  const outOff = pick((t) => /输出/.test(t), (s) => s.includes('空闲'));
  const outPeak = pick((t) => /输出/.test(t), (s) => s.includes('高峰'));
  if (!hitOff || !missOff || !outOff) throw new Error('no price rows');
  const table = {};
  names.forEach((name, index) => {
    const cached = hitOff[index];
    const input = missOff[index];
    const output = outOff[index];
    if (cached === null || input === null || output === null) return;
    table[name] = split(
      'deepseek',
      { input, cached, output },
      {
        input: missPeak && missPeak[index] !== null ? missPeak[index] : input * 2,
        cached: hitPeak && hitPeak[index] !== null ? hitPeak[index] : cached * 2,
        output: outPeak && outPeak[index] !== null ? outPeak[index] : output * 2
      }
    );
  });
  return table;
}

/** Zhipu: one row per model, columns are context / input / output / cache-store / cache-hit. */
function parseZhipu(markdown) {
  const table = {};
  for (const line of markdown.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = cellsOf(line);
    if (cells.length < 6) continue;
    const name = cells[0].toLowerCase();
    if (!/^glm-[\d.]+/.test(name)) continue;
    if (!/^[\d.]+\s*(k|m)$/i.test(cells[1] || '')) continue;
    const input = cellNumber(cells[2]);
    const output = cellNumber(cells[3]);
    const cached = cellNumber(cells[5]);
    if (input === null || output === null) continue;
    table[name] = flat('zhipu', input, cached === null ? input : cached, output);
  }
  return table;
}

/**
 * MiniMax serves the same price table as HTML and, depending on the accept
 * header, as markdown; either way a row reads 'MiniMax-M3.1-Flash | 1.00 | 4.00
 * | 0.10' with emphasis and pipes around the cells. Strip the markup, then read
 * the row order input / output / cache-read.
 */
function parseMinimax(body) {
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/[|*_`]/g, ' ')
    .replace(/\s+/g, ' ');
  const table = {};
  const pattern = /(MiniMax-M[\d.]+(?:-[A-Za-z]+)?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const name = match[1].toLowerCase();
    if (table[name]) continue;
    const input = Number(match[2]);
    const output = Number(match[3]);
    const cached = Number(match[4]);
    if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
    table[name] = flat('minimax', input, Number.isFinite(cached) ? cached : input, output);
  }
  return table;
}

async function fetchPrices() {
  const jobs = [
    ['deepseek', PRICE_SOURCES.deepseek, parseDeepseek],
    ['zhipu', PRICE_SOURCES.zhipu, parseZhipu],
    ['minimax', PRICE_SOURCES.minimax, parseMinimax]
  ];
  const results = await Promise.all(jobs.map(async (job) => {
    try {
      const response = await timedFetch(job[1]);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const parsed = job[2](await response.text());
      if (!Object.keys(parsed).length) throw new Error('parsed no model prices');
      return { vendor: job[0], parsed };
    } catch (error) {
      return { vendor: job[0], error: String((error && error.message) || error) };
    }
  }));
  const table = {};
  const errors = [];
  const vendors = [];
  for (const result of results) {
    if (result.error) {
      errors.push(result.vendor + ': ' + result.error);
      continue;
    }
    vendors.push(result.vendor);
    Object.assign(table, result.parsed);
  }
  return { table, errors, vendors };
}

/**
 * Resolve the live price table and where it came from. One network round trip
 * every six hours; a vendor that fails keeps the last numbers it published
 * instead of dropping to zero.
 */
async function priceState() {
  const now = Date.now();
  if (priceMemo && now - priceMemo.fetchedAt < PRICE_TTL_MS) return priceMemo;
  const disk = priceMemo || (await loadPriceState());
  const live = await fetchPrices();
  /* Only a table this version wrote is worth merging. A cache from the older
     OpenRouter-format build holds USD numbers under the same model ids, and
     merging those would price CNY calls at a sixth of their real rate. */
  const previous = normalizeTable(disk && disk.table);
  /* Bundled snapshot at the bottom, then the last good parse, then this run's
     parse on top: a vendor that failed keeps its last published numbers. */
  const table = Object.assign({}, FALLBACK_PRICES, previous, live.table);
  const anyLive = live.vendors.length > 0;
  const state = {
    fetchedAt: anyLive ? now : ((disk && disk.fetchedAt) || 0),
    table: table,
    source: anyLive ? 'official' : ((disk && disk.source) || 'bundled'),
    live: live.vendors.length === 3,
    vendors: live.vendors,
    errors: live.errors
  };
  priceMemo = state;
  if (anyLive) {
    await savePriceState({
      schema: PRICE_CACHE_SCHEMA,
      fetchedAt: state.fetchedAt,
      table: Object.assign({}, previous, live.table),
      source: state.source,
      vendors: live.vendors
    });
  }
  return state;
}

function lookupPrice(table, model) {
  const key = String(model || '').toLowerCase();
  const source = table || FALLBACK_PRICES;
  /* Alias first: 'deepseek-v4.1-flash' must resolve to the official
     'deepseek-flash' row, not to a stale cache entry left over from an older
     price source that stored the same id with different numbers. */
  const alias = MODEL_ALIAS[key];
  return (alias && source[alias]) || source[key] || null;
}

/** Cost of one token split at one rate slot, in CNY. A cache write bills as a cache miss. */
function tierCost(tokens, rate) {
  const cached = typeof rate.cached === 'number' ? rate.cached : rate.input;
  return ((tokens.input || 0) / 1e6) * rate.input
    + ((tokens.cacheRead || 0) / 1e6) * cached
    + ((tokens.cacheWrite || 0) / 1e6) * rate.input
    + ((tokens.output || 0) / 1e6) * rate.output;
}

/**
 * The peak argument is true or false for a call with a known timestamp, and null
 * for a day total whose calls could not be placed in time - those are blended by
 * that day's own peak share, because cost is linear in tokens.
 */
function priceBlend(tokens, price, peak, share) {
  if (peak === true) return tierCost(tokens, price.peak);
  if (peak === false) return tierCost(tokens, price.offPeak);
  const p = typeof share === 'number' && isFinite(share) ? Math.min(1, Math.max(0, share)) : 0;
  if (p === 0) return tierCost(tokens, price.offPeak);
  return p * tierCost(tokens, price.peak) + (1 - p) * tierCost(tokens, price.offPeak);
}
/* ------------------------------------------------------------------ *
 * Ledger
 * ------------------------------------------------------------------ */

function ledgerCandidates() {
  const home = process.env.DSH_HOME;
  const list = [];
  if (home) list.push(join(home, 'storages', 'cost-meter', 'ledger.json'));
  list.push(join(homedir(), '.dsh', 'storages', 'cost-meter', 'ledger.json'));
  return list;
}

/** mtime-keyed cache: the ledger is ~1.4 MB of single-line JSON. */
let ledgerCache = { path: null, stamp: '', value: null };

async function readLedger() {
  for (const path of ledgerCandidates()) {
    let info;
    try {
      info = await stat(path);
    } catch {
      continue;
    }
    const stamp = info.ino + ':' + info.mtimeMs + ':' + info.size;
    if (ledgerCache.path === path && ledgerCache.stamp === stamp) return ledgerCache.value;
    try {
      const raw = await readFile(path, 'utf8');
      const value = JSON.parse(raw);
      ledgerCache = { path, stamp, value };
      return value;
    } catch {
      return null;
    }
  }
  return null;
}

function tokensOf(entry) {
  return (entry.input || 0) + (entry.output || 0) + (entry.cacheRead || 0) + (entry.cacheWrite || 0);
}

function splitKey(key) {
  const cut = key.indexOf(':');
  return cut < 0 ? { provider: key, model: '' } : { provider: key.slice(0, cut), model: key.slice(cut + 1) };
}

/**
 * Which models a pool charges nothing for. The connect plugins publish
 * creditMultiplier per model and 0 means free exactly; an absent multiplier is
 * unknown, not free.
 */
function collectMultipliers(payloads) {
  const map = {};
  for (const payload of payloads) {
    const models = payload && Array.isArray(payload.models) ? payload.models : [];
    for (const model of models) {
      if (!model || typeof model.id !== 'string') continue;
      if (typeof model.creditMultiplier !== 'number') continue;
      map[model.id.toLowerCase()] = model.creditMultiplier;
    }
  }
  return map;
}

/**
 * One pool's credit rate: the platform's own consumed credits divided by what
 * those same calls cost at list price. That division is what makes the panel
 * agree with the platform, because it never re-derives the credits themselves.
 * A pool that reports no number falls back to the old constant and says so.
 */
function poolRate(costCny, consumed) {
  const known = Number.isFinite(consumed) && consumed > 0;
  if (known && costCny > 0) {
    return { credits: consumed, rate: consumed / costCny, estimated: false };
  }
  /* The platform spent credits on calls we cannot price (an unpublished model):
     its number still wins, only the per-entry split has to stay empty. */
  if (known) return { credits: consumed, rate: null, estimated: false };
  /* No platform number at all: report no credits rather than inventing them from
     a magic rate. The money column still stands on its own. */
  return { credits: 0, rate: null, estimated: true };
}

function addRaw(target, raw) {
  target.input = (target.input || 0) + (raw.input || 0);
  target.output = (target.output || 0) + (raw.output || 0);
  target.cacheRead = (target.cacheRead || 0) + (raw.cacheRead || 0);
  target.cacheWrite = (target.cacheWrite || 0) + (raw.cacheWrite || 0);
  target.calls = (target.calls || 0) + (raw.calls || 0);
  return target;
}

/**
 * What a day reports beyond the sessions already counted. The ledger normally
 * leaves a small tail behind (calls that never got attached to a session), and
 * that tail must still be priced instead of silently vanishing.
 */
function subtractRaw(total, seen) {
  const rest = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };
  for (const field of ['input', 'output', 'cacheRead', 'cacheWrite', 'calls']) {
    const whole = Number(total[field]) || 0;
    const part = seen ? (Number(seen[field]) || 0) : 0;
    rest[field] = Math.max(0, whole - part);
  }
  return rest;
}

/**
 * Usage, priced the way the vendors price it.
 *
 * Tokens come straight out of the ledger, split into input / cache-read /
 * cache-write / output, and each part pays its own official rate - that is the
 * cache discount the old flat rate threw away. DeepSeek's peak and idle slots
 * differ by exactly 2x, so every session is placed in time by its own 'at'
 * stamp; a day total no session accounts for is blended by that day's own peak
 * share instead of being guessed.
 *
 * Credits stay the platform's number: consumed is read from the platform and the
 * per-entry split is that total weighted by list price, so the panel agrees with
 * the platform even though the money column is a list-price estimate.
 */
export function summarizeUsage(ledger, options) {
  if (!ledger || !ledger.days || typeof ledger.days !== 'object') return null;
  const opts = options || {};
  const prices = opts.prices || { table: FALLBACK_PRICES, live: false, source: 'bundled' };
  const multipliers = opts.multipliers || {};
  const consumedByPool = opts.consumed || {};
  const holidays = holidaySet(ledger.config && ledger.config.peakHolidays);

  const dates = Object.keys(ledger.days).sort();
  const atoms = [];
  const sessionRecords = [];
  const missing = {};
  const poolCost = { wb: 0, tr: 0, mm: 0, qd: 0 };
  let peakTokens = 0;
  let idleTokens = 0;

  function atomOf(date, key, raw, peak, share) {
    const parts = splitKey(key);
    const pool = PROVIDER_POOL[parts.provider];
    const free = multipliers[parts.model.toLowerCase()] === 0;
    const price = lookupPrice(prices.table, parts.model);
    const tokens = tokensOf(raw);
    let costCny = 0;
    if (price && !free) costCny = priceBlend(raw, price, peak, share);
    else if (!free && !price) missing[parts.model] = (missing[parts.model] || 0) + tokens;
    /* A free model moved real tokens but burns no credits, so it must stay out
       of the price pool the credit split is weighted by. */
    if (!free && costCny > 0) poolCost[pool] += costCny;
    const shareKnown = peak === null
      ? (typeof share === 'number' && isFinite(share) ? Math.min(1, Math.max(0, share)) : 0)
      : (peak ? 1 : 0);
    peakTokens += tokens * shareKnown;
    idleTokens += tokens * (1 - shareKnown);
    return {
      date: date,
      key: key,
      provider: parts.provider,
      model: parts.model,
      pool: pool,
      peak: peak,
      calls: raw.calls || 0,
      inputTokens: raw.input || 0,
      outputTokens: raw.output || 0,
      cacheReadTokens: raw.cacheRead || 0,
      cacheWriteTokens: raw.cacheWrite || 0,
      tokens: tokens,
      peakShare: shareKnown,
      costCny: costCny,
      priced: !!price,
      free: free
    };
  }

  /* Pass 1: sessions first. They are the only records carrying a timestamp, so
     they are the only records that can be placed in a peak or idle slot. */
  for (const date of dates) {
    const day = ledger.days[date] || {};
    const byModel = day.byProviderModel && typeof day.byProviderModel === 'object' ? day.byProviderModel : {};
    const seen = {};
    const slots = {};
    const list = Array.isArray(day.sessions) ? day.sessions : [];
    for (const session of list) {
      const perModel = session.byProviderModel && typeof session.byProviderModel === 'object' ? session.byProviderModel : {};
      const peak = isPeak(session.at, holidays);
      const record = {
        id: session.id || '',
        at: session.at || 0,
        date: date,
        title: session.title || '',
        calls: 0,
        tokens: 0,
        costCny: 0,
        credits: 0,
        top: '',
        best: -1,
        peakCalls: peak ? 0 : 0,
        byPool: {}
      };
      for (const key of Object.keys(perModel)) {
        const parts = splitKey(key);
        if (!CREDIT_PROVIDER_SET.has(parts.provider)) continue;
        const raw = perModel[key] || {};
        const atom = atomOf(date, key, raw, peak, null);
        atoms.push(atom);
        addRaw(seen[key] || (seen[key] = {}), raw);
        const slot = slots[key] || (slots[key] = { peak: 0, idle: 0 });
        if (peak) slot.peak += atom.tokens;
        else slot.idle += atom.tokens;
        record.calls += atom.calls;
        record.tokens += atom.tokens;
        record.costCny += atom.costCny;
        if (peak) record.peakCalls += atom.calls;
        record.byPool[atom.pool] = (record.byPool[atom.pool] || 0) + atom.costCny;
        if (atom.costCny > record.best) {
          record.best = atom.costCny;
          record.top = key;
        }
      }
      if (record.calls) sessionRecords.push(record);
    }

    /* Anything the day reports on top of its sessions is blended by that day's
       own peak share: the cost is linear in tokens, so a share is exact. */
    for (const key of Object.keys(byModel)) {
      const parts = splitKey(key);
      if (!CREDIT_PROVIDER_SET.has(parts.provider)) continue;
      const rest = subtractRaw(byModel[key] || {}, seen[key]);
      if (!tokensOf(rest) && !rest.calls) continue;
      const slot = slots[key];
      const share = slot && slot.peak + slot.idle > 0 ? slot.peak / (slot.peak + slot.idle) : 0;
      atoms.push(atomOf(date, key, rest, null, share));
    }
  }

  /* Pass 2: calibrate each pool against the platform's own consumed number. */
  const pools = {};
  for (const pool of Object.values(PROVIDER_POOL)) {
    const consumed = consumedByPool[pool];
    const info = poolRate(poolCost[pool], consumed);
    pools[pool] = {
      credits: info.credits,
      costCny: poolCost[pool],
      rate: info.rate,
      estimated: info.estimated,
      consumed: Number.isFinite(consumed) ? consumed : null
    };
  }

  /**
   * Each entry's weight inside its pool, then every entry's credits are
   * poolCredits * weight / poolWeight. Weighting by list price is the accurate
   * split; when a pool has no priced call at all the tokens are the only thing
   * left to split by. Either way the entries add up to exactly the number the
   * platform reported - never to a re-derived one.
   */
  const poolWeight = { wb: 0, tr: 0, mm: 0, qd: 0 };
  for (const atom of atoms) {
    if (atom.free) continue;
    atom.weight = pools[atom.pool] && pools[atom.pool].rate > 0 ? atom.costCny : atom.tokens;
    if (atom.weight > 0) poolWeight[atom.pool] += atom.weight;
  }

  const creditsOf = (atom) => {
    if (atom.free || !(atom.weight > 0)) return 0;
    const pool = pools[atom.pool];
    const total = poolWeight[atom.pool];
    if (!pool || !(total > 0)) return 0;
    return pool.credits * (atom.weight / total);
  };

  /* Pass 3: roll the atoms up into days, providers and sessions. */
  const daily = dates.map((date) => ({
    date: date,
    calls: 0,
    tokens: 0,
    costCny: 0,
    credits: 0,
    peakTokens: 0,
    idleTokens: 0,
    byPool: {}
  }));
  const dailyByDate = new Map(daily.map((row) => [row.date, row]));
  const providers = new Map();

  for (const atom of atoms) {
    const credits = creditsOf(atom);
    const row = dailyByDate.get(atom.date);
    if (row) {
      row.calls += atom.calls;
      row.tokens += atom.tokens;
      row.costCny += atom.costCny;
      row.credits += credits;
      row.peakTokens += atom.tokens * atom.peakShare;
      row.idleTokens += atom.tokens * (1 - atom.peakShare);
      row.byPool[atom.pool] = (row.byPool[atom.pool] || 0) + credits;
    }
    let bucket = providers.get(atom.key);
    if (!bucket) {
      const known = lookupPrice(prices.table, atom.model);
      bucket = {
        key: atom.key,
        provider: atom.provider,
        model: atom.model,
        pool: atom.pool,
        vendor: known ? known.vendor : null,
        calls: 0,
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        costCny: 0,
        credits: 0,
        peakTokens: 0,
        idleTokens: 0,
        free: atom.free,
        priced: atom.priced,
        lastDate: atom.date
      };
      providers.set(atom.key, bucket);
    }
    bucket.calls += atom.calls;
    bucket.tokens += atom.tokens;
    bucket.inputTokens += atom.inputTokens;
    bucket.outputTokens += atom.outputTokens;
    bucket.cacheReadTokens += atom.cacheReadTokens;
    bucket.costCny += atom.costCny;
    bucket.credits += credits;
    bucket.peakTokens += atom.tokens * atom.peakShare;
    bucket.idleTokens += atom.tokens * (1 - atom.peakShare);
    bucket.lastDate = atom.date;
  }

  for (const record of sessionRecords) {
    let credits = 0;
    for (const pool of Object.keys(record.byPool)) {
      const poolInfo = pools[pool];
      if (poolInfo && poolInfo.rate > 0) credits += record.byPool[pool] * poolInfo.rate;
    }
    record.credits = credits;
    record.peak = record.peakCalls > 0;
    delete record.byPool;
    delete record.best;
    delete record.peakCalls;
  }
  sessionRecords.sort((a, b) => b.at - a.at);

  const totals = {
    calls: 0,
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    peakTokens: 0,
    idleTokens: 0,
    costCny: 0,
    credits: 0,
    days: dates.length,
    from: dates[0] || null,
    to: dates[dates.length - 1] || null
  };
  for (const row of daily) {
    totals.calls += row.calls;
    totals.tokens += row.tokens;
    totals.costCny += row.costCny;
    totals.credits += row.credits;
    totals.peakTokens += row.peakTokens;
    totals.idleTokens += row.idleTokens;
  }
  for (const atom of atoms) {
    totals.inputTokens += atom.inputTokens;
    totals.outputTokens += atom.outputTokens;
    totals.cacheReadTokens += atom.cacheReadTokens;
    totals.cacheWriteTokens += atom.cacheWriteTokens;
  }

  const providerList = Array.from(providers.values())
    .sort((a, b) => (b.credits - a.credits) || (b.tokens - a.tokens));

  return {
    scopedTo: CREDIT_PROVIDERS,
    totals: totals,
    daily: daily.slice(-DAILY_WINDOW),
    providers: providerList,
    sessions: sessionRecords.slice(0, SESSION_LIMIT),
    sessionCount: sessionRecords.length,
    pools: pools,
    pricing: {
      source: prices.source || 'bundled',
      live: !!prices.live,
      fetchedAt: prices.fetchedAt || 0,
      error: (prices.errors && prices.errors.length) ? prices.errors.join('; ') : null,
      missing: Object.keys(missing),
      vendors: prices.vendors || [],
      peak: {
        windows: DEEPSEEK_PEAK_WINDOWS,
        holidays: holidays.size,
        peakTokens: peakTokens,
        idleTokens: idleTokens
      }
    }
  };
}
function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * WorkBuddy has no lifetime 'consumed' field, but every package carries its
 * original size, so size minus remain is exactly what has been spent - including
 * packs that have already been drained to zero.
 */
function normalizeWorkbuddy(usage) {
  const credits = usage.credits || {};
  const packages = Array.isArray(credits.packages) ? credits.packages : [];
  const consumed = packages.reduce((sum, pack) => {
    const size = Number(pack && pack.size) || 0;
    const remain = Number(pack && pack.remain) || 0;
    return sum + Math.max(0, size - remain);
  }, 0);
  return {
    status: usage.status || null,
    accountName: usage.accountName || '',
    total: Number(credits.total) || 0,
    consumed: consumed,
    packages: packages.map((p) => ({
      name: p.packageName || '积分包',
      remain: Number(p.remain) || 0,
      size: Number(p.size) || 0,
      expiresAtMs: finiteOrNull(p.expiresAtMs),
      monthly: !!p.monthly
    })),
    checkin: usage.checkin ? {
      streakDays: usage.checkin.streakDays || 0,
      dailyCredit: usage.checkin.dailyCredit || 0,
      todayCheckedIn: !!usage.checkin.todayCheckedIn
    } : null
  };
}

/**
 * MiniMax Code reports a single balance plus an 'upcoming' expiry list, with no
 * per-package breakdown: every lot shares one expiry date, so the list is the
 * whole picture.
 */
function normalizeMinimax(usage) {
  const credits = usage.credits || {};
  const upcoming = Array.isArray(credits.upcoming) ? credits.upcoming : [];
  const lots = upcoming
    .filter((lot) => Number.isFinite(lot && lot.expireAtMs))
    .map((lot) => ({
      amount: Number(lot.amount) || 0,
      expiresAtMs: finiteOrNull(lot.expireAtMs)
    }));
  return {
    status: usage.state || usage.status || null,
    accountName: usage.accountName || '',
    total: Number(credits.total) || 0,
    consumed: Number(credits.consumed) || 0,
    lots: lots,
    expiresAtMs: finiteOrNull(credits.nextExpiryAtMs),
    checkin: usage.signin ? {
      todayPoints: (usage.signin.today && usage.signin.today.points) || 0,
      todayClaimed: !!(usage.signin.today && usage.signin.today.claimed),
      cyclePoints: usage.signin.cyclePoints || 0,
      autoCheckin: !!usage.signin.autoCheckin
    } : null
  };
}

/**
 * Qoder ships packages without their own expiry: the only date it knows is the
 * plan's, and that date is exactly what makes the credits disappear. So the plan
 * date is painted onto every package - one honest approximation instead of a
 * second 'no expiry' bucket that would read as forever.
 */
function normalizeQoder(usage) {
  const credits = usage.credits || {};
  const packages = Array.isArray(credits.packages) ? credits.packages : [];
  const planExpiry = finiteOrNull(credits.planExpiresAtMs);
  const consumed = packages.reduce((sum, pack) => {
    const size = Number(pack && pack.size) || 0;
    const remain = Number(pack && pack.remain) || 0;
    return sum + Math.max(0, size - remain);
  }, 0);
  return {
    status: usage.status || null,
    accountName: usage.accountName || '',
    total: Number(credits.total) || 0,
    consumed: consumed,
    packages: packages.map((p) => ({
      name: p.packageName === 'base' ? '基础积分' : (p.packageName === 'addon' ? '加油包积分' : (p.packageName || 'Qoder 积分')),
      remain: Number(p.remain) || 0,
      size: Number(p.size) || 0,
      expiresAtMs: planExpiry
    })),
    planExpiresAtMs: planExpiry,
    expiringSoon: Number(credits.expiringSoon) || 0
  };
}

function normalizeTrae(usage) {
  const credits = usage.credits || {};
  const accounts = Array.isArray(credits.accounts) ? credits.accounts : [];
  return {
    status: usage.status || null,
    accountName: usage.accountName || '',
    total: Number(credits.total) || 0,
    consumed: Number(credits.consumed) || 0,
    accounts: accounts.map((a) => ({
      desc: a.displayDesc || '积分账户',
      remain: Number(a.remain) || 0,
      size: Number(a.size) || 0,
      expiresAtMs: finiteOrNull(a.expiresAtMs)
    }))
  };
}

export function apply(ctx) {
  /**
   * Same-origin base for the internal fetch. The incoming request already tells us
   * the live host/port, so we never guess a port or cache one across restarts.
   */
  function origin(req) {
    const host = req && req.headers && req.headers.host;
    if (typeof host === 'string' && host) return 'http://' + host;
    const server = ctx.webServer;
    const port = server && typeof server.port === 'number' ? server.port : 0;
    if (!port) throw new Error('无法确定 DSH Web 端口：请求缺少 host 头，webServer.port 也不可用');
    return 'http://127.0.0.1:' + port;
  }

  async function readUsage(req, route, cookie) {
    const base = origin(req);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const headers = { accept: 'application/json' };
      if (cookie) headers.cookie = cookie;
      const response = await fetch(base + route, { headers: headers, signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const handler = async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://dsh.local');
      if (!url.pathname.startsWith(PREFIX)) {
        send(res, 404, { status: 'error', error: 'not found' });
        return;
      }
      if (url.pathname.slice(PREFIX.length) !== '/data') {
        send(res, 404, { status: 'error', error: 'not found' });
        return;
      }

      const cookie = req.headers.cookie;
      const payload = { updatedAt: Date.now(), errors: [], wb: null, tr: null, mm: null, qd: null, usage: null };
      const results = await Promise.allSettled([
        readUsage(req, ROUTES.wb, cookie),
        readUsage(req, ROUTES.tr, cookie),
        readUsage(req, ROUTES.mm, cookie),
        readUsage(req, ROUTES.qd, cookie),
        readLedger(),
        priceState()
      ]);
      const wbResult = results[0];
      const trResult = results[1];
      const mmResult = results[2];
      const qdResult = results[3];
      const usageResult = results[4];
      const priceResult = results[5];

      if (wbResult.status === 'fulfilled') {
        payload.wb = normalizeWorkbuddy(wbResult.value);
      } else {
        const reason = wbResult.reason;
        payload.errors.push('WorkBuddy: ' + String((reason && reason.message) || reason));
      }

      if (trResult.status === 'fulfilled') {
        payload.tr = normalizeTrae(trResult.value);
      } else {
        const reason = trResult.reason;
        payload.errors.push('Trae: ' + String((reason && reason.message) || reason));
      }

      if (mmResult.status === 'fulfilled') {
        payload.mm = normalizeMinimax(mmResult.value);
      } else {
        const reason = mmResult.reason;
        payload.errors.push('MiniMax: ' + String((reason && reason.message) || reason));
      }

      if (qdResult.status === 'fulfilled') {
        payload.qd = normalizeQoder(qdResult.value);
      } else {
        const reason = qdResult.reason;
        payload.errors.push('Qoder: ' + String((reason && reason.message) || reason));
      }

      const prices = priceResult.status === 'fulfilled' ? priceResult.value : null;
      if (priceResult.status !== 'fulfilled') {
        const reason = priceResult.reason;
        payload.errors.push('价格: ' + String((reason && reason.message) || reason));
      } else if (prices && prices.errors && prices.errors.length) {
        /* A vendor page that failed to parse only costs that vendor its freshest
           numbers - the cached table still renders, so this is a warning. */
        payload.errors.push('价格: ' + prices.errors.join('；'));
      }

      if (usageResult.status === 'fulfilled') {
        const multipliers = collectMultipliers([
          wbResult.status === 'fulfilled' ? wbResult.value : null,
          trResult.status === 'fulfilled' ? trResult.value : null
        ]);
        const consumed = {
          wb: payload.wb ? payload.wb.consumed : null,
          tr: payload.tr ? payload.tr.consumed : null,
          mm: payload.mm ? payload.mm.consumed : null,
          qd: payload.qd ? payload.qd.consumed : null
        };
        payload.usage = summarizeUsage(usageResult.value, {
          prices: prices,
          multipliers: multipliers,
          consumed: consumed
        });
        if (!payload.usage) {
          payload.errors.push('用量: 未找到 cost-meter 账本');
        } else if (payload.usage.pricing.missing.length) {
          payload.errors.push('价格: 这些模型没有公开价，未计入金额与积分分摊 - ' + payload.usage.pricing.missing.join('、'));
        }
      } else {
        const reason = usageResult.reason;
        payload.errors.push('用量: ' + String((reason && reason.message) || reason));
      }

      send(res, 200, payload);
    } catch (error) {
      const message = error && error.name === 'AbortError'
        ? '上游读取超时（8s）'
        : String((error && error.message) || error);
      send(res, 502, { status: 'error', error: message });
    }
  };

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: handler }));
}
