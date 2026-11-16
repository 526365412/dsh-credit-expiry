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
 * Prices
 * ------------------------------------------------------------------ */

const PRICE_URL = 'https://openrouter.ai/api/v1/models';
const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const PRICE_TTL_MS = 60 * 60 * 1000;
const FX_TTL_MS = 6 * 60 * 60 * 1000;
const PRICE_TIMEOUT_MS = 6000;

/**
 * Last-resort USD->CNY and credit rate. Both are used ONLY before the first
 * successful fetch (cold install, offline) and are flagged as such in the UI;
 * they are never how the panel normally computes anything.
 */
const FALLBACK_USD_CNY = 7.1;
const FALLBACK_CREDIT_CNY = 0.15;

/**
 * Ledger model id (lowercased) -> OpenRouter slug. OpenRouter is the one source
 * that publishes prompt / completion / cache-read prices for every model these
 * four pools serve, in a single JSON document. A model missing from this map, or
 * missing from the catalogue, is reported as unpriced instead of being valued at
 * a made-up number.
 */
const MODEL_SLUGS = {
  'deepseek-v4.1-flash': 'deepseek/deepseek-v4.1-flash',
  'deepseek-v4.1-flash-1017': 'deepseek/deepseek-v4.1-flash-1017',
  'deepseek-v4-pro': 'deepseek/deepseek-v4-pro',
  'deepseek-v4-pro-official': 'deepseek/deepseek-v4-pro',
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'glm-5.3': 'z-ai/glm-5.3',
  'glm-5.3-flash': 'z-ai/glm-5.3-flash',
  'glm-5.3-flashx': 'z-ai/glm-5.3-flashx',
  'glm-5.2': 'z-ai/glm-5.2',
  'glm-5.1': 'z-ai/glm-5.1',
  'minimax-m3.1-flash': 'minimax/minimax-m3.1-flash',
  'minimax-m3': 'minimax/minimax-m3',
  'minimax-m2.7': 'minimax/minimax-m2.7',
  'kimi-k3.1-pro': 'moonshotai/kimi-k3.1-pro',
  'kimi-k3': 'moonshotai/kimi-k3',
  'kimi-k2.7-code': 'moonshotai/kimi-k2.7-code',
  'kimi-k2.6': 'moonshotai/kimi-k2.6',
  'qwen3.8-max': 'qwen/qwen3.8-max-0902',
  'qwen3.8-flash': 'qwen/qwen3.8-flash',
  'qwen-3.7-plus': 'qwen/qwen3.7-plus',
  'hy4': 'tencent/hy4',
  'hy4std': 'tencent/hy4',
  'hy3': 'tencent/hy3'
};

/** USD per 1M tokens, captured 2026-11-16. Cold start only; a live fetch wins. */
const FALLBACK_PRICES = {
  'deepseek-v4.1-flash': { input: 0.14, cached: 0.0042, output: 0.42 },
  'deepseek-v4.1-flash-1017': { input: 0.15, cached: 0.003, output: 0.6 },
  'deepseek-v4-pro': { input: 0.9, cached: 0.25, output: 1.5 },
  'deepseek-v4-flash': { input: 0.14, cached: 0.0042, output: 0.42 },
  'deepseek-v4-pro-official': { input: 0.9, cached: 0.25, output: 1.5 },
  'glm-5.3': { input: 0.0699, cached: 0.0689, output: 1.4 },
  'glm-5.3-flash': { input: 0.0399, cached: 0.03, output: 0.0784 },
  'glm-5.3-flashx': { input: 0.37, cached: 0.075, output: 1.25 },
  'glm-5.2': { input: 0.6, cached: 0.11, output: 2.2 },
  'glm-5.1': { input: 0.6, cached: 0.11, output: 2.2 },
  'minimax-m3.1-flash': { input: 0.15, cached: 0.015, output: 0.6 },
  'minimax-m3': { input: 0.3, cached: 0.06, output: 1.2 },
  'minimax-m2.7': { input: 0.3, cached: 0.06, output: 1.2 },
  'kimi-k3.1-pro': { input: 0.2403, cached: 0.2, output: 8.4023 },
  'kimi-k3': { input: 0.6, cached: 0.15, output: 2.5 },
  'kimi-k2.7-code': { input: 0.6, cached: 0.15, output: 2.5 },
  'kimi-k2.6': { input: 0.6, cached: 0.15, output: 2.5 },
  'qwen3.8-max': { input: 2, cached: 0.25, output: 6 },
  'qwen3.8-flash': { input: 0.15, cached: 0.015, output: 0.6 },
  'qwen-3.7-plus': { input: 0.4, cached: 0.04, output: 1.2 },
  'hy4': { input: 0.417, cached: 0.021, output: 1.2505 },
  'hy4std': { input: 0.417, cached: 0.021, output: 1.2505 },
  'hy3': { input: 0.3, cached: 0.03, output: 1.2 }
};

