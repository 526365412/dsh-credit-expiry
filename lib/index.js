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

import { readFileSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
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
  qd: '/plugins/dsh-connect-qoder/usage',
  /* WorkBuddy is the one pool that can hold several signed-in accounts; the
     per-account roster lives on its own (slower) route. */
  wbAccounts: '/plugins/dsh-connect-workbuddy/account-credits',
  trAccounts: '/plugins/dsh-connect-trae/account-credits',
  qdAccounts: '/plugins/dsh-connect-qoder/account-credits',
  trAccountStatus: '/plugins/dsh-connect-trae/account-status'
};
const TIMEOUT_MS = 8000;
const ACCOUNT_TIMEOUT_MS = 5000;
/* Trae answers a roster with one balance per account and no date; each extra
   account's date costs one more upstream read, so the fan-out is capped. */
const TRAE_STATUS_LIMIT = 4;
const DAILY_WINDOW = 14;
const PROVIDER_LIMIT = 40;
const DAY_MS = 24 * 60 * 60 * 1000;
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
/** After a total fetch failure, wait this long before trying the three pages again. */
const PRICE_RETRY_MS = 5 * 60 * 1000;
const PRICE_TIMEOUT_MS = 8000;

/* The three vendor pages above only cover the models those three vendors sell.
   Everything else - Kimi, Qwen, Doubao, Hunyuan, GPT, Claude, Gemini, Grok,
   Mistral - is read from the models.dev catalogue, which publishes per-model
   token prices for every provider it tracks. That is one 6 MB document, so it
   is fetched on the same six-hour cadence and only the price rows are kept. */
const PRICE_CATALOG_URL = 'https://models.dev/api.json';
const CATALOG_TIMEOUT_MS = 20000;
/* models.dev quotes USD per million tokens; the panel reports CNY. */
const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const FX_TIMEOUT_MS = 6000;
const FX_TTL_MS = 12 * 60 * 60 * 1000;
/* Last-resort rate. Only used before the first successful quote, and flagged as
   such - a silent hard-coded rate is how a panel starts lying. */
const BUNDLED_FX = 6.68;

/* When two providers publish the same model id, the vendor that actually makes
   the model wins: a reseller's markup must not become the model's list price. */
const CATALOG_PREFERENCE = [
  'deepseek', 'zhipuai', 'minimax', 'moonshotai', 'alibaba', 'volcengine',
  'tencent-tokenhub', 'openai', 'anthropic', 'google', 'xai', 'mistral'
];

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
const PRICE_CACHE_SCHEMA = 3;

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
/** A tier is only usable when both token prices are real numbers. */
function isTier(tier) {
  return !!tier && typeof tier === 'object'
    && typeof tier.input === 'number' && Number.isFinite(tier.input)
    && typeof tier.output === 'number' && Number.isFinite(tier.output);
}

function normalizeTable(table) {
  const out = {};
  for (const [id, row] of Object.entries(table || {})) {
    if (!row || typeof row !== 'object') continue;
    if (isTier(row.offPeak) && isTier(row.peak)) {
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
      return {
        fetchedAt: parsed.fetchedAt || 0,
        table: normalizeTable(parsed.table),
        source: parsed.source,
        vendors: parsed.vendors,
        catalogRows: parsed.catalogRows || 0,
        fxRate: parsed.fxRate || 0
      };
    }
  } catch {
    /* first run, or the file was never written */
  }
  return null;
}

async function savePriceState(state) {
  const target = priceStatePath();
  const temp = target + '.tmp';
  try {
    await mkdir(join(homeDir(), 'storages', 'credit-expiry'), { recursive: true });
    /* Write beside the target and rename: a crash mid-write must not leave a
       half-written table that the loader would silently read as 'no cache'. */
    await writeFile(temp, JSON.stringify(state), 'utf8');
    await rename(temp, target);
  } catch {
    /* a read-only home only costs a refetch on the next start */
  }
}

/* ------------------------------------------------------------------ *
 * Key-based balance cards
 *
 * The four connectors cover the pools that hand out credits. Everything else
 * a person pays for is a cash balance behind an API key, and every one of
 * those vendors answers the same question on a small endpoint. The key list
 * lives beside the price cache on this machine, never in the repository, and
 * a key is never sent back to a caller - only its last four characters.
 * ------------------------------------------------------------------ */

const KEY_STATE_SCHEMA = 1;
const KEY_TIMEOUT_MS = 8000;
const KEY_LIMIT = 12;

/**
 * One entry per vendor whose balance can be read without scraping a web page.
 * 'parse' turns that vendor's own payload into a plain amount plus currency; a
 * shape this build does not recognise returns null so the card says "unknown
 * response" instead of inventing a zero.
 */
const BALANCE_SOURCES = {
  deepseek: {
    label: 'DeepSeek',
    url: 'https://api.deepseek.com/user/balance',
    keysUrl: 'https://platform.deepseek.com/api_keys',
    parse(body) {
      const list = body && Array.isArray(body.balance_infos) ? body.balance_infos : [];
      const cny = list.find((b) => b && String(b.currency).toUpperCase() === 'CNY') || list[0];
      if (!cny) return null;
      const amount = Number(cny.total_balance);
      if (!Number.isFinite(amount)) return null;
      return {
        amount: amount,
        currency: String(cny.currency || 'CNY').toUpperCase(),
        granted: Number(cny.granted_balance) || 0,
        topped: Number(cny.topped_up_balance) || 0,
        available: body.is_available !== false
      };
    }
  },
  moonshot: {
    label: 'Moonshot / Kimi',
    url: 'https://api.moonshot.cn/v1/users/me/balance',
    keysUrl: 'https://platform.moonshot.cn/console/api-keys',
    parse(body) {
      const data = body && body.data ? body.data : body;
      const amount = Number(data && data.available_balance);
      if (!Number.isFinite(amount)) return null;
      return {
        amount: amount,
        currency: 'CNY',
        granted: Number(data.voucher_balance) || 0,
        topped: Number(data.cash_balance) || 0,
        available: true
      };
    }
  },
  openrouter: {
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/credits',
    keysUrl: 'https://openrouter.ai/settings/keys',
    parse(body) {
      const data = body && body.data ? body.data : body;
      const bought = Number(data && data.total_credits);
      const used = Number(data && data.total_usage);
      if (!Number.isFinite(bought)) return null;
      return {
        amount: bought - (Number.isFinite(used) ? used : 0),
        currency: 'USD',
        granted: 0,
        topped: bought,
        used: Number.isFinite(used) ? used : 0,
        available: true
      };
    }
  }
};

