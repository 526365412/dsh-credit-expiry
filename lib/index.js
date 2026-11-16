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
 * The four credit halves are read from the connect plugins' own usage routes on
 * this same web server (no CORS, no cross-origin fetch from the shell). Each one
 * is optional: a missing upstream lands in errors[] and the other platforms
 * still render. The usage half is read from the cost-meter ledger on disk,
 * because none of the platforms exposes a consumption history - only
 * "remaining now" and one lifetime "consumed" number.
 *
 * Usage is scoped to the credit pools only: DeepSeek direct and the CLI proxies
 * are cash spend and would otherwise dominate a panel about expiring credits.
 */

import { readFile, stat } from 'node:fs/promises';
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

/**
 * One credit is about CNY 0.15 on both pools. Observed on 2026-11-16:
 * WorkBuddy 266.31 credits against CNY 40.90 of list price (6.51 cr/CNY),
 * Trae 164.73 credits against CNY 25.61 (6.43 cr/CNY). Two platforms with
 * different model mixes landing on the same rate means it is a price, not a
 * coincidence - so a single constant is the honest model here.
 */
const CREDIT_CNY = 0.15;

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

export function summarizeUsage(ledger) {
  if (!ledger || !ledger.days || typeof ledger.days !== 'object') return null;

  const dates = Object.keys(ledger.days).sort();
  const daily = [];
  const providers = new Map();
  const sessions = [];

  for (const date of dates) {
    const day = ledger.days[date] || {};
    const byModel = day.byProviderModel && typeof day.byProviderModel === 'object' ? day.byProviderModel : {};

    let dayCalls = 0;
    let dayTokens = 0;
    let dayCost = 0;
    const dayByPool = {};

    for (const key of Object.keys(byModel)) {
      const entry = byModel[key] || {};
      const { provider, model } = splitKey(key);
      if (!CREDIT_PROVIDER_SET.has(provider)) continue;

      const calls = entry.calls || 0;
      const tokens = tokensOf(entry);
      const costCny = entry.costCny || 0;

      let bucket = providers.get(key);
      if (!bucket) {
        bucket = { key, provider, model, calls: 0, tokens: 0, costCny: 0, credits: 0, lastDate: date };
        providers.set(key, bucket);
      }
      bucket.calls += calls;
      bucket.tokens += tokens;
      bucket.costCny += costCny;
      bucket.credits += costCny / CREDIT_CNY;
      bucket.lastDate = date;

      dayCalls += calls;
      dayTokens += tokens;
      dayCost += costCny;
      const pool = PROVIDER_POOL[provider] || provider;
      dayByPool[pool] = (dayByPool[pool] || 0) + costCny / CREDIT_CNY;
    }

    daily.push({
      date,
      calls: dayCalls,
      tokens: dayTokens,
      costCny: dayCost,
      credits: dayCost / CREDIT_CNY,
      byPool: dayByPool
    });

    const list = Array.isArray(day.sessions) ? day.sessions : [];
    for (const session of list) {
      const perModel = session.byProviderModel && typeof session.byProviderModel === 'object' ? session.byProviderModel : {};
      let topKey = '';
      let topCost = -1;
      let calls = 0;
      let tokens = 0;
      let costCny = 0;

      for (const key of Object.keys(perModel)) {
        const { provider } = splitKey(key);
        if (!CREDIT_PROVIDER_SET.has(provider)) continue;
        const entry = perModel[key] || {};
        const entryCost = entry.costCny || 0;
        calls += entry.calls || 0;
        tokens += tokensOf(entry);
        costCny += entryCost;
        if (entryCost > topCost) {
          topCost = entryCost;
          topKey = key;
        }
      }

      if (!calls) continue; /* a cash-only session is not a credit session */

      sessions.push({
        id: session.id || '',
        at: session.at || 0,
        date,
        title: session.title || '',
        calls,
        tokens,
        costCny,
        credits: costCny / CREDIT_CNY,
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
      costCny: 0,
      credits: 0,
      days: dates.length,
      from: dates[0] || null,
      to: dates[dates.length - 1] || null
    }
  );

  const providerList = Array.from(providers.values()).sort((a, b) => b.credits - a.credits);

  return {
    creditCny: CREDIT_CNY,
    scopedTo: CREDIT_PROVIDERS,
    totals,
    daily: daily.slice(-DAILY_WINDOW),
    providers: providerList,
    sessions: sessions.slice(0, SESSION_LIMIT),
    sessionCount: sessions.length
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

function normalizeWorkbuddy(usage) {
  const credits = usage.credits || {};
  const packages = Array.isArray(credits.packages) ? credits.packages : [];
  return {
    status: usage.status || null,
    accountName: usage.accountName || '',
    total: Number(credits.total) || 0,
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
 * MiniMax Code reports a single balance plus an "upcoming" expiry list, with no
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
    lots,
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
 * plan's, and that date is exactly what makes the credits disappear. So the
 * plan date is painted onto every package - one honest approximation instead of
 * a second "no expiry" bucket that would read as forever.
 */
function normalizeQoder(usage) {
  const credits = usage.credits || {};
  const packages = Array.isArray(credits.packages) ? credits.packages : [];
  const planExpiry = finiteOrNull(credits.planExpiresAtMs);
  return {
    status: usage.status || null,
    accountName: usage.accountName || '',
    total: Number(credits.total) || 0,
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
      const response = await fetch(base + route, { headers, signal: controller.signal });
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
      const [wbResult, trResult, mmResult, qdResult, usageResult] = await Promise.allSettled([
        readUsage(req, ROUTES.wb, cookie),
        readUsage(req, ROUTES.tr, cookie),
        readUsage(req, ROUTES.mm, cookie),
        readUsage(req, ROUTES.qd, cookie),
        readLedger()
      ]);

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

      if (usageResult.status === 'fulfilled') {
        payload.usage = summarizeUsage(usageResult.value);
        if (!payload.usage) payload.errors.push('用量: 未找到 cost-meter 账本');
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

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler }));
}