function homeDir() {
  const env = process.env.DSH_HOME;
  return env && env.trim() ? env.trim() : join(homedir(), '.dsh');
}

function priceStatePath() {
  return join(homeDir(), 'storages', 'credit-expiry', 'prices.json');
}

/** Latest good catalogue; survives restarts and renders while offline. */
let priceMemo = null;

async function loadPriceState() {
  try {
    const parsed = JSON.parse(await readFile(priceStatePath(), 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.table) return parsed;
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
    return await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
}

/** OpenRouter quotes per token; the whole panel works in per-million. */
function perMillion(value) {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n * 1e6 : null;
}

async function fetchCatalogue() {
  try {
    const response = await timedFetch(PRICE_URL);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.json();
    const list = Array.isArray(body && body.data) ? body.data : [];
    const byId = new Map();
    for (const entry of list) {
      if (entry && typeof entry.id === 'string') byId.set(entry.id, entry.pricing || {});
    }
    const table = {};
    for (const [id, slug] of Object.entries(MODEL_SLUGS)) {
      const pricing = byId.get(slug);
      if (!pricing) continue;
      const input = perMillion(pricing.prompt);
      const output = perMillion(pricing.completion);
      if (input === null || output === null) continue;
      table[id] = { input, cached: perMillion(pricing.input_cache_read), output };
    }
    if (!Object.keys(table).length) return { error: '价格目录里没有匹配的模型' };
    return { table };
  } catch (error) {
    return { error: String((error && error.message) || error) };
  }
}

async function fetchFx() {
  try {
    const response = await timedFetch(FX_URL);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.json();
    const rate = Number(body && body.rates && body.rates.CNY);
    if (Number.isFinite(rate) && rate > 3 && rate < 20) return { rate, at: Date.now() };
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the live price table, the current USD->CNY rate, and where both came
 * from. One network round trip per hour at most; every failure degrades to the
 * last persisted catalogue rather than to a wrong number.
 */
async function priceState() {
  const now = Date.now();
  if (priceMemo && now - priceMemo.fetchedAt < PRICE_TTL_MS) return priceMemo;
  const disk = priceMemo || (await loadPriceState());
  const fxNeeded = !disk || !disk.fxAt || now - disk.fxAt > FX_TTL_MS;
  const [catalogue, fx] = await Promise.all([
    fetchCatalogue(),
    fxNeeded ? fetchFx() : Promise.resolve(null)
  ]);
  const state = {
    fetchedAt: catalogue.table ? now : ((disk && disk.fetchedAt) || 0),
    fxAt: fx ? fx.at : ((disk && disk.fxAt) || 0),
    usdToCny: (fx && fx.rate) || (disk && disk.usdToCny) || FALLBACK_USD_CNY,
    table: catalogue.table || (disk && disk.table) || FALLBACK_PRICES,
    source: catalogue.table ? 'openrouter' : ((disk && disk.source) || 'bundled'),
    live: !!catalogue.table,
    error: catalogue.error || null
  };
  priceMemo = state;
  if (catalogue.table) await savePriceState(state);
  return state;
}

function priceOf(state, model) {
  const key = String(model || '').toLowerCase();
  const table = (state && state.table) || FALLBACK_PRICES;
  return table[key] || null;
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
 * List price of one ledger entry, in CNY.
 *
 * The ledger keeps input, cacheRead and cacheWrite as separate buckets, so each
 * pays its own rate - that is exactly the cache-hit discount the flat credit
 * rate used to throw away. A catalogue without a cache-read price bills cached
 * tokens at the full input rate: overstating, never silently understating.
 */
function entryCostCny(entry, price, usdToCny) {
  const prompt = entry.input || 0;
  const cached = entry.cacheRead || 0;
  const written = entry.cacheWrite || 0;
  const output = entry.output || 0;
  const cacheRate = typeof price.cached === 'number' ? price.cached : price.input;
  const usd = (prompt / 1e6) * price.input
    + (cached / 1e6) * cacheRate
    + (output / 1e6) * price.output
    + (written / 1e6) * cacheRate;
  return usd * usdToCny;
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
  return { credits: costCny / FALLBACK_CREDIT_CNY, rate: 1 / FALLBACK_CREDIT_CNY, estimated: true };
}

export function summarizeUsage(ledger, options) {
  if (!ledger || !ledger.days || typeof ledger.days !== 'object') return null;
  const opts = options || {};
  const prices = opts.prices || { table: FALLBACK_PRICES, usdToCny: FALLBACK_USD_CNY, source: 'bundled' };
  const multipliers = opts.multipliers || {};
  const consumedByPool = opts.consumed || {};

  const dates = Object.keys(ledger.days).sort();
  const entries = [];
  const poolCost = { wb: 0, tr: 0, mm: 0, qd: 0 };
  const missing = {};

  /* Pass 1: price every provider/model entry once. */
  for (const date of dates) {
    const day = ledger.days[date] || {};
    const byModel = day.byProviderModel && typeof day.byProviderModel === 'object' ? day.byProviderModel : {};
    for (const key of Object.keys(byModel)) {
      const raw = byModel[key] || {};
      const parts = splitKey(key);
      if (!CREDIT_PROVIDER_SET.has(parts.provider)) continue;
      const pool = PROVIDER_POOL[parts.provider];
      const multiplier = multipliers[parts.model.toLowerCase()];
      const free = multiplier === 0;
      const price = priceOf(prices, parts.model);
      const tokens = tokensOf(raw);
      let costCny = 0;
      if (price) costCny = entryCostCny(raw, price, prices.usdToCny || FALLBACK_USD_CNY);
      else if (!free) missing[parts.model] = (missing[parts.model] || 0) + tokens;
      /* A free model still moved real tokens but burns no credits, so it must
         stay out of the price pool the credit rate is derived from. */
      if (!free && costCny > 0) poolCost[pool] += costCny;
      entries.push({
        date: date,
        key: key,
        provider: parts.provider,
        model: parts.model,
        pool: pool,
        calls: raw.calls || 0,
        inputTokens: raw.input || 0,
        outputTokens: raw.output || 0,
        cacheReadTokens: raw.cacheRead || 0,
        cacheWriteTokens: raw.cacheWrite || 0,
        tokens: tokens,
        costCny: costCny,
        priced: !!price,
        free: free
      });
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
   * split; when a pool has no priced call at all (an unpublished model) the
   * tokens are the only thing left to split by. Either way the entries add up to
   * exactly the number the platform reported - never to a re-derived one.
   */
  const poolWeight = { wb: 0, tr: 0, mm: 0, qd: 0 };
  for (const entry of entries) {
    if (entry.free) continue;
    const pool = pools[entry.pool];
    entry.weight = pool && pool.rate > 0 ? entry.costCny : entry.tokens;
    if (entry.weight > 0) poolWeight[entry.pool] += entry.weight;
  }

  const creditsOf = (entry) => {
    if (entry.free || !(entry.weight > 0)) return 0;
    const pool = pools[entry.pool];
    const total = poolWeight[entry.pool];
    if (!pool || !(total > 0)) return 0;
    return pool.credits * (entry.weight / total);
  };

  /* Pass 3: apportion, so a pool's bars sum to exactly what the platform says. */
  const daily = [];
  const providers = new Map();
  const sessions = [];

  for (const date of dates) {
    const day = ledger.days[date] || {};
    const mine = entries.filter((entry) => entry.date === date);
    let dayCalls = 0;
    let dayTokens = 0;
    let dayCost = 0;
    let dayCredits = 0;
    const dayCreditsByPool = {};

    for (const entry of mine) {
      const credits = creditsOf(entry);
      dayCalls += entry.calls;
      dayTokens += entry.tokens;
      dayCost += entry.costCny;
      dayCredits += credits;
      dayCreditsByPool[entry.pool] = (dayCreditsByPool[entry.pool] || 0) + credits;

      let bucket = providers.get(entry.key);
      if (!bucket) {
        bucket = {
          key: entry.key,
          provider: entry.provider,
          model: entry.model,
          pool: entry.pool,
          calls: 0,
          tokens: 0,
          costCny: 0,
          credits: 0,
          free: entry.free,
          priced: entry.priced,
          lastDate: date
        };
        providers.set(entry.key, bucket);
      }
      bucket.calls += entry.calls;
      bucket.tokens += entry.tokens;
      bucket.costCny += entry.costCny;
      bucket.credits += credits;
      bucket.lastDate = date;
    }

    daily.push({
      date: date,
      calls: dayCalls,
      tokens: dayTokens,
      costCny: dayCost,
      credits: dayCredits,
      byPool: dayCreditsByPool
    });

    const list = Array.isArray(day.sessions) ? day.sessions : [];
    for (const session of list) {
      const perModel = session.byProviderModel && typeof session.byProviderModel === 'object' ? session.byProviderModel : {};
      let topKey = '';
      let topCost = -1;
      let calls = 0;
      let tokens = 0;
      let costCny = 0;
      let credits = 0;

      for (const key of Object.keys(perModel)) {
        const raw = perModel[key] || {};
        const parts = splitKey(key);
        if (!CREDIT_PROVIDER_SET.has(parts.provider)) continue;
        const pool = PROVIDER_POOL[parts.provider];
        const free = multipliers[parts.model.toLowerCase()] === 0;
        const price = priceOf(prices, parts.model);
        const entryCny = !price || free ? 0 : entryCostCny(raw, price, prices.usdToCny || FALLBACK_USD_CNY);
        const entryCredits = entryCny > 0 && pools[pool] && pools[pool].rate > 0 ? entryCny * pools[pool].rate : 0;
        calls += raw.calls || 0;
        tokens += tokensOf(raw);
        costCny += entryCny;
        credits += entryCredits;
        if (entryCny > topCost) {
          topCost = entryCny;
          topKey = key;
        }
      }

      if (!calls) continue; /* a cash-only session is not a credit session */

      sessions.push({
        id: session.id || '',
        at: session.at || 0,
        date: date,
        title: session.title || '',
        calls: calls,
        tokens: tokens,
        costCny: costCny,
        credits: credits,
        top: topKey
      });
    }
  }

  sessions.sort((a, b) => b.at - a.at);

  const totals = daily.reduce(
    (acc, day) => {
      acc.calls += day.calls;
      acc.tokens += day.tokens;
      acc.costCny += day.costCny;
      acc.credits += day.credits;
      return acc;
    },
    {
      calls: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costCny: 0,
      credits: 0,
      days: dates.length,
      from: dates[0] || null,
      to: dates[dates.length - 1] || null
    }
  );
  for (const entry of entries) {
    totals.inputTokens += entry.inputTokens;
    totals.outputTokens += entry.outputTokens;
    totals.cacheReadTokens += entry.cacheReadTokens;
  }

  const providerList = Array.from(providers.values())
    .sort((a, b) => (b.credits - a.credits) || (b.tokens - a.tokens));

  return {
    scopedTo: CREDIT_PROVIDERS,
    totals: totals,
    daily: daily.slice(-DAILY_WINDOW),
    providers: providerList,
    sessions: sessions.slice(0, SESSION_LIMIT),
    sessionCount: sessions.length,
    pools: pools,
    pricing: {
      source: prices.source || 'bundled',
      live: !!prices.live,
      fetchedAt: prices.fetchedAt || 0,
      usdToCny: prices.usdToCny || FALLBACK_USD_CNY,
      error: prices.error || null,
      missing: Object.keys(missing)
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
      if (prices && prices.error) payload.errors.push('价格: ' + prices.error);

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