function keyStatePath() {
  return join(homeDir(), 'storages', 'credit-expiry', 'keys.json');
}

/** A masked key is the only form that ever leaves this process. */
function maskKey(key) {
  const text = String(key || '');
  if (text.length <= 8) return text ? '****' : '';
  return text.slice(0, 3) + '…' + text.slice(-4);
}

function sanitizeAccount(entry, index) {
  const vendor = String(entry && entry.vendor ? entry.vendor : '').toLowerCase();
  if (!BALANCE_SOURCES[vendor]) return null;
  const key = String(entry && entry.key ? entry.key : '').trim();
  if (!key) return null;
  return {
    id: String(entry && entry.id ? entry.id : vendor + '-' + index),
    label: String(entry && entry.label ? entry.label : BALANCE_SOURCES[vendor].label).slice(0, 40),
    vendor: vendor,
    key: key,
    currency: entry && entry.currency ? String(entry.currency).toUpperCase() : null
  };
}

async function loadKeyState() {
  try {
    const parsed = JSON.parse(await readFile(keyStatePath(), 'utf8'));
    if (parsed && parsed.schema === KEY_STATE_SCHEMA && Array.isArray(parsed.accounts)) {
      return parsed.accounts.map(sanitizeAccount).filter(Boolean);
    }
  } catch {
    /* no file yet */
  }
  return [];
}

async function saveKeyState(accounts) {
  const target = keyStatePath();
  const temp = target + '.tmp';
  await mkdir(join(homeDir(), 'storages', 'credit-expiry'), { recursive: true });
  await writeFile(temp, JSON.stringify({ schema: KEY_STATE_SCHEMA, accounts: accounts }), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, target);
}

/** What the panel may see about a configured account. */
function publicAccount(entry) {
  return {
    id: entry.id,
    label: entry.label,
    vendor: entry.vendor,
    vendorLabel: (BALANCE_SOURCES[entry.vendor] || {}).label || entry.vendor,
    keysUrl: (BALANCE_SOURCES[entry.vendor] || {}).keysUrl || null,
    masked: maskKey(entry.key),
    currency: entry.currency || null
  };
}

/**
 * One real read per configured key, concurrently, with a short timeout: a
 * balance card is a convenience, and a slow vendor must not hold the page.
 */
