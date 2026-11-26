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
 *      split. Prices are fetched live from three places, in order: each vendor's
 *      own pricing page (PRICE_SOURCES), the models.dev catalogue (which fills in
 *      models a vendor page does not list), and a live USD/CNY rate. All three
 *      are cached and persisted, so the panel still renders offline.
 *
 * Usage is scoped to the credit pools only: DeepSeek direct and the CLI proxies
 * are cash spend and would otherwise dominate a panel about expiring credits.
 */

import { readFileSync } from 'node:fs';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BALANCE_SOURCES, KEY_LIMIT, KEY_TIMEOUT_MS } from './vendors.js';

export const name = 'dsh-credit-expiry';

/** Array form only: this Cordis reads an object's KEYS as service names. */
export const inject = ['webServer', 'credentials', 'connection'];

const PREFIX = '/credit-expiry/api';
const ROUTES = {
  wb: '/plugins/dsh-connect-workbuddy/usage',
  tr: '/plugins/dsh-connect-trae/usage',
  mm: '/plugins/dsh-connect-minimaxcode/status',
  qd: '/plugins/dsh-connect-qoder/usage',
  db: '/plugins/dsh-connect-doubao/quota',
  /* WorkBuddy is the one pool that can hold several signed-in accounts; the
     per-account roster lives on its own (slower) route. */
  wbAccounts: '/plugins/dsh-connect-workbuddy/account-credits'
};
const TIMEOUT_MS = 8000;
const ACCOUNT_TIMEOUT_MS = 5000;
/* The chart offers 7 / 14 / 30 days, so the daily series has to cover the widest
   option: a 30-day button over 14 days of data would be a lie in the UI. */
const DAILY_WINDOW = 30;
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
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
  /* 2027: New Year, Spring Festival, Qingming, Labour Day, Dragon Boat,
     Mid-Autumn and National Day. Configurable via ledger.config.peakHolidays. */
  '2027-01-01', '2027-01-02', '2027-01-03',
  '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11', '2027-02-12',
  '2027-04-04', '2027-04-05', '2027-04-06',
  '2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04', '2027-05-05',
  '2027-06-09', '2027-06-10', '2027-06-11',
  '2027-09-15', '2027-09-16', '2027-09-17',
  '2027-10-01', '2027-10-02', '2027-10-03', '2027-10-04', '2027-10-05', '2027-10-06', '2027-10-07'
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

function uniqueTempPath(target) {
  return target + '.' + process.pid + '.' + Math.random().toString(36).slice(2) + '.tmp';
}

function readService(ctx, serviceName) {
  if (!ctx) return null;
  if (typeof ctx.get === 'function') {
    try {
      const svc = ctx.get(serviceName);
      if (svc) return svc;
    } catch {
      /* ignore */
    }
  }
  try {
    return ctx[serviceName] || null;
  } catch {
    return null;
  }
}

function credentialText(val) {
  if (typeof val === 'string') return val.trim();
  if (val && typeof val.value === 'string') return val.value.trim();
  return '';
}