async function readBalances(accounts) {
  const out = [];
  await Promise.all(accounts.map(async (entry) => {
    const source = BALANCE_SOURCES[entry.vendor];
    const record = publicAccount(entry);
    record.balance = null;
    record.error = null;
    record.checkedAt = Date.now();
    if (!source) {
      record.error = '不支持的厂商';
      out.push(record);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KEY_TIMEOUT_MS);
    try {
      const response = await fetch(source.url, {
        headers: { authorization: 'Bearer ' + entry.key, accept: 'application/json' },
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        /* 401 is the one failure worth naming precisely: it means the key
           itself is wrong, not that the vendor is down. */
        record.error = response.status === 401 ? '密钥无效或已撤销' : ('HTTP ' + response.status);
        out.push(record);
        return;
      }
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      const balance = parsed ? source.parse(parsed) : null;
      if (!balance) {
        record.error = '无法解析该厂商的余额响应';
        out.push(record);
        return;
      }
      if (entry.currency) balance.currency = entry.currency;
      record.balance = balance;
    } catch (error) {
      const aborted = error && error.name === 'AbortError';
      record.error = aborted ? '读取超时' : String((error && error.message) || error).slice(0, 120);
    } finally {
      clearTimeout(timer);
      out.push(record);
    }
  }));
  /* Stable order: the stored order, so a card does not jump rows between polls. */
  const byId = new Map(out.map((r) => [r.id, r]));
  return accounts.map((a) => byId.get(a.id)).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Update check - is a newer release published?
 * ------------------------------------------------------------------ */

const UPDATE_TTL_MS = 6 * 60 * 60 * 1000;
const UPDATE_TIMEOUT_MS = 6000;
/* raw first: jsDelivr serves a cached copy for up to a day after a push, which
   would report a stale version for exactly the machines that just updated. */
/* Authoritative mirrors read the repository on every request. raw sits behind a
   CDN too but a short one; the API is the second opinion. */
const UPDATE_SOURCES = [
  'https://raw.githubusercontent.com/526365412/dsh-credit-expiry/main/index.json',
  /* Unauthenticated API calls are capped at 60/hour, but the six-hour memo keeps
     this to a handful a day - and it covers machines where raw is blocked. */
  'https://api.github.com/repos/526365412/dsh-credit-expiry/contents/index.json?ref=main'
];
/* jsDelivr caches a pushed file for up to a day, so it is only a last resort -
   it must never win a race against a source that is actually up to date. */
const UPDATE_FALLBACKS = [
  'https://cdn.jsdelivr.net/gh/526365412/dsh-credit-expiry@main/index.json'
];
const RELEASES_URL = 'https://github.com/526365412/dsh-credit-expiry/releases';

/* How long the first authoritative answer lets its sibling catch up, so the
   higher of two honest answers still wins. */
const MIRROR_GRACE_MS = 1500;

let versionMemo = null;

/** This build's own version - read from the manifest, never hard-coded. */
function localVersion() {
  try {
    const url = new URL('../package.json', import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 1.2.3 against 1.10.0 - numeric per segment, missing segments read as 0.
 *
 * A prerelease (1.0.0-rc.1) is LOWER than its release: without that rule a
 * machine on an rc would be told it is already up to date forever, and this
 * plugin's own engines line proves prereleases are a real shape here.
 */
function versionGt(a, b) {
  const split = (value) => {
    const text = String(value === undefined || value === null ? '' : value);
    const cut = text.indexOf('-');
    const core = (cut === -1 ? text : text.slice(0, cut)).split('.').map((n) => Number(n) || 0);
    const pre = cut === -1 ? null : text.slice(cut + 1);
    return { core: core, pre: pre };
  };
  const left = split(a);
  const right = split(b);
  const len = Math.max(left.core.length, right.core.length);
  for (let i = 0; i < len; i += 1) {
    const x = left.core[i] || 0;
    const y = right.core[i] || 0;
    if (x !== y) return x > y;
  }
  if (left.pre === right.pre) return false;
  if (left.pre === null) return true;
  if (right.pre === null) return false;
  const la = left.pre.split('.');
  const lb = right.pre.split('.');
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i += 1) {
    const x = la[i];
    const y = lb[i];
    if (x === y) continue;
    if (x === undefined) return false;
    if (y === undefined) return true;
    const nx = Number(x);
    const ny = Number(y);
    const xNum = Number.isFinite(nx);
    const yNum = Number.isFinite(ny);
    if (xNum && yNum) return nx > ny;
    if (xNum) return false;
    if (yNum) return true;
    return x > y;
  }
  return false;
}

/**
 * Ask one mirror for the published index. Every mirror serves the same document
 * except the contents API, which wraps it in base64 - both shapes are unwrapped
 * here so the caller only ever sees {url, latest}.
 */
async function probeMirror(url, now, force) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
  try {
    /* Each mirror sits behind a CDN with its own TTL - raw for minutes, jsDelivr
       for hours - so a forced check has to miss that cache or it reports the
       version the machine already has. */
    /* The contents API URL already carries ?ref=main, so the cache buster has to
       pick its separator or the ref itself gets swallowed. */
    const href = force ? url + (url.indexOf('?') === -1 ? '?t=' : '&t=') + now : url;
    const response = await fetch(href, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'cache-control': 'no-cache' }
    });
    if (!response.ok) throw new Error('http ' + response.status);
    let parsed = await response.json();
    if (!parsed || !parsed.plugins) {
      if (parsed && typeof parsed.content === 'string') {
        parsed = JSON.parse(Buffer.from(parsed.content, 'base64').toString('utf8'));
      }
    }
    /* The index is a list: pick this plugin by name and its highest version,
       because array order is a build detail and a self-hosted feed can carry
       another plugin at position 0. */
    const plugins = parsed && Array.isArray(parsed.plugins) ? parsed.plugins : [];
    const plugin = plugins.find((entry) => entry && entry.name === name) || (plugins.length === 1 ? plugins[0] : null);
    const versions = plugin && Array.isArray(plugin.versions) ? plugin.versions : [];
    let latest = null;
    for (const entry of versions) {
      if (!entry || !entry.version) continue;
      if (!latest || versionGt(entry.version, latest.version)) latest = entry;
    }
    if (!latest) throw new Error('no version');
    return { url: url, latest: latest };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire every mirror in a group at once and return the entry with the highest
 * version. The first answer starts a short grace window so a sibling that is a
 * second slower can still report something newer; whatever has not landed by
 * then is dropped, because a slow mirror must not make the header spin.
 */
function raceMirrors(urls, now, force) {
  return new Promise((resolve) => {
    const hits = [];
    let open = urls.length;
    let done = false;
    let grace = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (grace) clearTimeout(grace);
      let best = null;
      for (const hit of hits) {
        if (!best || versionGt(hit.latest.version, best.latest.version)) best = hit;
      }
      resolve(best);
    };
    const settle = () => {
      open -= 1;
      if (open === 0) finish();
    };
    const firstHit = () => {
      if (done || grace) return;
      grace = setTimeout(finish, MIRROR_GRACE_MS);
      grace.unref && grace.unref();
    };
    urls.forEach((url) => {
      probeMirror(url, now, force).then(
        (hit) => { hits.push(hit); firstHit(); settle(); },
        () => { settle(); }
      );
    });
    if (open === 0) finish();
  });
}

/**
 * The published index is the one thing every install already knows how to read,
 * so it doubles as the version beacon: it carries the plugin's current version,
 * the exact commit and a publish timestamp. Cached for six hours and never
 * allowed to fail the request - an offline machine still renders the panel.
 */
async function updateState(force) {
  const current = localVersion();
  const now = Date.now();
  if (!force && versionMemo && now - versionMemo.checkedAt < UPDATE_TTL_MS) {
    return versionMemo;
  }
  /* Two groups, tried in order: authoritative mirrors that are never stale, then
     the CDN copy that can be a day behind. Inside a group both mirrors race and
     the higher version wins, so a momentarily slow host cannot hide a release. */
  let best = await raceMirrors(UPDATE_SOURCES, now, force);
  if (!best) best = await raceMirrors(UPDATE_FALLBACKS, now, force);
  if (best) {
    /* The fallback is a CDN copy that can lag a day behind. When it answers with
       something older than what a previous check already saw, keep the newer
       numbers and only refresh the timestamp - a transient outage must not make
       the panel claim the machine is newer than it is. */
    const known = versionMemo && versionMemo.latest ? versionMemo : null;
    if (known && versionGt(known.latest, best.latest.version)) {
      versionMemo = {
        current: current,
        latest: known.latest,
        hasUpdate: versionGt(known.latest, current),
        publishedAt: known.publishedAt,
        commit: known.commit,
        checkedAt: now,
        source: known.source,
        url: RELEASES_URL,
        error: null
      };
      return versionMemo;
    }
    versionMemo = {
      current: current,
      latest: String(best.latest.version),
      hasUpdate: versionGt(best.latest.version, current),
      publishedAt: Number(best.latest.publishTimestamp) * 1000 || 0,
      commit: best.latest.source && best.latest.source.commit ? String(best.latest.source.commit).slice(0, 7) : null,
      checkedAt: now,
      source: best.url,
      url: RELEASES_URL,
      error: null
    };
    return versionMemo;
  }
  versionMemo = {
    current: current,
    latest: null,
    hasUpdate: false,
    publishedAt: 0,
    commit: null,
    checkedAt: now,
    source: null,
    url: RELEASES_URL,
    error: '无法访问索引源（离线或网络受限）'
  };
  return versionMemo;
}

async function timedFetch(url, timeoutMs) {
  const controller = new AbortController();
  const budget = Number(timeoutMs) > 0 ? Number(timeoutMs) : PRICE_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), budget);
  try {
    return await fetch(url, { signal: controller.signal, headers: { accept: 'application/json,text/plain,text/html,*/*' } });
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

/* ------------------------------------------------------------------ *
 * The catalogue - every model any provider publishes a price for
 * ------------------------------------------------------------------ */

/**
 * models.dev publishes one document covering 300+ providers, each listing its
 * models with a cost block in USD per million tokens:
 *
 *   cost: { input, output, cache_read, cache_write }
 *
 * The three vendor pages above are authoritative for their own models and stay
 * as an override; this is what fills in everything else, so a Kimi or a Qwen
 * call stops rendering as an unpriceable row.
 */
async function fetchCatalog() {
  const response = await timedFetch(PRICE_CATALOG_URL, CATALOG_TIMEOUT_MS);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return await response.json();
}

/** Spot USD->CNY. Twelve hours is plenty: this only scales list prices. */
async function fetchFx() {
  const response = await timedFetch(FX_URL, FX_TIMEOUT_MS);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const body = await response.json();
  const rate = body && body.rates ? Number(body.rates.CNY) : NaN;
  if (!(rate > 0) || !Number.isFinite(rate)) throw new Error('no CNY rate');
  return rate;
}

/**
 * Rank a provider for tie-breaking: the vendor that makes the model outranks a
 * reseller, so a marked-up mirror never becomes the model's list price.
 */
function catalogRank(providerId) {
  const index = CATALOG_PREFERENCE.indexOf(providerId);
  return index === -1 ? CATALOG_PREFERENCE.length : index;
}

/**
 * Flatten the catalogue into the shape the cost code already speaks: CNY per
 * million tokens, one rate for both time slots. Providers that publish context
 * tiers are read at their cheapest (base) tier, which is what a normal call
 * pays - the same rule the vendor-page parsers use.
 */
function parseCatalog(document, fx) {
  const table = {};
  const rank = {};
  const providers = document && typeof document === 'object' ? document : {};
  for (const [providerId, provider] of Object.entries(providers)) {
    if (!provider || typeof provider !== 'object' || !provider.models) continue;
    const order = catalogRank(providerId);
    for (const [modelId, model] of Object.entries(provider.models)) {
      const cost = model && model.cost;
      if (!cost || typeof cost !== 'object') continue;
      const key = String(modelId).toLowerCase();
      if (rank[key] !== undefined && rank[key] <= order) continue;
      const input = Number(cost.input);
      const output = Number(cost.output);
      if (!Number.isFinite(input) || !Number.isFinite(output) || (input <= 0 && output <= 0)) continue;
      const cached = Number(cost.cache_read);
      /* Already CNY when the document was quoted that way, but models.dev is
         USD throughout - scale here, once, instead of per lookup. */
      table[key] = flat(
        providerId,
        input * fx,
        (Number.isFinite(cached) && cached >= 0 ? cached : input) * fx,
        output * fx
      );
      rank[key] = order;
    }
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
  /* The catalogue is the wide net: every other model in the ledger. It is
     fetched alongside the three pages and merged UNDER them, so a vendor's own
     page always wins for that vendor's models. */
  let catalog = null;
  let fx = BUNDLED_FX;
  const [catalogResult, fxResult] = await Promise.allSettled([fetchCatalog(), fetchFx()]);
  if (fxResult.status === 'fulfilled') fx = fxResult.value;
  if (catalogResult.status === 'fulfilled') {
    try {
      catalog = parseCatalog(catalogResult.value, fx);
    } catch (error) {
      errors.push('目录: ' + String((error && error.message) || error));
    }
  } else {
    const reason = catalogResult.reason;
    errors.push('目录: ' + String((reason && reason.message) || reason));
  }
  return {
    table: Object.assign({}, catalog || {}, table),
    catalog: catalog,
    fx: { rate: fx, live: fxResult.status === 'fulfilled' },
    errors,
    vendors
  };
}

/**
 * Resolve the live price table and where it came from. One network round trip
 * every six hours; a vendor that fails keeps the last numbers it published
 * instead of dropping to zero.
 */
let pricePending = null;

function priceState() {
  /* Two surfaces poll this panel, and each poll would otherwise start its own
     three-vendor fetch. One in-flight promise serves every caller. */
  if (pricePending) return pricePending;
  pricePending = resolvePriceState().finally(() => { pricePending = null; });
  return pricePending;
}

async function resolvePriceState() {
  const now = Date.now();
  if (priceMemo && now < priceMemo.retryAfter && priceMemo.table) return priceMemo;
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
  /* A vendor whose page failed keeps its last known numbers, so the label has to
     name WHERE each vendor's prices came from - 'official' for all three while
     one of them is a day-old cache is exactly the kind of quiet lie this panel
     exists to avoid. */
  const originOf = (vendor) => (live.vendors.indexOf(vendor) !== -1 ? 'live'
    : (disk && disk.table && Object.values(disk.table).some((row) => row && row.vendor === vendor) ? 'cache' : 'bundled'));
  /* The catalogue is a wide net, not a source of truth for the three vendors
     above, so it gets its own provenance line rather than being folded into
     'official' and quietly overstating where a number came from. */
  const catalogLive = !!(live.catalog && Object.keys(live.catalog).length);
  const catalogRows = live.catalog ? Object.keys(live.catalog).length : (disk && disk.catalogRows) || 0;
  const fxRate = live.fx && live.fx.rate > 0 ? live.fx.rate : ((disk && disk.fxRate) || BUNDLED_FX);
  const state = {
    fetchedAt: anyLive || catalogLive ? now : ((disk && disk.fetchedAt) || 0),
    table: table,
    source: anyLive || catalogLive ? 'official' : ((disk && disk.source) || 'bundled'),
    live: live.vendors.length === 3,
    vendorSource: { deepseek: originOf('deepseek'), zhipu: originOf('zhipu'), minimax: originOf('minimax') },
    catalog: { rows: catalogRows, live: catalogLive },
    fx: { rate: fxRate, live: !!(live.fx && live.fx.live) },
    /* Nothing came back at all: back off instead of re-paying three 8s timeouts
       on every poll, but keep rendering the last good table. */
    retryAfter: anyLive || catalogLive ? 0 : now + PRICE_RETRY_MS,
    vendors: live.vendors,
    errors: live.errors
  };
  priceMemo = state;
  if (anyLive || catalogLive) {
    await savePriceState({
      schema: PRICE_CACHE_SCHEMA,
      fetchedAt: state.fetchedAt,
      table: Object.assign({}, previous, live.table),
      source: state.source,
      vendors: live.vendors,
      catalogRows: catalogRows,
      fxRate: fxRate
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
  const row = (alias && source[alias]) || source[key] || null;
  /* A row missing a tier would price calls as NaN, which JSON turns into null
     and the UI renders as '¥0.00' - worse than admitting there is no price. */
  if (!row || !isTier(row.offPeak) || !isTier(row.peak)) return null;
  return row;
}

/** Cost of one token split at one rate slot, in CNY. A cache write bills as a cache miss. */
function tierCost(tokens, rate) {
  if (!isTier(rate)) return 0;
  const cached = typeof rate.cached === 'number' && Number.isFinite(rate.cached) ? rate.cached : rate.input;
  const cost = ((tokens.input || 0) / 1e6) * rate.input
    + ((tokens.cacheRead || 0) / 1e6) * cached
    + ((tokens.cacheWrite || 0) / 1e6) * rate.input
    + ((tokens.output || 0) / 1e6) * rate.output;
  return Number.isFinite(cost) ? cost : 0;
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
      /* A malformed ledger stays malformed until it is written again, so cache
         the miss too: re-reading 1.4 MB on every panel open to hit the same
         parse error is the one thing worse than the error itself. */
      ledgerCache = { path, stamp, value: null };
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

/**
 * Pad the trailing window with empty calendar days. The ledger only lists days
 * that had calls, so a two-day gap would otherwise render as two adjacent bars -
 * a chart that quietly claims there was activity when there was none.
 */
function fillDays(rows, windowSize) {
  if (!rows.length) return rows;
  const last = rows[rows.length - 1].date;
  const end = new Date(last + 'T00:00:00Z').getTime();
  if (!Number.isFinite(end)) return rows.slice(-windowSize);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const out = [];
  for (let i = windowSize - 1; i >= 0; i -= 1) {
    const date = new Date(end - i * DAY_MS).toISOString().slice(0, 10);
    const row = byDate.get(date);
    out.push(row || {
      date: date,
      calls: 0,
      tokens: 0,
      costCny: 0,
      credits: 0,
      peakTokens: 0,
      idleTokens: 0,
      byPool: {}
    });
  }
  return out;
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

  /* Free models and paid models spend from different pockets: a free quota
     running out costs nothing, while a paid one costs money. Rolling them into
     one credit figure hides which pocket is actually emptying, so the split is
     carried through to the panel. */
  totals.freeCredits = 0;
  totals.paidCredits = 0;
  totals.freeTokens = 0;
  totals.paidTokens = 0;
  for (const atom of atoms) {
    const credits = creditsOf(atom);
    if (atom.free) {
      totals.freeCredits += credits;
      totals.freeTokens += atom.tokens;
    } else {
      totals.paidCredits += credits;
      totals.paidTokens += atom.tokens;
    }
  }

  const providerList = Array.from(providers.values())
    .sort((a, b) => (b.credits - a.credits) || (b.tokens - a.tokens));

  /* Burn rate per pool: what the trailing week actually cost, in the platform's
     own credits. This is what turns 'X expires on the 30th' into a decision -
     will it be spent before it evaporates? Calendar days in the divisor, not
     active days, so a quiet week correctly reads as 'barely burning'. */
  const burn = {};
  const recent = daily.slice(-7);
  /* Divide by the calendar days the ledger actually covers inside that window -
     not by the number of days that happened to have calls. A fresh machine with
     two busy days would otherwise read as 'burning 3.5x what it really is' and
     turn every forecast red. */
  const burnDays = Math.min(7, dates.length) || 0;
  for (const pool of Object.values(PROVIDER_POOL)) {
    let spent = 0;
    for (const row of recent) spent += row.byPool[pool] || 0;
    burn[pool] = burnDays ? spent / burnDays : 0;
  }

  return {
    scopedTo: CREDIT_PROVIDERS,
    totals: totals,
    daily: fillDays(daily, DAILY_WINDOW),
    providers: providerList.slice(0, PROVIDER_LIMIT),
    providerCount: providerList.length,
    sessions: sessionRecords.slice(0, SESSION_LIMIT),
    sessionCount: sessionRecords.length,
    pools: pools,
    burn: burn,
    pricing: {
      source: prices.source || 'bundled',
      live: !!prices.live,
      fetchedAt: prices.fetchedAt || 0,
      error: (prices.errors && prices.errors.length) ? prices.errors.join('; ') : null,
      missing: Object.keys(missing),
      vendors: prices.vendors || [],
      vendorSource: prices.vendorSource || null,
      /* The catalogue and the FX rate are what keep an unknown model from
         rendering as an unpriceable row, so both carry their own provenance. */
      catalog: prices.catalog || { rows: 0, live: false },
      fx: prices.fx || { rate: BUNDLED_FX, live: false },
      peak: {
        windows: DEEPSEEK_PEAK_WINDOWS,
        holidays: holidays.size,
        peakTokens: peakTokens,
        idleTokens: idleTokens
      }
    }
  };
}
/**
 * The page can show a number, but a reader who wants to argue with it needs the
 * rows. This is the same payload the panel already rendered, flattened into
 * CSV: one line per dated model row, with the pool and the money attached.
 */
function usageCsv(usage, data) {
  const rows = [['日期', '来源池', '模型', '厂商', '调用次数', '输入token', '输出token', '缓存读', '缓存写', '积分', '人民币', '是否免费', '有无公开价']];
  const pools = [
    ['wb', data && data.wb], ['tr', data && data.tr], ['mm', data && data.mm], ['qd', data && data.qd]
  ];
  for (const [id, pool] of pools) {
    if (!pool) continue;
    const name = POOL_LABEL[id] || id;
    rows.push([new Date().toISOString().slice(0, 10), name, '余额', '', '', '', '', '', '', String(pool.total || 0), '', '', '']);
  }
  for (const provider of (usage && usage.providers) || []) {
    rows.push([
      String(provider.lastDate || ''),
      POOL_LABEL[provider.pool] || provider.pool || '',
      provider.model || '',
      provider.vendor || '',
      String(provider.calls || 0),
      String(provider.inputTokens || 0),
      String(provider.outputTokens || 0),
      String(provider.cacheReadTokens || 0),
      String(provider.cacheWriteTokens || 0),
      String(Math.round((provider.credits || 0) * 100) / 100),
      String(Math.round((provider.costCny || 0) * 10000) / 10000),
      provider.free ? '是' : '否',
      provider.priced ? '有' : '无'
    ]);
  }
  /* A leading BOM: Excel on a Chinese Windows opens a UTF-8 CSV as mojibake
     without it, and 'ç§¯åˆ†' is not a useful first impression. */
  return '\ufeff' + rows.map((cells) => cells.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value) {
  const text = String(value === undefined || value === null ? '' : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

const POOL_LABEL = { wb: 'WorkBuddy', tr: 'Trae', mm: 'MiniMax', qd: 'Qoder' };

/**
 * IM webhook settings. The URL is a credential (anyone holding it can post to
 * the group), so it is stored beside the keys with 0600 and never echoed back
 * to the page - the page only learns which target kind is configured.
 */
function notifyStatePath() {
  return join(homeDir(), 'storages', 'credit-expiry', 'notify.json');
}

const NOTIFY_KINDS = ['wecom', 'dingtalk', 'feishu', 'slack'];

function notifyKindOf(url) {
  const text = String(url || '');
  if (text.indexOf('open.feishu.cn') >= 0 || text.indexOf('larksuite.com') >= 0) return 'feishu';
  if (text.indexOf('oapi.dingtalk.com') >= 0) return 'dingtalk';
  if (text.indexOf('qyapi.weixin.qq.com') >= 0) return 'wecom';
  if (text.indexOf('hooks.slack.com') >= 0) return 'slack';
  return 'wecom';
}

async function loadNotifyConfig() {
  try {
    const parsed = JSON.parse(await readFile(notifyStatePath(), 'utf8'));
    if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string' && parsed.url) {
      return {
        url: parsed.url,
        kind: NOTIFY_KINDS.indexOf(parsed.kind) >= 0 ? parsed.kind : notifyKindOf(parsed.url),
        hasUrl: true
      };
    }
  } catch {
    /* nothing configured */
  }
  return { url: null, kind: null, hasUrl: false };
}

async function saveNotifyConfig(config) {
  const target = notifyStatePath();
  const temp = target + '.tmp';
  await mkdir(join(homeDir(), 'storages', 'credit-expiry'), { recursive: true });
  await writeFile(temp, JSON.stringify({ schema: 1, url: config.url, kind: config.kind }), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, target);
}

/** Bounded body reader: a POST to this route is a small JSON object. */
function readBody(req, limit) {
  const cap = limit || 16384;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > cap) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
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
function normalizeWorkbuddy(usage, roster) {
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
      name: p.packageName || p.name || '积分包',
      remain: Number(p.remain) || 0,
      size: Number(p.size) || 0,
      expiresAtMs: finiteOrNull(p.expiresAtMs),
      monthly: !!p.monthly,
      /* A monthly package is the one grant that comes back: the platform refills
         it on cycleRefreshMs, so that date is a countdown no expiry date can
         express - it says "you regain this", not "you lose this". */
      resetAtMs: finiteOrNull(p.cycleRefreshMs)
    })),
    subscription: subscriptionOf(packages),
    checkin: usage.checkin ? {
      streakDays: usage.checkin.streakDays || 0,
      dailyCredit: usage.checkin.dailyCredit || 0,
      todayCheckedIn: !!usage.checkin.todayCheckedIn
    } : null,
    /* When the stored login dies, every pool turns into '读取失败' at once and
       the panel looks broken rather than signed out. */
    tokenExpiresAtMs: finiteOrNull(usage.tokenExpiresAtMs),
    /* Other signed-in accounts: the pool total is what actually expires, and this
       one call is the only place the rest of it is visible. */
    accounts: poolAccounts(usage, roster)
  };
}

/**
 * The recurring grant, when a pool has one. A subscription is not a balance:
 * the balance is spent down and refilled on a cycle, so the only two numbers
 * that matter are how much of the cycle allowance is left and when it refills.
 * Pools without a recurring package return null rather than a guessed cycle.
 */
function subscriptionOf(packages) {
  const list = Array.isArray(packages) ? packages : [];
  const monthly = list.filter((p) => p && p.monthly);
  if (!monthly.length) return null;
  let remain = 0;
  let size = 0;
  let resetAtMs = null;
  for (const pack of monthly) {
    remain += Number(pack.remain) || 0;
    size += Number(pack.size) || 0;
    const at = Number(pack.cycleRefreshMs);
    if (Number.isFinite(at) && at > 0 && (resetAtMs === null || at < resetAtMs)) resetAtMs = at;
  }
  return {
    cycle: 'monthly',
    label: monthly[0].packageName || monthly[0].name || '周期额度',
    remain: remain,
    size: size,
    resetAtMs: finiteOrNull(resetAtMs),
    expiresAtMs: null
  };
}

/**
 * The account roster route answers {accounts:[{id,accountName,selected,credits,
 * nearestExpiryMs,excludedBy}]}. Only the accounts that are not the one this
 * payload already reports are worth carrying, and a roster that failed must be
 * an empty list rather than a guess.
 */
function poolAccounts(usage, roster) {
  const list = roster && Array.isArray(roster.accounts) ? roster.accounts : [];
  const self = usage && usage.accountName ? String(usage.accountName) : '';
  const out = [];
  for (const entry of list) {
    if (!entry || entry.selected) continue;
    const name = entry.accountName ? String(entry.accountName) : '';
    if (self && name === self) continue;
    if (entry.excludedBy) continue;
    const credits = Number(entry.credits);
    if (!Number.isFinite(credits)) continue;
    out.push({
      name: name,
      credits: credits,
      expiresAtMs: finiteOrNull(entry.nearestExpiryMs),
      expiringSoon: Number(entry.expiringSoon) || 0
    });
  }
  out.sort((a, b) => b.credits - a.credits);
  return out;
}

/**
 * MiniMax Code reports a single balance plus an 'upcoming' expiry list, with no
 * per-package breakdown: every lot shares one expiry date, so the list is the
 * whole picture.
 */
function normalizeMinimax(usage) {
  const credits = usage.credits || {};
  const upcoming = Array.isArray(credits.upcoming) ? credits.upcoming : [];
  /* A lot with no expiry date is still credits the account can spend. Dropping
     it made the panel's MiniMax balance smaller than the platform's own page. */
  const lots = upcoming
    .filter((lot) => lot && (lot.amount !== undefined || lot.expireAtMs !== undefined))
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
    expiringSoon: Number(credits.expiringSoon) || 0,
    /* Qoder's only recurring date is the plan's: the credits live exactly as
       long as the subscription that granted them, so the plan date is both the
       reset and the cliff. Saying so beats a second 'no expiry' bucket. */
    subscription: planExpiry === null ? null : {
      cycle: 'plan',
      label: 'Qoder 订阅',
      remain: Number(credits.total) || 0,
      size: null,
      resetAtMs: null,
      expiresAtMs: planExpiry
    }
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
    tokenExpiresAtMs: finiteOrNull(usage.tokenExpiresAtMs),
    refreshExpiresAtMs: finiteOrNull(usage.refreshExpiresAtMs),
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
   * Same-origin base for the internal fetch, built from the server this plugin is
   * mounted on. It must NOT come from the request's Host header: that header is
   * caller controlled, and trusting it would let any local process point this
   * route at an arbitrary address and receive the caller's cookie along with it.
   */
  function origin() {
    const server = ctx.webServer;
    const port = server && typeof server.port === 'number' ? server.port : 0;
    if (!port) throw new Error('无法确定 DSH Web 端口：webServer.port 不可用');
    const secure = !!(server && typeof server.protocol === 'string' && server.protocol.indexOf('https') === 0);
    return (secure ? 'https://' : 'http://') + '127.0.0.1:' + port;
  }

  /** The only origin a credential is ever forwarded to: this very server. */
  function isLoopbackBase(base) {
    return base.indexOf('http://127.0.0.1:') === 0 || base.indexOf('https://127.0.0.1:') === 0;
  }

  /**
   * What a caller proves by asking. A caller on loopback is the local UI; anyone
   * else has to present the session cookie, because the ledger this route reads
   * (session titles, token counts) lives on disk and does not depend on who asks.
   */
  function callerIsTrusted(req) {
    const addr = req && req.socket && req.socket.remoteAddress;
    const local = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    if (local) return true;
    return !!(req && req.headers && req.headers.cookie);
  }

  async function readUsage(route, forwarded, timeoutMs) {
    const base = origin();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS);
    try {
      const headers = Object.assign({ accept: 'application/json' }, forwarded);
      const response = await fetch(base + route, { headers: headers, signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* The export route serves the last assembled payload: every export click
     would otherwise re-read four upstreams to answer a question the page just
     answered. */
  let lastBundle = null;

  /**
   * Push the panel's own summary to an IM webhook. Every mainstream Chinese IM
   * (企业微信 / 钉钉 / 飞书) and Slack accept a JSON POST with a text field; the
   * body is shaped per target so one stored URL works for all of them.
   */
  async function pushNotify(body) {
    const configured = await loadNotifyConfig();
    if (!configured.url) return { ok: false, error: '还没有配置推送地址' };
    const text = String(body.text || '').trim();
    if (!text) return { ok: false, error: '没有可推送的内容' };
    let payload = { msgtype: 'text', text: { content: text } };
    if (configured.kind === 'feishu') payload = { msg_type: 'text', content: { text: text } };
    else if (configured.kind === 'slack') payload = { text: text };
    else if (configured.kind === 'dingtalk') payload = { msgtype: 'text', text: { content: text } };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KEY_TIMEOUT_MS);
    try {
      const response = await fetch(configured.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const answer = await response.text();
      if (!response.ok) return { ok: false, error: 'HTTP ' + response.status + ' · ' + answer.slice(0, 120) };
      return { ok: true, kind: configured.kind, at: Date.now() };
    } catch (error) {
      const aborted = error && error.name === 'AbortError';
      return { ok: false, error: aborted ? '推送超时' : String((error && error.message) || error).slice(0, 120) };
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
      const tail = url.pathname.slice(PREFIX.length);
      if (tail !== '/data' && tail !== '/update' && tail !== '/export' && tail !== '/keys' && tail !== '/notify') {
        send(res, 404, { status: 'error', error: 'not found' });
        return;
      }
      /* Both routes cost something the caller has not paid for: /data reads the
         local ledger, /update fans out to four mirrors. Neither is open to
         everyone who can reach the port. */
      if (!callerIsTrusted(req)) {
        send(res, 401, { status: 'error', error: 'unauthorized' });
        return;
      }
      if (tail === '/update') {
        send(res, 200, await updateState(url.searchParams.get('force') === '1'));
        return;
      }
      /* Key management is a write, so it is the one route that insists on a
         same-origin JSON POST: a browser form cannot reach it without the
         caller already holding a session on this server. */
      if (tail === '/keys') {
        if (req.method === 'POST') {
          let body = null;
          try { body = JSON.parse(await readBody(req)); } catch { body = null; }
          if (!body || typeof body !== 'object') {
            send(res, 400, { status: 'error', error: 'body must be JSON' });
            return;
          }
          let accounts = await loadKeyState();
          if (body.action === 'add') {
            const entry = sanitizeAccount(Object.assign({ id: 'k' + Date.now().toString(36) }, body.account), accounts.length);
            if (!entry) {
              send(res, 400, { status: 'error', error: '需要 vendor 与 key，且 vendor 必须是支持的厂商之一' });
              return;
            }
            /* The same vendor may appear twice (a work key and a personal key),
               but the same key twice is a mistake, not a second account. */
            if (accounts.some((a) => a.key === entry.key && a.vendor === entry.vendor)) {
              send(res, 409, { status: 'error', error: '这个密钥已经添加过' });
              return;
            }
            if (accounts.length >= KEY_LIMIT) {
              send(res, 400, { status: 'error', error: '最多 ' + KEY_LIMIT + ' 个密钥' });
              return;
            }
            accounts.push(entry);
          } else if (body.action === 'remove') {
            const id = String(body.id || '');
            accounts = accounts.filter((a) => a.id !== id);
          } else {
            send(res, 400, { status: 'error', error: 'unknown action' });
            return;
          }
          await saveKeyState(accounts);
          send(res, 200, { status: 'ok', accounts: accounts.map(publicAccount) });
          return;
        }
        const accounts = await loadKeyState();
        send(res, 200, { status: 'ok', accounts: accounts.map(publicAccount), vendors: Object.keys(BALANCE_SOURCES).map((id) => ({ id: id, label: BALANCE_SOURCES[id].label })) });
        return;
      }
      if (tail === '/notify') {
        let body = null;
        try { body = JSON.parse(await readBody(req)); } catch { body = null; }
        const payloadBody = body || {};
        /* config: store or clear the webhook; anything else is a push. */
        if (payloadBody.action === 'config') {
          const raw = String(payloadBody.url || '').trim();
          if (!raw) {
            await saveNotifyConfig({ url: null, kind: null });
            send(res, 200, { status: 'ok', notify: { kind: null, hasUrl: false } });
            return;
          }
          if (!/^https:\/\//i.test(raw)) {
            send(res, 400, { status: 'error', error: '推送地址必须是 https 链接' });
            return;
          }
          const kind = NOTIFY_KINDS.indexOf(payloadBody.kind) >= 0 ? payloadBody.kind : notifyKindOf(raw);
          await saveNotifyConfig({ url: raw, kind: kind });
          send(res, 200, { status: 'ok', notify: { kind: kind, hasUrl: true } });
          return;
        }
        const result = await pushNotify(payloadBody);
        send(res, result.ok ? 200 : 400, result);
        return;
      }
      /* The export answers the same question /data does, so it is answered from
         the same reads - but as a file download rather than a JSON body. */
      if (tail === '/export') {
        const wanted = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
        const bundle = lastBundle;
        if (!bundle) {
          send(res, 503, { status: 'error', error: 'no data yet, open /data first' });
          return;
        }
        if (wanted === 'json') {
          send(res, 200, bundle);
          return;
        }
        const body = usageCsv(bundle.usage, bundle);
        res.writeHead(200, {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="credit-expiry-' + new Date().toISOString().slice(0, 10) + '.csv"',
          'cache-control': 'no-store',
          'content-length': Buffer.byteLength(body)
        });
        res.end(body);
        return;
      }
      /* Only the caller's own credentials are forwarded, and only to loopback;
         an API-key session has no cookie and would otherwise read as signed out. */
      const forwarded = {};
      const incoming = req.headers || {};
      for (const header of ['cookie', 'authorization', 'x-api-key']) {
        if (typeof incoming[header] === 'string' && incoming[header]) forwarded[header] = incoming[header];
      }
      const payload = { updatedAt: Date.now(), errors: [], wb: null, tr: null, mm: null, qd: null, usage: null };
      const results = await Promise.allSettled([
        readUsage(ROUTES.wb, forwarded),
        readUsage(ROUTES.tr, forwarded),
        readUsage(ROUTES.mm, forwarded),
        readUsage(ROUTES.qd, forwarded),
        readUsage(ROUTES.wbAccounts, forwarded, ACCOUNT_TIMEOUT_MS),
        readLedger(),
        priceState(),
        loadKeyState(),
        loadNotifyConfig()
      ]);
      const wbResult = results[0];
      const trResult = results[1];
      const mmResult = results[2];
      const qdResult = results[3];
      const wbPoolResult = results[4];
      const usageResult = results[5];
      const priceResult = results[6];
      const keyResult = results[7];
      const notifyResult = results[8];

      if (wbResult.status === 'fulfilled') {
        /* The account roster is a second, slower call; when it answers it adds the
           other signed-in accounts, which the single-account payload cannot see. */
        payload.wb = normalizeWorkbuddy(wbResult.value, wbPoolResult.status === 'fulfilled' ? wbPoolResult.value : null);
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

      /* Cash balances behind API keys: read at most once per poll, and a
         failing vendor only costs its own card. */
      if (keyResult.status === 'fulfilled' && keyResult.value.length) {
        payload.keys = await readBalances(keyResult.value);
      } else {
        payload.keys = [];
        if (keyResult.status !== 'fulfilled') {
          const reason = keyResult.reason;
          payload.errors.push('密钥余额: ' + String((reason && reason.message) || reason));
        }
      }
      if (notifyResult.status === 'fulfilled') {
        payload.notify = { kind: notifyResult.value.kind, hasUrl: notifyResult.value.hasUrl };
      }

      lastBundle = payload;
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