async function savePriceState(state) {
  const target = priceStatePath();
  const temp = uniqueTempPath(target);
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

function keyStatePath() {
  return join(homeDir(), 'storages', 'credit-expiry', 'keys.json');
}

/** A masked key is the only form that ever leaves this process. */
function maskKey(key) {
  const text = String(key || '');
  if (text.length <= 4) return text ? '****' : '';
  return '****' + text.slice(-4);
}

const DEFAULT_SILICONFLOW_MODELS = [
  { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3' },
  { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1' },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B-Instruct' },
  { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen2.5-Coder-32B-Instruct' },
  { id: 'Qwen/QwQ-32B', name: 'QwQ-32B' },
  { id: 'Pro/deepseek-ai/DeepSeek-V3', name: 'Pro/DeepSeek-V3' },
  { id: 'Pro/deepseek-ai/DeepSeek-R1', name: 'Pro/DeepSeek-R1' }
];

const VENDOR_DSH_SYNC = {
  deepseek: {
    primaryRef: 'DEEPSEEK_API_KEY',
    refs: ['DEEPSEEK_API_KEY'],
    piAiRoutes: ['deepseek'],
    urlPattern: /api\.deepseek\.com/i
  },
  siliconflow: {
    primaryRef: 'SILICONFLOW_API_KEY',
    refs: ['SILICONFLOW_API_KEY', 'SILICONFLOW_CN_API_KEY'],
    piAiRoutes: ['siliconflow', 'siliconflow-cn'],
    urlPattern: /siliconflow\.(cn|com)/i,
    customProfile: {
      route: 'siliconflow',
      displayName: '硅基流动 SiliconFlow',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      api: 'openai-completions',
      baseURL: 'https://api.siliconflow.cn/v1'
    }
  },
  moonshot: {
    primaryRef: 'MOONSHOT_API_KEY',
    refs: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    piAiRoutes: ['moonshotai-cn', 'moonshotai', 'kimi-for-coding'],
    catalogRoute: 'moonshotai-cn',
    urlPattern: /moonshot\.(cn|ai)/i
  },
  zhipu: {
    primaryRef: 'ZHIPU_API_KEY',
    refs: ['ZHIPU_API_KEY', 'GLM_API_KEY', 'BIGMODEL_API_KEY'],
    piAiRoutes: ['zai-coding-cn', 'zhipuai', 'zhipuai-coding-plan', 'zai'],
    catalogRoute: 'zai-coding-cn',
    urlPattern: /bigmodel\.cn|api\.z\.ai/i
  },
  xiaomi: {
    primaryRef: 'MIMO_API_KEY',
    refs: ['MIMO_API_KEY', 'XIAOMI_API_KEY'],
    piAiRoutes: ['xiaomi'],
    catalogRoute: 'xiaomi',
    urlPattern: /xiaomimimo\.com/i
  },
  openrouter: {
    primaryRef: 'OPENROUTER_API_KEY',
    refs: ['OPENROUTER_API_KEY'],
    piAiRoutes: ['openrouter'],
    catalogRoute: 'openrouter',
    urlPattern: /openrouter\.ai/i
  }
};

function sanitizeAccount(entry, index) {
  const vendor = String(entry && entry.vendor ? entry.vendor : '').toLowerCase();
  const source = BALANCE_SOURCES[vendor];
  if (!source) return null;
  let key = String(entry && entry.key ? entry.key : '').trim().replace(/^['"]+|['"]+$/g, '');
  if (source.authType !== 'aksk') key = key.replace(/^Bearer\s+/i, '').trim();
  if (!key) return null;
  const secret = entry && entry.secret ? String(entry.secret).trim().replace(/^['"]+|['"]+$/g, '') : '';
  if ((source.authType === 'aksk' || source.authType === 'teamkey') && !secret) return null;
  const rawManual = entry && entry.manualBalance !== undefined && entry.manualBalance !== null && entry.manualBalance !== ''
    ? Number(entry.manualBalance)
    : NaN;
  return {
    id: String(entry && entry.id ? entry.id : vendor + '-' + index),
    label: String(entry && entry.label ? entry.label : source.label).slice(0, 40),
    vendor: vendor,
    key: key,
    secret: secret || undefined,
    currency: entry && entry.currency ? String(entry.currency).toUpperCase() : null,
    manualBalance: Number.isFinite(rawManual) && rawManual >= 0 ? rawManual : null
  };
}

async function loadKeyStateWithMeta() {
  try {
    const parsed = JSON.parse(await readFile(keyStatePath(), 'utf8'));
    if (parsed && parsed.schema === KEY_STATE_SCHEMA && Array.isArray(parsed.accounts)) {
      const accounts = parsed.accounts.map(sanitizeAccount).filter(Boolean);
      const dismissed = Array.isArray(parsed.dismissed)
        ? parsed.dismissed.filter((x) => typeof x === 'string' && x)
        : [];
      const syncedTokens = Array.isArray(parsed.syncedTokens)
        ? parsed.syncedTokens.filter((x) => typeof x === 'string' && x)
        : [];
      const dshDetached = Array.isArray(parsed.dshDetached)
        ? parsed.dshDetached.filter((x) => typeof x === 'string' && x)
        : [];
      return {
        accounts,
        dismissed,
        syncDsh: parsed.syncDsh !== false,
        syncedTokens,
        dshDetached
      };
    }
  } catch {
    /* no file yet */
  }
  return { accounts: [], dismissed: [], syncDsh: true, syncedTokens: [], dshDetached: [] };
}

async function loadKeyState() {
  const state = await loadKeyStateWithMeta();
  return state.accounts;
}

async function saveKeyState(accounts, dismissed, extra) {
  const cur = await loadKeyStateWithMeta();
  const keepDismissed = Array.isArray(dismissed) ? dismissed : cur.dismissed;
  const opts = extra || {};
  const keepSyncDsh = opts.syncDsh !== undefined ? !!opts.syncDsh : cur.syncDsh;
  const keepSynced = Array.isArray(opts.syncedTokens) ? opts.syncedTokens : cur.syncedTokens;
  const keepDetached = Array.isArray(opts.dshDetached) ? opts.dshDetached : cur.dshDetached;
  const target = keyStatePath();
  const temp = uniqueTempPath(target);
  await mkdir(join(homeDir(), 'storages', 'credit-expiry'), { recursive: true });
  await writeFile(
    temp,
    JSON.stringify({
      schema: KEY_STATE_SCHEMA,
      syncDsh: keepSyncDsh,
      accounts: accounts,
      dismissed: keepDismissed,
      syncedTokens: keepSynced,
      dshDetached: keepDetached
    }),
    { encoding: 'utf8', mode: 0o600 }
  );
  try {
    await rename(temp, target);
  } catch (err) {
    await unlink(temp).catch(() => {});
    throw err;
  }
}

async function fetchSiliconFlowDshModels(apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch('https://api.siliconflow.cn/v1/models?type=text&sub_type=chat', {
      headers: { authorization: 'Bearer ' + apiKey, accept: 'application/json' },
      signal: controller.signal
    });
    if (res && res.ok) {
      const body = await res.json().catch(() => null);
      const list = body && Array.isArray(body.data) ? body.data : [];
      const seen = new Set();
      const models = [];
      for (const m of DEFAULT_SILICONFLOW_MODELS) {
        seen.add(m.id);
        models.push({ id: m.id, name: m.name });
      }
      for (const item of list) {
        const id = item && typeof item.id === 'string' ? item.id.trim() : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        models.push({ id: id, name: id });
        if (models.length >= 60) break;
      }
      if (models.length) return models;
    }
  } catch {
    /* fallback to default curated model list */
  } finally {
    clearTimeout(timer);
  }
  return DEFAULT_SILICONFLOW_MODELS.map((m) => ({ id: m.id, name: m.name }));
}

/**
 * Two-way synchronization between this plugin's local key store and DSH host
 * settings (ctx.credentials + llm-pi-ai provider config in ctx.settings).
 * - Keys configured only in DSH Settings are imported into keys.json so their
 *   balances/quotas are automatically tracked.
 * - Keys configured in this plugin are written to ctx.credentials and, for
 *   providers like SiliconFlow that require a provider block in llm-pi-ai,
 *   registered in ctx.settings so DSH Settings -> Models can call them directly.
 */
let keyStateQueue = Promise.resolve();
let lastKeySyncAt = 0;
let lastKeySyncHome = '';
const KEY_SYNC_TTL_MS = 5 * 60 * 1000;

function withKeyStateLock(task) {
  const next = keyStateQueue.then(task, task);
  keyStateQueue = next.then(() => {}, () => {});
  return next;
}

function invalidateKeySync() {
  lastKeySyncAt = 0;
}

function syncKeysWithDsh(ctx, force) {
  return withKeyStateLock(async () => {
    const home = homeDir();
    const now = Date.now();
    if (!force && lastKeySyncHome === home && lastKeySyncAt > 0 && now - lastKeySyncAt < KEY_SYNC_TTL_MS) {
      const state = await loadKeyStateWithMeta();
      return state.accounts;
    }
    const accounts = await syncKeysWithDshImpl(ctx);
    lastKeySyncHome = home;
    lastKeySyncAt = Date.now();
    return accounts;
  });
}

async function syncKeysWithDshImpl(ctx) {
  const state = await loadKeyStateWithMeta();
  let accounts = state.accounts;
  const dismissedSet = new Set(state.dismissed);
  const syncedSet = new Set(state.syncedTokens || []);
  const detachedSet = new Set(state.dshDetached || []);
  if (!ctx || state.syncDsh === false) return accounts;

  const credentials = readService(ctx, 'credentials');
  const settings = readService(ctx, 'settings');

  let piAiBlock = null;
  let userProviders = {};
  if (settings && typeof settings.describe === 'function') {
    try {
      const blocks = await Promise.resolve(settings.describe());
      if (Array.isArray(blocks)) {
        piAiBlock = blocks.find((b) => b && b.ns === 'llm-pi-ai') || null;
        const userObj = (piAiBlock && piAiBlock.user && typeof piAiBlock.user === 'object') ? piAiBlock.user : null;
        const valObj = (piAiBlock && piAiBlock.value && typeof piAiBlock.value === 'object') ? piAiBlock.value : null;
        userProviders = Object.assign(
          {},
          (valObj && valObj.providers && typeof valObj.providers === 'object') ? valObj.providers : {},
          (userObj && userObj.providers && typeof userObj.providers === 'object') ? userObj.providers : {}
        );
      }
    } catch {
      piAiBlock = null;
    }
  }

  /* 1. DSH Settings -> Plugin: import keys configured in DSH credentials and snapshot what DSH currently holds */
  let stateDirty = false;
  const dshKeysByVendor = {};
  if (credentials) {
    for (const [vendor, spec] of Object.entries(VENDOR_DSH_SYNC)) {
      const refCandidates = new Set(spec.refs || []);
      for (const route of (spec.piAiRoutes || [])) {
        const prof = userProviders[route];
        if (prof && typeof prof.apiKeyEnv === 'string' && prof.apiKeyEnv.trim()) {
          refCandidates.add(prof.apiKeyEnv.trim());
        }
      }
      if (spec.urlPattern) {
        for (const prof of Object.values(userProviders)) {
          if (prof && typeof prof.baseURL === 'string' && spec.urlPattern.test(prof.baseURL)) {
            if (typeof prof.apiKeyEnv === 'string' && prof.apiKeyEnv.trim()) {
              refCandidates.add(prof.apiKeyEnv.trim());
            }
          }
        }
      }
      const presentKeys = new Set();
      let foundKey = '';
      if (typeof credentials.resolve === 'function') {
        for (const ref of refCandidates) {
          try {
            const resolved = credentialText(await Promise.resolve(credentials.resolve(ref)));
            if (resolved) {
              presentKeys.add(resolved);
              if (!foundKey) foundKey = resolved;
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (!foundKey && typeof credentials.readRecord === 'function') {
        for (const route of (spec.piAiRoutes || [])) {
          try {
            const rec = await Promise.resolve(credentials.readRecord('llm-pi-ai/' + route));
            if (rec && typeof rec.access === 'string' && rec.access.trim()) {
              const trimmed = rec.access.trim();
              presentKeys.add(trimmed);
              if (!foundKey) foundKey = trimmed;
            }
          } catch {
            /* ignore */
          }
        }
      }
      dshKeysByVendor[vendor] = presentKeys;
      if (!foundKey) continue;
      const baseId = 'k-dsh-' + vendor;
      const dshId = accounts.some((a) => a.id === baseId)
        ? (baseId + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5))
        : baseId;
      const entry = sanitizeAccount({
        id: dshId,
        vendor: vendor,
        key: foundKey
      }, accounts.length);
      if (!entry) continue;
      const token = vendor + ':' + maskKey(entry.key);
      if (!syncedSet.has(token)) {
        syncedSet.add(token);
        stateDirty = true;
      }
      if (detachedSet.delete(token)) stateDirty = true;
      if (dismissedSet.has(token)) continue;
      if (accounts.some((a) => a.vendor === vendor && a.key === entry.key)) continue;
      if (accounts.length >= KEY_LIMIT) continue;
      accounts.push(entry);
      stateDirty = true;
    }
  }

  /* Detect keys that were previously synced with DSH and later removed inside DSH Settings:
     do NOT rewrite them back into DSH, and drop auto-imported k-dsh-* entries cleanly. */
  const keptAccounts = [];
  for (const acc of accounts) {
    const spec = VENDOR_DSH_SYNC[acc.vendor];
    if (!spec || !acc.key || !credentials) {
      keptAccounts.push(acc);
      continue;
    }
    const token = acc.vendor + ':' + maskKey(acc.key);
    const presentSet = dshKeysByVendor[acc.vendor] || new Set();
    const dshHasKey = presentSet.has(acc.key);
    if (dshHasKey) {
      if (!syncedSet.has(token)) { syncedSet.add(token); stateDirty = true; }
      if (detachedSet.delete(token)) stateDirty = true;
      keptAccounts.push(acc);
      continue;
    }
    const wasSynced = syncedSet.has(token) || acc.id.startsWith('k-dsh-');
    if (wasSynced) {
      if (syncedSet.delete(token)) stateDirty = true;
      if (!detachedSet.has(token)) { detachedSet.add(token); stateDirty = true; }
      if (acc.id.startsWith('k-dsh-')) {
        stateDirty = true;
        continue;
      }
      keptAccounts.push(acc);
      continue;
    }
    keptAccounts.push(acc);
  }
  accounts = keptAccounts;

  /* 2. Plugin -> DSH Settings: push newly-added / active plugin keys into DSH credentials & llm-pi-ai */
  for (const acc of accounts) {
    const spec = VENDOR_DSH_SYNC[acc.vendor];
    if (!spec || !acc.key) continue;
    const token = acc.vendor + ':' + maskKey(acc.key);
    if (detachedSet.has(token)) continue;
    const targetRefs = new Set([spec.primaryRef]);
    for (const route of (spec.piAiRoutes || [])) {
      const prof = userProviders[route];
      if (prof && typeof prof.apiKeyEnv === 'string' && prof.apiKeyEnv.trim()) {
        targetRefs.add(prof.apiKeyEnv.trim());
      }
    }
    let pushedToCreds = false;
    if (credentials && typeof credentials.set === 'function') {
      for (const ref of targetRefs) {
        try {
          const current = typeof credentials.resolve === 'function'
            ? credentialText(await Promise.resolve(credentials.resolve(ref)))
            : '';
          if (current !== acc.key) {
            await Promise.resolve(credentials.set(ref, acc.key));
            pushedToCreds = true;
          }
        } catch {
          /* ignore */
        }
      }
    }
    if ((pushedToCreds || (dshKeysByVendor[acc.vendor] && dshKeysByVendor[acc.vendor].has(acc.key))) && !syncedSet.has(token)) {
      syncedSet.add(token);
      stateDirty = true;
    }
    if (settings && typeof settings.mutate === 'function' && piAiBlock) {
      if (spec.customProfile) {
        const route = spec.customProfile.route;
        const existing = userProviders[route];
        const hasValidModels = existing && Array.isArray(existing.models) && existing.models.length > 0;
        const needsSetup = !existing || !existing.api || !existing.baseURL || !existing.apiKeyEnv || !hasValidModels;
        if (needsSetup) {
          const models = hasValidModels ? existing.models : await fetchSiliconFlowDshModels(acc.key);
          const profile = {
            displayName: (existing && existing.displayName) || spec.customProfile.displayName,
            apiKeyEnv: (existing && existing.apiKeyEnv) || spec.customProfile.apiKeyEnv,
            api: (existing && existing.api) || spec.customProfile.api,
            baseURL: (existing && existing.baseURL) || spec.customProfile.baseURL,
            models: models
          };
          try {
            await Promise.resolve(settings.mutate('llm-pi-ai', [
              { op: 'set', path: ['providers', route], value: profile }
            ]));
            userProviders[route] = profile;
          } catch {
            /* ignore if schema rejects or settings read-only */
          }
        }
      } else if (spec.catalogRoute) {
        const hasAny = (spec.piAiRoutes || []).some((r) => userProviders[r]);
        if (!hasAny) {
          const profile = { apiKeyEnv: spec.primaryRef };
          try {
            await Promise.resolve(settings.mutate('llm-pi-ai', [
              { op: 'set', path: ['providers', spec.catalogRoute], value: profile }
            ]));
            userProviders[spec.catalogRoute] = profile;
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  if (stateDirty) {
    await saveKeyState(accounts, Array.from(dismissedSet), {
      syncDsh: state.syncDsh,
      syncedTokens: Array.from(syncedSet),
      dshDetached: Array.from(detachedSet)
    });
  }

  return accounts;
}

/** What the panel may see about a configured account. */
function publicAccount(entry) {
  const source = BALANCE_SOURCES[entry.vendor] || {};
  return {
    id: entry.id,
    label: entry.label,
    vendor: entry.vendor,
    vendorLabel: source.label || entry.vendor,
    authType: source.authType || 'bearer',
    keysUrl: source.keysUrl || null,
    masked: maskKey(entry.key),
    secretMasked: entry.secret ? maskKey(entry.secret) : null,
    currency: entry.currency || null,
    manualBalance: typeof entry.manualBalance === 'number' && Number.isFinite(entry.manualBalance) ? entry.manualBalance : null
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
      if (typeof source.fetchBalance === 'function') {
        const res = await source.fetchBalance(entry, controller.signal);
        if (!res || res.error) {
          record.error = (res && res.error) || '读取失败';
          return;
        }
        if (entry.currency && res.balance && res.balance.currency !== 'PCT') res.balance.currency = entry.currency;
        record.balance = res.balance;
        return;
      }
      const response = await fetch(source.url, {
        headers: {
          authorization: 'Bearer ' + entry.key,
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0 (compatible; DSH-CreditExpiry/1.0)'
        },
        signal: controller.signal
      });
      const text = await response.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      const detail = parsed ? String(parsed.message || parsed.msg || (parsed.error && parsed.error.message) || parsed.error || '').slice(0, 100) : '';
      if (!response.ok) {
        /* 401 is the one failure worth naming precisely: it means the key
           itself is wrong, not that the vendor is down. */
        record.error = response.status === 401
          ? ('密钥无效或已撤销' + (detail ? '（' + detail + '）' : ''))
          : ('HTTP ' + response.status + (detail ? '：' + detail : ''));
        return;
      }
      const balance = parsed ? source.parse(parsed) : null;
      if (!balance) {
        record.error = detail || '无法解析该厂商的余额响应';
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
  const known = versionMemo && versionMemo.latest ? versionMemo : null;
  if (known) {
    versionMemo = {
      current: current,
      latest: known.latest,
      hasUpdate: versionGt(known.latest, current),
      publishedAt: known.publishedAt,
      commit: known.commit,
      checkedAt: now,
      source: known.source,
      url: RELEASES_URL,
      error: '无法访问索引源（离线或网络受限）'
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
let priceBgRefresh = null;

function buildPriceState(now, disk, live) {
  const previous = normalizeTable(disk && disk.table);
  const liveTable = live ? live.table : {};
  const liveVendors = live ? live.vendors : [];
  const table = Object.assign({}, FALLBACK_PRICES, previous, liveTable);
  const anyLive = liveVendors.length > 0;
  const originOf = (vendor) => (liveVendors.indexOf(vendor) !== -1 ? 'live'
    : (disk && disk.table && Object.values(disk.table).some((row) => row && row.vendor === vendor) ? 'cache' : 'bundled'));
  const catalogLive = !!(live && live.catalog && Object.keys(live.catalog).length);
  const catalogRows = live && live.catalog ? Object.keys(live.catalog).length : (disk && disk.catalogRows) || 0;
  const fxRate = live && live.fx && live.fx.rate > 0 ? live.fx.rate : ((disk && disk.fxRate) || BUNDLED_FX);
  return {
    fetchedAt: anyLive || catalogLive ? now : ((disk && disk.fetchedAt) || 0),
    table: table,
    source: anyLive || catalogLive ? 'official' : ((disk && disk.source) || 'bundled'),
    live: liveVendors.length === 3,
    vendorSource: { deepseek: originOf('deepseek'), zhipu: originOf('zhipu'), minimax: originOf('minimax') },
    catalog: { rows: catalogRows, live: catalogLive },
    fx: { rate: fxRate, live: !!(live && live.fx && live.fx.live) },
    retryAfter: live ? (anyLive || catalogLive ? 0 : now + PRICE_RETRY_MS) : 0,
    vendors: liveVendors.length ? liveVendors : ((disk && disk.vendors) || []),
    errors: live ? live.errors : []
  };
}

function refreshPricesInBackground(disk) {
  if (priceBgRefresh) return priceBgRefresh;
  priceBgRefresh = (async () => {
    try {
      const now = Date.now();
      const live = await fetchPrices();
      const previous = normalizeTable(disk && disk.table);
      const state = buildPriceState(now, disk, live);
      priceMemo = state;
      if (live.vendors.length > 0 || (live.catalog && Object.keys(live.catalog).length)) {
        await savePriceState({
          schema: PRICE_CACHE_SCHEMA,
          fetchedAt: state.fetchedAt,
          table: Object.assign({}, previous, live.table),
          source: state.source,
          vendors: live.vendors,
          catalogRows: state.catalog.rows,
          fxRate: state.fx.rate
        });
      }
    } catch {
      /* background refresh never breaks panel rendering */
    } finally {
      priceBgRefresh = null;
    }
  })();
  return priceBgRefresh;
}

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
  /* Stale-while-revalidate: if a persisted price table already exists, serve it
     immediately so opening the sidebar never blocks 20s waiting on the 6MB
     models.dev catalogue, and refresh silently in the background. */
  if (disk && disk.table && Object.keys(disk.table).length > 0) {
    const staleState = buildPriceState(now, disk, null);
    if (priceMemo && priceMemo.retryAfter > now) staleState.retryAfter = priceMemo.retryAfter;
    priceMemo = staleState;
    if (now - (disk.fetchedAt || 0) >= PRICE_TTL_MS && !(now < staleState.retryAfter)) {
      refreshPricesInBackground(disk);
    }
    return priceMemo;
  }
  const live = await fetchPrices();
  /* Only a table this version wrote is worth merging. A cache from the older
     OpenRouter-format build holds USD numbers under the same model ids, and
     merging those would price CNY calls at a sixth of their real rate. */
  const previous = normalizeTable(disk && disk.table);
  const state = buildPriceState(now, disk, live);
  const anyLive = live.vendors.length > 0;
  const catalogLive = !!(live.catalog && Object.keys(live.catalog).length);
  priceMemo = state;
  if (anyLive || catalogLive) {
    await savePriceState({
      schema: PRICE_CACHE_SCHEMA,
      fetchedAt: state.fetchedAt,
      table: Object.assign({}, previous, live.table),
      source: state.source,
      vendors: live.vendors,
      catalogRows: state.catalog.rows,
      fxRate: state.fx.rate
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

function bjDateStr(ms) {
  return new Date((ms || Date.now()) + BJ_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Pad the trailing window with empty calendar days. The ledger only lists days
 * that had calls, so a two-day gap would otherwise render as two adjacent bars -
 * a chart that quietly claims there was activity when there was none.
 */
function fillDays(rows, windowSize) {
  if (!rows.length) return rows;
  const last = rows[rows.length - 1].date;
  const lastMs = new Date(last + 'T00:00:00Z').getTime();
  if (!Number.isFinite(lastMs)) return rows.slice(-windowSize);
  const todayStr = bjDateStr(Date.now());
  const todayMs = new Date(todayStr + 'T00:00:00Z').getTime();
  /* Extend to Beijing 'today' when the ledger is recent (within 60 days), so
     idle days since the last call count as zero rather than freezing the window
     on an older active day; far-older synthetic test fixtures keep their own end. */
  const end = (Number.isFinite(todayMs) && todayMs >= lastMs && (todayMs - lastMs) <= 60 * DAY_MS)
    ? todayMs
    : lastMs;
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
      byPool: {},
      byPoolTokens: {},
      byPoolCalls: {}
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
  if (Number.isFinite(Number(raw.costCny)) && Number(raw.costCny) > 0) {
    target.costCny = (target.costCny || 0) + Number(raw.costCny);
  }
  if (Number.isFinite(Number(raw.cost)) && Number(raw.cost) > 0) {
    target.cost = (target.cost || 0) + Number(raw.cost);
  }
  return target;
}

/**
 * What a day reports beyond the sessions already counted. The ledger normally
 * leaves a small tail behind (calls that never got attached to a session), and
 * that tail must still be priced instead of silently vanishing.
 */
function subtractRaw(total, seen) {
  const rest = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, costCny: 0, cost: 0 };
  for (const field of ['input', 'output', 'cacheRead', 'cacheWrite', 'calls', 'costCny', 'cost']) {
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
  const providerLimit = clampLimit(opts.providerLimit, PROVIDER_LIMIT);
  const sessionLimit = clampLimit(opts.sessionLimit, SESSION_LIMIT);
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

  function atomOf(date, key, raw, peak, share, sessionId) {
    const parts = splitKey(key);
    const pool = PROVIDER_POOL[parts.provider];
    const free = multipliers[parts.model.toLowerCase()] === 0
      || (/(?:^|[-_:]|\d)free$/i.test(parts.model) && !(Number(raw.costCny) > 0) && !(Number(raw.cost) > 0));
    const price = lookupPrice(prices.table, parts.model);
    const tokens = tokensOf(raw);
    let costCny = 0;
    let priced = !!price;
    if (!free) {
      if (Number.isFinite(Number(raw.costCny)) && Number(raw.costCny) > 0) {
        costCny = Number(raw.costCny);
        priced = true;
      } else if (price) {
        costCny = priceBlend(raw, price, peak, share);
        priced = true;
      } else if (Number.isFinite(Number(raw.cost)) && Number(raw.cost) > 0) {
        const fxRate = (prices.fx && prices.fx.rate > 0) ? prices.fx.rate : BUNDLED_FX;
        costCny = Number(raw.cost) * fxRate;
        priced = true;
      } else {
        missing[parts.model] = (missing[parts.model] || 0) + tokens;
      }
    }
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
      sessionId: sessionId || null,
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
      priced: priced,
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
        bestScore: -1,
        peakCalls: peak ? 0 : 0,
        paidCalls: 0,
        pricedCalls: 0,
        pools: [],
        byPool: {}
      };
      for (const key of Object.keys(perModel)) {
        const parts = splitKey(key);
        if (!CREDIT_PROVIDER_SET.has(parts.provider)) continue;
        const raw = perModel[key] || {};
        const atom = atomOf(date, key, raw, peak, null, session.id);
        atoms.push(atom);
        addRaw(seen[key] || (seen[key] = {}), raw);
        const slot = slots[key] || (slots[key] = { peak: 0, idle: 0 });
        if (peak) slot.peak += atom.tokens;
        else slot.idle += atom.tokens;
        record.calls += atom.calls;
        record.tokens += atom.tokens;
        record.costCny += atom.costCny;
        if (!atom.free) record.paidCalls += atom.calls;
        if (atom.priced) record.pricedCalls += atom.calls;
        if (peak) record.peakCalls += atom.calls;
        record.byPool[atom.pool] = (record.byPool[atom.pool] || 0) + atom.costCny;
        if (record.pools.indexOf(atom.pool) < 0) record.pools.push(atom.pool);
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

  /* Sessions can reuse an id across days, so key the lookup by date + id. */
  const sessionBy = new Map(sessionRecords.map((r) => [r.date + '|' + r.id, r]));

  /* Pass 3: roll the atoms up into days, providers and sessions. */
  const daily = dates.map((date) => ({
    date: date,
    calls: 0,
    tokens: 0,
    costCny: 0,
    credits: 0,
    peakTokens: 0,
    idleTokens: 0,
    byPool: {},
    byPoolTokens: {},
    byPoolCalls: {}
  }));
  const dailyByDate = new Map(daily.map((row) => [row.date, row]));
  const providers = new Map();

  for (const atom of atoms) {
    const credits = creditsOf(atom);
    if (atom.sessionId) {
      const rec = sessionBy.get(atom.date + '|' + atom.sessionId);
      if (rec) {
        rec.credits += credits;
        const score = credits > 0 ? credits * 1000 : (atom.costCny > 0 ? atom.costCny : atom.tokens / 1e6);
        if (score > rec.bestScore) {
          rec.bestScore = score;
          rec.top = atom.key;
        }
      }
    }
    const row = dailyByDate.get(atom.date);
    if (row) {
      row.calls += atom.calls;
      row.tokens += atom.tokens;
      row.costCny += atom.costCny;
      row.credits += credits;
      row.peakTokens += atom.tokens * atom.peakShare;
      row.idleTokens += atom.tokens * (1 - atom.peakShare);
      row.byPool[atom.pool] = (row.byPool[atom.pool] || 0) + credits;
      row.byPoolTokens[atom.pool] = (row.byPoolTokens[atom.pool] || 0) + atom.tokens;
      row.byPoolCalls[atom.pool] = (row.byPoolCalls[atom.pool] || 0) + atom.calls;
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
    record.peak = record.peakCalls > 0;
    record.free = record.paidCalls === 0 && record.calls > 0;
    record.priced = record.pricedCalls > 0 || record.free;
    record.creditsUnavailable = !record.free && record.credits === 0 && (record.costCny > 0 || record.tokens > 0)
      && record.pools.some((p) => pools[p] && pools[p].estimated);
    delete record.byPool;
    delete record.best;
    delete record.bestScore;
    delete record.peakCalls;
    delete record.paidCalls;
    delete record.pricedCalls;
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

  /* Burn rate per pool: what the trailing 7 calendar days actually cost, in the
     platform's own credits. Use the calendar-filled series so idle days inside
     the week dilute the average instead of pulling older active days into the
     window. */
  const dailyFilled = fillDays(daily, DAILY_WINDOW);
  const burn = {};
  const recent = dailyFilled.slice(-7);
  let burnDays = 0;
  if (dates.length && recent.length) {
    const firstMs = new Date(dates[0] + 'T00:00:00Z').getTime();
    const endMs = new Date(recent[recent.length - 1].date + 'T00:00:00Z').getTime();
    const span = (Number.isFinite(firstMs) && Number.isFinite(endMs) && endMs >= firstMs)
      ? Math.floor((endMs - firstMs) / DAY_MS) + 1
      : dates.length;
    burnDays = Math.min(7, Math.max(1, span));
  }
  for (const pool of Object.values(PROVIDER_POOL)) {
    let spent = 0;
    for (const row of recent) spent += row.byPool[pool] || 0;
    burn[pool] = burnDays ? spent / burnDays : 0;
  }

  const monthlyMap = {};
  for (const row of daily) {
    const ym = row.date.slice(0, 7);
    const cur = monthlyMap[ym] || (monthlyMap[ym] = { month: ym, credits: 0, costCny: 0, tokens: 0, calls: 0 });
    cur.credits += row.credits || 0;
    cur.costCny += row.costCny || 0;
    cur.tokens += row.tokens || 0;
    cur.calls += row.calls || 0;
  }

  return {
    scopedTo: CREDIT_PROVIDERS,
    totals: totals,
    daily: dailyFilled,
    monthly: Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12),
    providers: providerList.slice(0, providerLimit),
    providerCount: providerList.length,
    sessions: sessionRecords.slice(0, sessionLimit),
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
    ['wb', data && data.wb], ['tr', data && data.tr], ['mm', data && data.mm], ['qd', data && data.qd],
    ['db', data && data.db ? {
      total: (data.db.windows || []).reduce(function (s, w) {
        return (w && (w.kind === 'incentive' || w.kind === 'package')) ? s + (w.remain || 0) : s;
      }, 0)
    } : null]
  ];
  for (const [id, pool] of pools) {
    if (!pool) continue;
    const name = POOL_LABEL[id] || id;
    rows.push([bjDateStr(Date.now()), name, '余额', '', '', '', '', '', '', String(pool.total || 0), '', '', '']);
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
  let text = String(value === undefined || value === null ? '' : value);
  /* Excel treats a leading = + - @ as a formula; anything from a ledger is
     untrusted data. A leading apostrophe forces it to stay text. */
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

const POOL_LABEL = { wb: 'WorkBuddy', tr: 'Trae', mm: 'MiniMax', qd: 'Qoder', db: '豆包' };

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
      const hour = Number(parsed.autoHour);
      const warn = Number(parsed.warnDays);
      return {
        url: parsed.url,
        kind: NOTIFY_KINDS.indexOf(parsed.kind) >= 0 ? parsed.kind : notifyKindOf(parsed.url),
        hasUrl: true,
        autoEnabled: !!parsed.autoEnabled,
        autoHour: Number.isFinite(hour) && hour >= 0 && hour <= 23 ? Math.floor(hour) : 9,
        warnDays: Number.isFinite(warn) && warn >= 1 && warn <= 30 ? Math.floor(warn) : 7,
        lastAutoDate: typeof parsed.lastAutoDate === 'string' ? parsed.lastAutoDate : null
      };
    }
  } catch {
    /* nothing configured */
  }
  return { url: null, kind: null, hasUrl: false, autoEnabled: false, autoHour: 9, warnDays: 7, lastAutoDate: null };
}

function publicNotifyConfig(cfg) {
  if (!cfg || !cfg.hasUrl) return { kind: null, hasUrl: false };
  return {
    kind: cfg.kind,
    hasUrl: true,
    autoEnabled: !!cfg.autoEnabled,
    autoHour: Number.isFinite(cfg.autoHour) ? cfg.autoHour : 9,
    warnDays: Number.isFinite(cfg.warnDays) ? cfg.warnDays : 7,
    lastAutoDate: cfg.lastAutoDate || null
  };
}

async function saveNotifyConfig(config) {
  const target = notifyStatePath();
  const temp = uniqueTempPath(target);
  await mkdir(join(homeDir(), 'storages', 'credit-expiry'), { recursive: true });
  await writeFile(temp, JSON.stringify({
    schema: 1,
    url: config.url,
    kind: config.kind,
    autoEnabled: !!config.autoEnabled,
    autoHour: Number.isFinite(config.autoHour) ? config.autoHour : 9,
    warnDays: Number.isFinite(config.warnDays) ? config.warnDays : 7,
    lastAutoDate: config.lastAutoDate || null
  }), { encoding: 'utf8', mode: 0o600 });
  try {
    await rename(temp, target);
  } catch (err) {
    await unlink(temp).catch(() => {});
    throw err;
  }
}

/* ------------------------------------------------------------------ *
 * Monthly usage & expiry history archive
 * ------------------------------------------------------------------ */

function historyStatePath() {
  return join(homeDir(), 'storages', 'credit-expiry', 'history.json');
}

async function loadHistoryState() {
  try {
    const parsed = JSON.parse(await readFile(historyStatePath(), 'utf8'));
    if (parsed && parsed.schema === 1 && parsed.months && typeof parsed.months === 'object') {
      return {
        schema: 1,
        months: parsed.months,
        tracked: parsed.tracked && typeof parsed.tracked === 'object' ? parsed.tracked : {}
      };
    }
  } catch {
    /* first run */
  }
  return { schema: 1, months: {}, tracked: {} };
}

async function saveHistoryState(state) {
  const target = historyStatePath();
  const temp = uniqueTempPath(target);
  try {
    await mkdir(join(homeDir(), 'storages', 'credit-expiry'), { recursive: true });
    await writeFile(temp, JSON.stringify(state), 'utf8');
    await rename(temp, target);
  } catch {
    /* ignore read-only disk */
  }
}

function activeExpiringMap(payload) {
  const out = {};
  const now = Date.now();
  const add = (pool, name, remain, expMs) => {
    if (!(remain > 0) || !(expMs > now)) return;
    const key = pool + '|' + name + '|' + bjDateStr(expMs);
    if (out[key]) {
      out[key].remain += remain;
      if (expMs < out[key].expMs) out[key].expMs = expMs;
    } else {
      out[key] = { pool, name, remain, expMs };
    }
  };
  if (payload.wb && Array.isArray(payload.wb.packages)) {
    for (const p of payload.wb.packages) add('wb', p.name || '积分包', p.remain, p.expiresAtMs);
  }
  if (payload.tr && Array.isArray(payload.tr.accounts)) {
    for (const a of payload.tr.accounts) add('tr', a.desc || '积分账户', a.remain, a.expiresAtMs);
  }
  if (payload.mm && Array.isArray(payload.mm.lots)) {
    payload.mm.lots.forEach((lot, i) => add('mm', 'MiniMax-' + (i + 1), lot.amount, lot.expiresAtMs));
  }
  if (payload.qd && Array.isArray(payload.qd.packages)) {
    for (const p of payload.qd.packages) add('qd', p.name || 'Qoder 积分', p.remain, p.expiresAtMs);
  }
  if (payload.db && Array.isArray(payload.db.windows)) {
    for (const w of payload.db.windows) {
      if (w && w.kind === 'incentive') add('db', w.label || '活动赠送', w.remain, w.resetsAtMs);
    }
  }
  return out;
}

let historyArchiveQueue = Promise.resolve();

function updateHistoryArchive(payload, ledger) {
  const next = historyArchiveQueue.then(
    () => updateHistoryArchiveImpl(payload, ledger),
    () => updateHistoryArchiveImpl(payload, ledger)
  );
  historyArchiveQueue = next.then(() => {}, () => {});
  return next;
}

async function updateHistoryArchiveImpl(payload, ledger) {
  try {
    const state = await loadHistoryState();
    const now = Date.now();
    const ym = bjDateStr(now).slice(0, 7);
    let dirty = false;

    /* Roll up monthly totals from the full ledger (usage.monthly covers all
       ledger dates, unlike the 30-day chart slice). */
    const monthlyRows = payload.usage && Array.isArray(payload.usage.monthly)
      ? payload.usage.monthly
      : [];
    for (const row of monthlyRows) {
      if (!row || !row.month) continue;
      const m = row.month;
      const entry = state.months[m] || { month: m, usedCredits: 0, usedCostCny: 0, expiredCredits: 0, updatedAt: 0 };
      const c = Math.round((row.credits || 0) * 100) / 100;
      const y = Math.round((row.costCny || 0) * 100) / 100;
      if (Math.abs(entry.usedCredits - c) > 0.01 || Math.abs(entry.usedCostCny - y) > 0.01) {
        entry.usedCredits = c;
        entry.usedCostCny = y;
        entry.updatedAt = now;
        state.months[m] = entry;
        dirty = true;
      }
    }
    if (ledger && ledger.days && !state.months[ym]) {
      state.months[ym] = { month: ym, usedCredits: 0, usedCostCny: 0, expiredCredits: 0, updatedAt: now };
      dirty = true;
    }

    /* Detect previously tracked expiring packs whose deadline has now passed */
    const current = activeExpiringMap(payload);
    for (const [key, prev] of Object.entries(state.tracked)) {
      if (prev && prev.expMs > 0 && prev.expMs < now - 3600000) {
        const still = current[key];
        const poolAvailable = prev.pool && payload[prev.pool] !== null && payload[prev.pool] !== undefined;
        if (!still && poolAvailable) {
          const expMonth = bjDateStr(prev.expMs).slice(0, 7);
          const entry = state.months[expMonth] || { month: expMonth, usedCredits: 0, usedCostCny: 0, expiredCredits: 0, updatedAt: 0 };
          entry.expiredCredits = Math.round(((entry.expiredCredits || 0) + (prev.remain || 0)) * 100) / 100;
          entry.updatedAt = now;
          state.months[expMonth] = entry;
          delete state.tracked[key];
          dirty = true;
        }
      }
    }
    for (const [key, cur] of Object.entries(current)) {
      const prev = state.tracked[key];
      if (!prev || prev.remain !== cur.remain || prev.expMs !== cur.expMs) {
        state.tracked[key] = cur;
        dirty = true;
      }
    }

    if (dirty) await saveHistoryState(state);
    const months = Object.values(state.months).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
    return { months };
  } catch {
    return { months: [] };
  }
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
 * A caller may ask for a wider slice than the panel prints (a search box wants
 * the whole recent list), but never for an unbounded one: the payload is built
 * per request, so the cap keeps one call from ballooning.
 */
function clampLimit(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

/**
 * The GPT/Codex RPC answers with rate-limit windows (usedPercent per window),
 * not with a balance: each window is turned into one quota row, and the
 * soonest reset becomes the subscription line's cycle.
 */
function normalizeCodex(value) {
  if (!value || typeof value !== 'object') return { status: 'error', windows: [] };
  const rateLimits = Array.isArray(value.rateLimits) ? value.rateLimits : [];
  const windows = [];
  for (const limit of rateLimits) {
    if (!limit || !Array.isArray(limit.windows)) continue;
    for (const w of limit.windows) {
      if (!w) continue;
      const used = Number(w.usedPercent) || 0;
      windows.push({
        id: limit.id || null,
        label: limit.name || limit.id || 'Codex',
        usedPercent: used,
        remainingPercent: Number.isFinite(Number(w.remainingPercent)) ? Number(w.remainingPercent) : Math.max(0, 100 - used),
        /* codex resetsAt is epoch SECONDS; every other date here is milliseconds. */
        resetsAtMs: finiteOrNull(typeof w.resetsAt === 'number' ? w.resetsAt * 1000 : null),
        windowSeconds: finiteOrNull(w.windowSeconds)
      });
    }
  }
  const credits = value.credits || {};
  const bal = credits.balance;
  return {
    status: 'ok',
    plan: value.planType || null,
    windows: windows,
    creditsBalance: (bal !== null && bal !== undefined && bal !== '' && Number.isFinite(Number(bal))) ? Number(bal) : null,
    creditsExpiresAtMs: finiteOrNull(credits.expiresAt),
    fetchedAtMs: finiteOrNull(value.fetchedAt)
  };
}

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
    plan: usage.plan && typeof usage.plan === 'object' ? {
      active: !!usage.plan.active,
      tier: usage.plan.tier || null,
      expiresAtMs: finiteOrNull(usage.plan.expiresAtMs)
    } : null,
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

export function normalizeTrae(usage) {
  const credits = usage.credits || {};
  const now = Date.now();
  const rawAccounts = Array.isArray(credits.accounts) ? credits.accounts : [];
  const activeAccounts = rawAccounts.filter((a) => {
    if (!a) return false;
    const exp = finiteOrNull(a.expiresAtMs);
    if (exp !== null && exp > 0 && exp <= now) return false;
    return true;
  });
  const generalOnly = activeAccounts.filter((a) => a.endpoint === undefined || a.endpoint === null || a.endpoint === 0);
  const activeSum = activeAccounts.reduce((s, a) => s + (Number(a.remain) || 0), 0);
  const generalSum = generalOnly.reduce((s, a) => s + (Number(a.remain) || 0), 0);
  const hasGeneralField = typeof credits.generalAvailable === 'number' && Number.isFinite(credits.generalAvailable);
  const hasAvailField = typeof credits.available === 'number' && Number.isFinite(credits.available);
  const workAvailable = finiteOrNull(credits.workAvailable);
  const generalAvailable = hasGeneralField ? credits.generalAvailable : null;
  const available = hasAvailField ? credits.available : null;
  const grantedTotal = Number(credits.total) || 0;
  const consumed = Number(credits.consumed) || 0;
  const remainTotal = hasGeneralField
    ? credits.generalAvailable
    : (hasAvailField
      ? credits.available
      : (rawAccounts.length > 0
        ? (generalOnly.length > 0 ? generalSum : activeSum)
        : Math.max(0, grantedTotal - consumed)));
  const displayAccounts = (hasGeneralField && workAvailable && workAvailable > 0 && generalOnly.length > 0)
    ? generalOnly
    : activeAccounts;
  return {
    status: usage.status || null,
    accountName: usage.accountName || '',
    total: remainTotal,
    grantedTotal: grantedTotal,
    available: available,
    generalAvailable: generalAvailable,
    workAvailable: workAvailable,
    consumed: consumed,
    tokenExpiresAtMs: finiteOrNull(usage.tokenExpiresAtMs),
    refreshExpiresAtMs: finiteOrNull(usage.refreshExpiresAtMs),
    /* Trae 的连接插件不返回套餐名，只按「有订阅窗口/无」上报；不编造套餐名。 */
    hasPlan: usage.hasPlan === true || !!usage.plan,
    accounts: displayAccounts.map((a) => ({
      desc: a.displayDesc || '积分账户',
      remain: Number(a.remain) || 0,
      size: Number(a.size) || 0,
      endpoint: finiteOrNull(a.endpoint),
      expiresAtMs: finiteOrNull(a.expiresAtMs)
    }))
  };
}


/**
 * 豆包把额度按时间窗口发放（套餐积分 / 5 小时 / 每周 / 活动赠送），不是一次性积分包：
 * 每个窗口有总量、已用和重置时间，是一个会刷新的额度而非会过期的余额。
 * startsOnUse 的窗口从首次使用起算重置日，那个日期是平台给的估算而非硬到期，
 * 所以单独标记出来，让面板别把它说成铁定会作废。
 */
function normalizeDoubao(status) {
  const windows = status && status.windows && typeof status.windows === 'object' ? status.windows : {};
  const raw = [];
  /* The plan's own credit pool (标准套餐 etc.): the upstream calls it
     `package` and renders it as 「套餐积分」 with a reset countdown. Missing it
     here hid the user's entire subscription balance from the panel. */
  if (windows.package) raw.push(Object.assign({ kind: 'package' }, windows.package));
  if (windows.fiveHour) raw.push(Object.assign({ kind: 'fiveHour' }, windows.fiveHour));
  if (windows.weekly) raw.push(Object.assign({ kind: 'weekly' }, windows.weekly));
  const bonus = Array.isArray(windows.incentive) ? windows.incentive : [];
  bonus.forEach((w) => { if (w) raw.push(Object.assign({ kind: 'incentive' }, w)); });
  const list = raw.map((w) => {
    const size = Number(w.totalAmount) || 0;
    const used = Number(w.usedAmount) || 0;
    const pct = size > 0 ? (used / size) * 100 : 0;
    return {
      kind: w.kind,
      label: w.label || (w.kind === 'package' ? '套餐积分' : (w.kind === 'fiveHour' ? '5 小时额度' : (w.kind === 'weekly' ? '每周额度' : '活动赠送额度'))),
      size: size,
      used: used,
      remain: Math.max(0, size - used),
      usedPercent: Number.isFinite(w.usedPercent) ? w.usedPercent : pct,
      remainingPercent: Number.isFinite(w.remainingPercent) ? w.remainingPercent : (100 - pct),
      resetsAtMs: finiteOrNull(w.resetsAt),
      resetsInMs: finiteOrNull(w.resetsInMs),
      startsOnUse: !!w.startsOnUse
    };
  });
  /* Only the fixed-window grants behave like a subscription. An incentive is a
     one-off gift and must not be dressed up as a monthly reset. */
  const recurring = list.filter((w) => w.kind === 'package' || w.kind === 'fiveHour' || w.kind === 'weekly');
  let resetAtMs = null;
  for (const w of recurring) {
    if (w.resetsAtMs !== null && (resetAtMs === null || w.resetsAtMs < resetAtMs)) resetAtMs = w.resetsAtMs;
  }
  return {
    status: status && status.ok ? 'ok' : 'error',
    plan: (status && status.plan) || null,
    profile: (status && status.profile) || null,
    exhausted: !!(status && status.exhausted),
    fetchedAtMs: finiteOrNull(status && status.fetchedAt),
    error: (status && status.error) || null,
    windows: list,
    subscription: recurring.length ? {
      cycle: 'quota',
      label: (status && status.plan) || '豆包额度',
      remain: recurring.reduce((s, w) => s + w.remain, 0),
      size: recurring.reduce((s, w) => s + w.size, 0),
      resetAtMs: resetAtMs,
      expiresAtMs: null
    } : null
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

  /** POST + JSON-RPC envelope for the codex-subscription plugin. Its usage is
     behind a RPC bridge, not a plain GET route like the four credit pools. */
  async function readCodexRpc(endpoint, timeoutMs, forwarded) {
    const base = origin();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS);
    const method = 'codex-subscription/' + endpoint;
    try {
      const response = await fetch(base + '/api/' + method, {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json', accept: 'application/json' }, forwarded || {}),
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'credit-expiry-' + Date.now() + '-' + Math.random().toString(36).slice(2),
          method: method, payload: {}
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const env = await response.json();
      if (!env || env.type !== 'server-response' || !env.result) throw new Error('bad RPC envelope');
      if (env.result.ok !== true) throw new Error((env.result.error && env.result.error.message) || 'codex rpc error');
      return env.result.value;
    } finally { clearTimeout(timer); }
  }

  /* ModelScope (魔搭) magicube balance. The key lives in DSH's credential
     store; resolve() covers file/env/.env layers, and a bare name is the ref.
     The number is read live and never written back to any ledger. */
  async function readModelScope(timeoutMs) {
    let apiKey = '';
    const credentials = readService(ctx, 'credentials');
    if (credentials && typeof credentials.resolve === 'function') {
      try {
        const hit = await Promise.resolve(credentials.resolve('MODELSCOPE_API_KEY'));
        const resolved = credentialText(hit);
        if (resolved) apiKey = resolved;
      } catch (e) { /* fall through to env */ }
    }
    if (!apiKey) apiKey = String(process.env.MODELSCOPE_API_KEY || '').trim();
    if (!apiKey) return { status: 'nokey', balance: null };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS);
    try {
      const response = await fetch('https://modelscope.cn/openapi/v1/magicubes/balance', {
        headers: { accept: 'application/json', authorization: 'Bearer ' + apiKey },
        signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const body = await response.json();
      const raw = body && body.data && body.data.available_balance;
      const balance = Number(raw);
      /* No invented budget: the old hard-coded 250 drew a progress bar against a
         number nobody published. If the payload ever carries a plan size, use it;
         otherwise maxBudget stays null and the panel shows the number alone. */
      const budget = Number(body && body.data && (body.data.total_balance || body.data.max_budget || body.data.budget));
      return {
        status: 'ok',
        balance: Number.isFinite(balance) ? balance : null,
        maxBudget: Number.isFinite(budget) && budget > 0 ? budget : null,
        fetchedAt: Date.now()
      };
    } finally { clearTimeout(timer); }
  }

  /* The export route serves the last assembled payload: every export click
     would otherwise re-read four upstreams to answer a question the page just
     answered. */
  let lastBundle = null;
  let lastBundleAt = 0;
  let lastBundleProv = 0;
  let lastBundleSess = 0;
  let lastUsageMemo = null;
  let notifyWriteQueue = Promise.resolve();
  let autoNotifyBusy = false;

  function withNotifyLock(task) {
    const next = notifyWriteQueue.then(task, task);
    notifyWriteQueue = next.then(() => {}, () => {});
    return next;
  }

  function buildHostAlertText(bundle, warnDays) {
    if (!bundle) return null;
    const now = Date.now();
    const limitMs = now + warnDays * DAY_MS;
    const soonLines = [];
    let total = 0;
    const pools = [
      ['WorkBuddy', bundle.wb && bundle.wb.packages, (p) => [p.name, p.remain, p.expiresAtMs]],
      ['Trae', bundle.tr && bundle.tr.accounts, (a) => [a.desc, a.remain, a.expiresAtMs]],
      ['MiniMax', bundle.mm && bundle.mm.lots, (l, i) => ['积分批#' + (i + 1), l.amount, l.expiresAtMs]],
      ['Qoder', bundle.qd && bundle.qd.packages, (p) => [p.name, p.remain, p.expiresAtMs]],
      ['豆包', bundle.db && Array.isArray(bundle.db.windows) ? bundle.db.windows.filter((w) => w && w.kind === 'incentive') : null, (w) => [w.label || '活动赠送', w.remain, w.resetsAtMs]]
    ];
    for (const [label, list, pick] of pools) {
      if (!Array.isArray(list)) continue;
      list.forEach((item, idx) => {
        const [name, remain, expMs] = pick(item, idx);
        if (remain > 0 && expMs > 0 && expMs <= limitMs && expMs >= now - DAY_MS) {
          total += remain;
          const d = Math.max(0, Math.round((expMs - now) / DAY_MS));
          soonLines.push(`· ${label}「${name || '积分'}」${Math.round(remain)} 分（${d === 0 ? '今天到期' : d + ' 天后'}）`);
        }
      });
    }
    if (!soonLines.length) return null;
    return [
      `积分到期自动提醒 · ${bjDateStr(now)}`,
      `未来 ${warnDays} 天内共有 ${Math.round(total)} 积分即将到期：`,
      ...soonLines.slice(0, 6)
    ].join('\n');
  }

  async function maybeAutoNotify(bundle) {
    if (autoNotifyBusy || !bundle) return;
    autoNotifyBusy = true;
    try {
      const cfg = await loadNotifyConfig();
      if (!cfg.hasUrl || !cfg.autoEnabled) return;
      const now = Date.now();
      const bj = new Date(now + BJ_OFFSET_MS);
      const today = bj.toISOString().slice(0, 10);
      if (cfg.lastAutoDate === today) return;
      if (bj.getUTCHours() < cfg.autoHour) return;
      const text = buildHostAlertText(bundle, cfg.warnDays);
      if (!text) return;
      const res = await pushNotify({ text });
      if (res && res.ok) {
        await withNotifyLock(async () => {
          const latest = await loadNotifyConfig();
          if (!latest.hasUrl || !latest.autoEnabled) return;
          await saveNotifyConfig(Object.assign({}, latest, { lastAutoDate: today }));
        });
      }
    } catch {
      /* auto notify never breaks normal requests */
    } finally {
      autoNotifyBusy = false;
    }
  }

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
      /* Delegate Host/Origin + session/API-token enforcement to DSH's own
         connection gate before any routing, body reading or upstream fetch. */
      const refused = ctx.connection && typeof ctx.connection.requestRejection === 'function'
        ? ctx.connection.requestRejection(req)
        : 403;
      if (refused !== undefined) {
        send(res, refused, { status: 'error', error: refused === 401 ? 'unauthorized' : 'forbidden' });
        return;
      }
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
          if (body.action === 'test') {
            const probeEntry = sanitizeAccount(Object.assign({ id: 'probe' }, body.account), 0);
            if (!probeEntry) {
              send(res, 400, { status: 'error', error: '请填写完整的厂商与凭据（云平台 AK/SK 或 Team ID 不可为空）' });
              return;
            }
            const probeRes = await readBalances([probeEntry]);
            const probeItem = probeRes && probeRes[0] ? probeRes[0] : { error: '读取失败' };
            send(res, 200, { status: probeItem.error ? 'error' : 'ok', account: probeItem, error: probeItem.error || null });
            return;
          }
          const outcome = await withKeyStateLock(async () => {
            const state = await loadKeyStateWithMeta();
            let accounts = state.accounts;
            const dismissedSet = new Set(state.dismissed);
            const syncedSet = new Set(state.syncedTokens || []);
            const detachedSet = new Set(state.dshDetached || []);
            let nextSyncDsh = state.syncDsh;
            if (body.action === 'config') {
              if (body.syncDsh !== undefined) nextSyncDsh = !!body.syncDsh;
              await saveKeyState(accounts, Array.from(dismissedSet), {
                syncDsh: nextSyncDsh,
                syncedTokens: Array.from(syncedSet),
                dshDetached: Array.from(detachedSet)
              });
              invalidateKeySync();
              lastBundle = null;
              let latestAccounts = accounts;
              if (nextSyncDsh) {
                latestAccounts = await syncKeysWithDshImpl(ctx).catch(() => accounts);
                lastKeySyncHome = homeDir();
                lastKeySyncAt = Date.now();
              }
              return { status: 200, payload: { status: 'ok', syncDsh: nextSyncDsh, accounts: latestAccounts.map(publicAccount) } };
            } else if (body.action === 'add') {
              const uid = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              const entry = sanitizeAccount(Object.assign({ id: uid }, body.account), accounts.length);
              if (!entry) {
                return { status: 400, payload: { status: 'error', error: '请填写完整的厂商与凭据（云平台 AK/SK 或 Team ID 不可为空）' } };
              }
              if (accounts.some((a) => a.key === entry.key && a.vendor === entry.vendor && (a.secret || '') === (entry.secret || ''))) {
                return { status: 409, payload: { status: 'error', error: '这个凭据已经添加过' } };
              }
              if (accounts.length >= KEY_LIMIT) {
                return { status: 400, payload: { status: 'error', error: '最多 ' + KEY_LIMIT + ' 个密钥' } };
              }
              const addToken = entry.vendor + ':' + maskKey(entry.key);
              dismissedSet.delete(addToken);
              detachedSet.delete(addToken);
              syncedSet.delete(addToken);
              accounts.push(entry);
            } else if (body.action === 'update') {
              const id = String(body.id || '');
              const target = accounts.find((a) => a.id === id);
              if (!target) {
                return { status: 404, payload: { status: 'error', error: '未找到该密钥记录' } };
              }
              if (body.label !== undefined) {
                const source = BALANCE_SOURCES[target.vendor] || {};
                target.label = String(body.label || source.label || target.vendor).slice(0, 40);
              }
              if (body.manualBalance !== undefined) {
                const rawM = body.manualBalance === null || body.manualBalance === '' ? NaN : Number(body.manualBalance);
                target.manualBalance = Number.isFinite(rawM) && rawM >= 0 ? rawM : null;
              }
            } else if (body.action === 'remove') {
              const id = String(body.id || '');
              const removed = accounts.find((a) => a.id === id);
              if (removed) {
                const rmToken = removed.vendor + ':' + maskKey(removed.key);
                dismissedSet.add(rmToken);
                syncedSet.delete(rmToken);
              }
              accounts = accounts.filter((a) => a.id !== id);
            } else {
              return { status: 400, payload: { status: 'error', error: 'unknown action' } };
            }
            await saveKeyState(accounts, Array.from(dismissedSet), {
              syncDsh: nextSyncDsh,
              syncedTokens: Array.from(syncedSet),
              dshDetached: Array.from(detachedSet)
            });
            invalidateKeySync();
            lastBundle = null;
            if ((body.action === 'add' || body.action === 'update') && nextSyncDsh) {
              await syncKeysWithDshImpl(ctx).catch(() => {});
              lastKeySyncHome = homeDir();
              lastKeySyncAt = Date.now();
            }
            const curAfter = await loadKeyStateWithMeta();
            return { status: 200, payload: { status: 'ok', syncDsh: curAfter.syncDsh, accounts: curAfter.accounts.map(publicAccount) } };
          });
          send(res, outcome.status, outcome.payload);
          return;
        }
        const accounts = await syncKeysWithDsh(ctx, true);
        const keyMeta = await loadKeyStateWithMeta();
        send(res, 200, {
          status: 'ok',
          syncDsh: keyMeta.syncDsh,
          accounts: accounts.map(publicAccount),
          vendors: Object.keys(BALANCE_SOURCES).map((id) => ({
            id: id,
            label: BALANCE_SOURCES[id].label,
            authType: BALANCE_SOURCES[id].authType || 'bearer',
            keyLabel: BALANCE_SOURCES[id].keyLabel || 'API Key',
            secretLabel: BALANCE_SOURCES[id].secretLabel || null,
            keysUrl: BALANCE_SOURCES[id].keysUrl || null,
            hint: BALANCE_SOURCES[id].hint || null
          }))
        });
        return;
      }
      if (tail === '/notify') {
        let body = null;
        try { body = JSON.parse(await readBody(req)); } catch { body = null; }
        const payloadBody = body || {};
        /* config: store or clear the webhook; anything else is a push. */
        if (payloadBody.action === 'config') {
          const outcome = await withNotifyLock(async () => {
            const existing = await loadNotifyConfig();
            const keepExisting = payloadBody.url === '__KEEP__';
            const raw = keepExisting ? (existing.url || '') : String(payloadBody.url || '').trim();
            if (!raw) {
              await saveNotifyConfig({ url: null, kind: null, autoEnabled: false, autoHour: 9, warnDays: 7, lastAutoDate: null });
              return { status: 200, payload: { status: 'ok', notify: { kind: null, hasUrl: false } } };
            }
            if (!/^https:\/\//i.test(raw)) {
              return { status: 400, payload: { status: 'error', error: '推送地址必须是 https 链接' } };
            }
            const kind = NOTIFY_KINDS.indexOf(payloadBody.kind) >= 0 ? payloadBody.kind : notifyKindOf(raw);
            const autoHourNum = Number(payloadBody.autoHour);
            const warnDaysNum = Number(payloadBody.warnDays);
            const nextCfg = {
              url: raw,
              kind: kind,
              hasUrl: true,
              autoEnabled: payloadBody.autoEnabled !== undefined ? !!payloadBody.autoEnabled : existing.autoEnabled,
              autoHour: Number.isFinite(autoHourNum) && autoHourNum >= 0 && autoHourNum <= 23 ? Math.floor(autoHourNum) : existing.autoHour,
              warnDays: Number.isFinite(warnDaysNum) && warnDaysNum >= 1 && warnDaysNum <= 30 ? Math.floor(warnDaysNum) : existing.warnDays,
              lastAutoDate: existing.lastAutoDate
            };
            await saveNotifyConfig(nextCfg);
            return { status: 200, payload: { status: 'ok', notify: publicNotifyConfig(nextCfg) } };
          });
          send(res, outcome.status, outcome.payload);
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
        const isFreshBundle = lastBundle && (Date.now() - lastBundleAt < 60 * 1000) && lastBundleProv >= 120 && lastBundleSess >= 200;
        let bundle = isFreshBundle ? lastBundle : null;
        if (!bundle) {
          /* An export must work as the first action too: fetch the same payload
             the page would show, then serve it, instead of 503. */
          const forwarded = { 'x-credit-expiry-export': '1' };
          const incoming = req.headers || {};
          for (const header of ['cookie', 'authorization', 'x-api-key']) {
            if (typeof incoming[header] === 'string' && incoming[header]) forwarded[header] = incoming[header];
          }
          bundle = await readUsage(PREFIX + '/data', forwarded, 30000);
          lastBundle = bundle;
          lastBundleAt = Date.now();
          lastBundleProv = 120;
          lastBundleSess = 200;
        }
        if (wanted === 'json') {
          send(res, 200, bundle);
          return;
        }
        const body = usageCsv(bundle.usage, bundle);
        res.writeHead(200, {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="credit-expiry-' + bjDateStr(Date.now()) + '.csv"',
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
      const payload = { updatedAt: Date.now(), version: localVersion(), errors: [], wb: null, tr: null, mm: null, qd: null, db: null, cx: null, ms: null, usage: null, history: { months: [] } };
      const results = await Promise.allSettled([
        readUsage(ROUTES.wb, forwarded),
        readUsage(ROUTES.tr, forwarded),
        readUsage(ROUTES.mm, forwarded),
        readUsage(ROUTES.qd, forwarded),
        readUsage(ROUTES.wbAccounts, forwarded, ACCOUNT_TIMEOUT_MS),
        readLedger(),
        priceState(),
        syncKeysWithDsh(ctx).then((accounts) => (accounts.length ? readBalances(accounts) : [])),
        loadNotifyConfig(),
        readUsage(ROUTES.db, forwarded),
        readCodexRpc('usage', undefined, forwarded),
        readModelScope()
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
      const dbResult = results[9];
      const codexResult = results[10];
      const msResult = results[11];

      const classifyError = (reason) => {
        const msg = String((reason && reason.message) || reason || '');
        if (/HTTP 404/i.test(msg)) return { state: 'not-installed', message: msg };
        if (/HTTP 401|HTTP 403/i.test(msg)) return { state: 'signed-out', message: msg };
        return { state: 'error', message: msg };
      };
      const sourceStatus = {};

      if (wbResult.status === 'fulfilled') {
        /* The account roster is a second, slower call; when it answers it adds the
           other signed-in accounts, which the single-account payload cannot see. */
        payload.wb = normalizeWorkbuddy(wbResult.value, wbPoolResult.status === 'fulfilled' ? wbPoolResult.value : null);
        sourceStatus.wb = (payload.wb.status && payload.wb.status !== 'signed-out' && payload.wb.status !== 'failed')
          ? { state: 'ok' } : { state: payload.wb.status || 'signed-out' };
      } else {
        const reason = wbResult.reason;
        sourceStatus.wb = classifyError(reason);
        if (sourceStatus.wb.state !== 'not-installed') {
          payload.errors.push('WorkBuddy: ' + String((reason && reason.message) || reason));
        }
      }

      if (trResult.status === 'fulfilled') {
        payload.tr = normalizeTrae(trResult.value);
        sourceStatus.tr = (payload.tr.status && payload.tr.status !== 'signed-out' && payload.tr.status !== 'failed')
          ? { state: 'ok' } : { state: payload.tr.status || 'signed-out' };
      } else {
        const reason = trResult.reason;
        sourceStatus.tr = classifyError(reason);
        if (sourceStatus.tr.state !== 'not-installed') {
          payload.errors.push('Trae: ' + String((reason && reason.message) || reason));
        }
      }

      if (mmResult.status === 'fulfilled') {
        payload.mm = normalizeMinimax(mmResult.value);
        sourceStatus.mm = (payload.mm.status && payload.mm.status !== 'signed-out' && payload.mm.status !== 'failed')
          ? { state: 'ok' } : { state: payload.mm.status || 'signed-out' };
      } else {
        const reason = mmResult.reason;
        sourceStatus.mm = classifyError(reason);
        if (sourceStatus.mm.state !== 'not-installed') {
          payload.errors.push('MiniMax: ' + String((reason && reason.message) || reason));
        }
      }

      if (qdResult.status === 'fulfilled') {
        payload.qd = normalizeQoder(qdResult.value);
        sourceStatus.qd = (payload.qd.status && payload.qd.status !== 'signed-out' && payload.qd.status !== 'failed')
          ? { state: 'ok' } : { state: payload.qd.status || 'signed-out' };
      } else {
        const reason = qdResult.reason;
        sourceStatus.qd = classifyError(reason);
        if (sourceStatus.qd.state !== 'not-installed') {
          payload.errors.push('Qoder: ' + String((reason && reason.message) || reason));
        }
      }

      if (dbResult.status === 'fulfilled') {
        payload.db = normalizeDoubao(dbResult.value);
        sourceStatus.db = payload.db.status === 'ok' ? { state: 'ok' } : { state: 'signed-out', message: payload.db.error || '' };
      } else {
        const reason = dbResult.reason;
        sourceStatus.db = classifyError(reason);
        if (sourceStatus.db.state !== 'not-installed') {
          payload.errors.push('豆包: ' + String((reason && reason.message) || reason));
        }
      }

      if (codexResult.status === 'fulfilled') {
        payload.cx = normalizeCodex(codexResult.value);
        sourceStatus.cx = { state: 'ok' };
      } else {
        const reason = codexResult.reason;
        sourceStatus.cx = classifyError(reason);
        if (sourceStatus.cx.state !== 'not-installed') {
          payload.errors.push('GPT/Codex: ' + String((reason && reason.message) || reason));
        }
      }

      if (msResult.status === 'fulfilled') {
        payload.ms = msResult.value;
        sourceStatus.ms = payload.ms && payload.ms.status === 'ok' ? { state: 'ok' } : { state: 'nokey' };
      } else {
        const reason = msResult.reason;
        sourceStatus.ms = classifyError(reason);
        payload.errors.push('魔搭: ' + String((reason && reason.message) || reason));
      }
      payload.sourceStatus = sourceStatus;

      const prices = priceResult.status === 'fulfilled' ? priceResult.value : null;
      if (priceResult.status !== 'fulfilled') {
        const reason = priceResult.reason;
        payload.errors.push('价格: ' + String((reason && reason.message) || reason));
      } else if (prices && prices.errors && prices.errors.length) {
        /* A vendor page that failed to parse only costs that vendor its freshest
           numbers - the cached table still renders, so this is a warning. */
        payload.errors.push('价格: ' + prices.errors.join('；'));
      }

      const reqProv = Number(url.searchParams.get('prov')) || (incoming['x-credit-expiry-export'] ? 120 : 0);
      const reqSess = Number(url.searchParams.get('sess')) || (incoming['x-credit-expiry-export'] ? 200 : 0);

      if (usageResult.status === 'fulfilled') {
        const multipliers = collectMultipliers([
          wbResult.status === 'fulfilled' ? wbResult.value : null,
          trResult.status === 'fulfilled' ? trResult.value : null,
          mmResult.status === 'fulfilled' ? mmResult.value : null,
          qdResult.status === 'fulfilled' ? qdResult.value : null
        ]);
        const consumed = {
          wb: payload.wb ? payload.wb.consumed : null,
          tr: payload.tr ? payload.tr.consumed : null,
          mm: payload.mm ? payload.mm.consumed : null,
          qd: payload.qd ? payload.qd.consumed : null
        };
        const usageMemoKey = [
          ledgerCache.path || '',
          ledgerCache.stamp || '',
          prices ? prices.fetchedAt : 0,
          JSON.stringify(consumed),
          JSON.stringify(multipliers),
          reqProv,
          reqSess,
          bjDateStr(Date.now())
        ].join('|');
        if (lastUsageMemo && lastUsageMemo.key === usageMemoKey) {
          payload.usage = lastUsageMemo.value;
        } else {
          payload.usage = summarizeUsage(usageResult.value, {
            prices: prices,
            multipliers: multipliers,
            consumed: consumed,
            /* The panel's search boxes filter over what it was sent, so it asks
               for a wider slice than the default view prints. */
            providerLimit: reqProv,
            sessionLimit: reqSess
          });
          lastUsageMemo = { key: usageMemoKey, value: payload.usage };
        }
        if (!payload.usage) {
          payload.errors.push('用量: 未找到 cost-meter 账本');
        } else if (payload.usage.pricing.missing.length) {
          payload.errors.push('价格: 以下模型在公开价目表里查不到单价（多为平台内部模型别名，调用真实存在、不是识别错误），未计入金额与积分分摊 - ' + payload.usage.pricing.missing.join('、'));
        }
      } else {
        const reason = usageResult.reason;
        payload.errors.push('用量: ' + String((reason && reason.message) || reason));
      }

      /* Cash balances behind API keys: read concurrently with upstream pools. */
      if (keyResult.status === 'fulfilled') {
        payload.keys = keyResult.value;
      } else {
        payload.keys = [];
        const reason = keyResult.reason;
        payload.errors.push('密钥余额: ' + String((reason && reason.message) || reason));
      }
      if (notifyResult.status === 'fulfilled') {
        payload.notify = publicNotifyConfig(notifyResult.value);
      }

      payload.history = await updateHistoryArchive(payload, usageResult.status === 'fulfilled' ? usageResult.value : null);
      lastBundle = payload;
      lastBundleAt = Date.now();
      lastBundleProv = reqProv || PROVIDER_LIMIT;
      lastBundleSess = reqSess || SESSION_LIMIT;
      maybeAutoNotify(payload);
      send(res, 200, payload);
    } catch (error) {
      const message = error && error.name === 'AbortError'
        ? '上游读取超时（8s）'
        : String((error && error.message) || error);
      send(res, 502, { status: 'error', error: message });
    }
  };

  ctx.effect(() => {
    const offRoute = ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: handler });
    syncKeysWithDsh(ctx, true).catch(() => {});
    const timer = setInterval(() => {
      if (lastBundle) maybeAutoNotify(lastBundle);
    }, 30 * 60 * 1000);
    if (timer.unref) timer.unref();
    return () => {
      clearInterval(timer);
      if (typeof offRoute === 'function') offRoute();
    };
  });
}
