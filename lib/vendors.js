/**
 * API-key & cloud-vendor balance clients + cloud request signers.
 *
 * Extracted from lib/index.js so each vendor adapter can be maintained and
 * tested independently. Keys and secrets remain strictly local (0600).
 */

import { createHash, createHmac, randomBytes } from 'node:crypto';

export const KEY_TIMEOUT_MS = 8000;
export const KEY_LIMIT = 16;

const ENDPOINT_HINT_TTL_MS = 30 * 60 * 1000;
const endpointHints = new Map();

function hintKey(vendor, key) {
  const home = (process.env.DSH_HOME && process.env.DSH_HOME.trim()) || '';
  const digest = createHash('sha256').update(String(key || '')).digest('hex').slice(0, 16);
  return `${vendor}|${home}|${digest}`;
}

function getEndpointHint(vendor, key) {
  const hit = endpointHints.get(hintKey(vendor, key));
  if (!hit) return null;
  if (hit.fetchRef !== globalThis.fetch || Date.now() - hit.at >= ENDPOINT_HINT_TTL_MS) {
    endpointHints.delete(hintKey(vendor, key));
    return null;
  }
  return hit.mode;
}

function setEndpointHint(vendor, key, mode) {
  endpointHints.set(hintKey(vendor, key), { mode, at: Date.now(), fetchRef: globalThis.fetch });
}

function clearEndpointHint(vendor, key) {
  endpointHints.delete(hintKey(vendor, key));
}

export function aliyunPercentEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

export function buildAliyunSignedUrl(ak, sk, action, extraParams) {
  const params = Object.assign({
    Action: action,
    Format: 'JSON',
    Version: '2017-12-14',
    AccessKeyId: ak,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: randomBytes(12).toString('hex')
  }, extraParams || {});
  const keys = Object.keys(params).sort();
  const canonicalQuery = keys.map((k) => aliyunPercentEncode(k) + '=' + aliyunPercentEncode(params[k])).join('&');
  const stringToSign = 'GET&%2F&' + aliyunPercentEncode(canonicalQuery);
  const signature = createHmac('sha1', sk + '&').update(stringToSign).digest('base64');
  return 'https://business.aliyuncs.com/?' + canonicalQuery + '&Signature=' + aliyunPercentEncode(signature);
}

export function signVolcengineHeaders(ak, sk, service, region, host, queryMap) {
  const now = new Date();
  const xDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const shortDate = xDate.slice(0, 8);
  const emptyHash = createHash('sha256').update('').digest('hex');
  const canonicalQuery = Object.keys(queryMap).sort()
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(queryMap[k]))
    .join('&');
  const canonicalHeaders = 'host:' + host + '\n' + 'x-content-sha256:' + emptyHash + '\n' + 'x-date:' + xDate + '\n';
  const signedHeaders = 'host;x-content-sha256;x-date';
  const canonicalRequest = ['GET', '/', canonicalQuery, canonicalHeaders, signedHeaders, emptyHash].join('\n');
  const credentialScope = shortDate + '/' + region + '/' + service + '/request';
  const stringToSign = ['HMAC-SHA256', xDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const kDate = createHmac('sha256', sk).update(shortDate).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update(service).digest();
  const kSigning = createHmac('sha256', kService).update('request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return {
    url: 'https://' + host + '/?' + canonicalQuery,
    headers: {
      accept: 'application/json',
      'x-date': xDate,
      'x-content-sha256': emptyHash,
      authorization: 'HMAC-SHA256 Credential=' + ak + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature
    }
  };
}

export function signBaiduBceHeaders(ak, sk, method, path, host) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const expiration = 1800;
  const authPrefix = 'bce-auth-v1/' + ak + '/' + timestamp + '/' + expiration;
  const rawHeaders = {
    'content-type': 'application/json; charset=utf-8',
    host: host,
    'x-bce-date': timestamp
  };
  const headerKeys = Object.keys(rawHeaders).sort();
  const canonicalHeaders = headerKeys.map((k) => k + ':' + encodeURIComponent(rawHeaders[k])).join('\n');
  const signedHeaders = headerKeys.join(';');
  const canonicalRequest = [method.toUpperCase(), encodeURI(path), '', canonicalHeaders].join('\n');
  const signingKey = createHmac('sha256', sk).update(authPrefix).digest('hex');
  const signature = createHmac('sha256', signingKey).update(canonicalRequest).digest('hex');
  return {
    accept: 'application/json',
    'content-type': 'application/json; charset=utf-8',
    'x-bce-date': timestamp,
    authorization: authPrefix + '/' + signedHeaders + '/' + signature
  };
}

export function parseZhipuWindowLabel(unit, number, type) {
  if (type === 'TIME_LIMIT') return 'MCP / 工具月度限额';
  if (unit === 3 && number === 5) return '5 小时限速窗口';
  if (unit === 6) return '每周额度窗口';
  if (unit === 5) return '月度额度窗口';
  return (number || '') + (type === 'CREDIT_LIMIT' ? ' 积分窗口' : ' Token 窗口');
}

export function cleanAmount(raw) {
  if (typeof raw === 'number') return raw;
  return Number(String(raw || '').replace(/,/g, '').trim());
}

/**
 * One entry per vendor whose balance or quota can be queried via an API key or
 * read-only cloud AK/SK.
 */
export const BALANCE_SOURCES = {
  deepseek: {
    label: 'DeepSeek',
    authType: 'bearer',
    keyLabel: 'API Key',
    keysUrl: 'https://platform.deepseek.com/api_keys',
    hint: '填写 DeepSeek 开放平台 API Key，可查看现金充值与赠金余额。',
    url: 'https://api.deepseek.com/user/balance',
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
    authType: 'bearer',
    keyLabel: 'API Key',
    keysUrl: 'https://platform.moonshot.cn/console/api-keys',
    hint: '填写 Kimi 开放平台 API Key（支持 .cn 与 .ai），可查看现金余额与代金券余额。',
    url: 'https://api.moonshot.cn/v1/users/me/balance',
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
    },
    async fetchBalance(entry, signal) {
      const hint = getEndpointHint('moonshot', entry.key);
      const urls = hint === 'ai'
        ? ['https://api.moonshot.ai/v1/users/me/balance', 'https://api.moonshot.cn/v1/users/me/balance']
        : ['https://api.moonshot.cn/v1/users/me/balance', 'https://api.moonshot.ai/v1/users/me/balance'];
      const headers = {
        authorization: 'Bearer ' + entry.key,
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; DSH-CreditExpiry/1.0)'
      };
      let lastErr = '读取失败';
      for (let i = 0; i < urls.length; i++) {
        const res = await fetch(urls[i], { headers, signal });
        const text = await res.text();
        let body = null;
        try { body = JSON.parse(text); } catch { body = null; }
        if (res.ok && body) {
          const parsed = this.parse(body);
          if (parsed) {
            if (urls[i].includes('.ai/')) {
              parsed.currency = 'USD';
              setEndpointHint('moonshot', entry.key, 'ai');
            } else {
              setEndpointHint('moonshot', entry.key, 'cn');
            }
            return { balance: parsed };
          }
        }
        const detail = (body && (body.message || body.msg || (body.error && body.error.message))) || '';
        lastErr = res.status === 401
          ? ('密钥无效或已撤销' + (detail ? '（' + detail + '）' : ''))
          : ('HTTP ' + res.status + (detail ? '：' + detail : ''));
        if (res.status !== 401 && res.status !== 403) break;
      }
      clearEndpointHint('moonshot', entry.key);
      return { error: lastErr };
    }
  },
  siliconflow: {
    label: '硅基流动 SiliconFlow',
    authType: 'bearer',
    keyLabel: 'API Key',
    keysUrl: 'https://cloud.siliconflow.cn/account/ak',
    hint: '填写硅基流动 API Key（支持中国站 .cn 与国际站 .com）；国内站官方已下线余额接口，会自动校验密钥并支持登记余额。',
    async fetchBalance(entry, signal) {
      const headers = {
        authorization: 'Bearer ' + entry.key,
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; DSH-CreditExpiry/1.0)'
      };
      const buildManualResult = (modelCount) => {
        const manual = Number(entry.manualBalance);
        const hasManual = entry.manualBalance !== null && entry.manualBalance !== undefined && entry.manualBalance !== '' && Number.isFinite(manual) && manual >= 0;
        return {
          balance: {
            amount: hasManual ? manual : null,
            statusText: hasManual ? null : (modelCount > 0 ? ('已接入 · ' + modelCount + ' 模型') : '已接入 · 密钥有效'),
            currency: 'CNY',
            granted: 0,
            topped: hasManual ? manual : 0,
            available: true,
            verified: true,
            modelCount: modelCount || null,
            note: hasManual
              ? ('密钥有效' + (modelCount > 0 ? ' · ' + modelCount + ' 个模型可用' : '') + '（手动登记余额）')
              : ('密钥验证通过' + (modelCount > 0 ? ' · ' + modelCount + ' 个模型可用' : '') + '（国内站官方已关停余额接口，可手动登记余额）')
          }
        };
      };

      const hint = getEndpointHint('siliconflow', entry.key);
      if (hint === 'cn-models') {
        try {
          const mRes = await fetch('https://api.siliconflow.cn/v1/models', { headers, signal });
          if (mRes && mRes.ok) {
            const mBody = await mRes.json().catch(() => null);
            const count = mBody && Array.isArray(mBody.data) ? mBody.data.length : 0;
            return buildManualResult(count);
          }
          if (mRes && mRes.status === 401) {
            clearEndpointHint('siliconflow', entry.key);
            return { error: '密钥无效或已撤销' };
          }
        } catch {
          /* fall through to full endpoint probe on transient failure */
        }
      }

      const endpoints = hint === 'com'
        ? ['https://api.siliconflow.com/v1/user/info', 'https://api.siliconflow.cn/v1/user/info']
        : ['https://api.siliconflow.cn/v1/user/info', 'https://api.siliconflow.com/v1/user/info'];
      let lastErr = '读取失败';
      let cnDeprecated = false;
      for (let i = 0; i < endpoints.length; i++) {
        const res = await fetch(endpoints[i], { headers, signal });
        const text = await res.text();
        let body = null;
        try { body = JSON.parse(text); } catch { body = null; }
        if (res.ok && body && body.data) {
          const data = body.data;
          const total = Number(data.totalBalance);
          const charge = Number(data.chargeBalance);
          const grant = Number(data.balance);
          const amount = Number.isFinite(total) ? total : (Number.isFinite(grant) ? grant : NaN);
          if (Number.isFinite(amount)) {
            setEndpointHint('siliconflow', entry.key, endpoints[i].includes('.com/') ? 'com' : 'cn');
            return {
              balance: {
                amount: amount,
                currency: endpoints[i].includes('.com/') && !Number.isFinite(charge) ? 'USD' : 'CNY',
                granted: Number.isFinite(grant) ? grant : 0,
                topped: Number.isFinite(charge) ? charge : 0,
                available: data.status ? data.status === 'normal' : true,
                note: '赠送/抵扣余额 ¥' + (Number.isFinite(grant) ? grant.toFixed(2) : '0.00')
              }
            };
          }
        }
        /* SiliconFlow China (.cn) returns HTTP 410 (code 20092) on /v1/user/info
           after authenticating a valid key (invalid keys return 401 code 30014). */
        if (res.status === 410 || (body && Number(body.code) === 20092)) {
          cnDeprecated = true;
          continue;
        }
        const detail = (body && (body.message || body.msg || (body.error && body.error.message))) || '';
        lastErr = res.status === 401
          ? ('密钥无效或已撤销' + (detail ? '（' + detail + '）' : ''))
          : ('HTTP ' + res.status + (detail ? '：' + detail : ''));
        if (res.status !== 401 && res.status !== 403) break;
      }
      if (cnDeprecated) {
        let modelCount = 0;
        try {
          const mRes = await fetch('https://api.siliconflow.cn/v1/models', { headers, signal });
          if (mRes && mRes.ok) {
            const mBody = await mRes.json().catch(() => null);
            if (mBody && Array.isArray(mBody.data)) modelCount = mBody.data.length;
          } else if (mRes && mRes.status === 401) {
            clearEndpointHint('siliconflow', entry.key);
            return { error: '密钥无效或已撤销' };
          }
        } catch {
          /* model list check is best-effort once /v1/user/info already passed auth */
        }
        setEndpointHint('siliconflow', entry.key, 'cn-models');
        return buildManualResult(modelCount);
      }
      clearEndpointHint('siliconflow', entry.key);
      return { error: lastErr };
    }
  },
  zhipu: {
    label: '智谱 GLM Coding Plan',
    authType: 'bearer',
    keyLabel: 'Coding Plan / API Key',
    keysUrl: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
    hint: '支持 GLM Coding Plan 专属 Key（读取套餐与 5h/周/工具限速窗口）及智谱开放平台通用 API Key。',
    async fetchBalance(entry, signal) {
      const headers = { authorization: 'Bearer ' + entry.key, accept: 'application/json' };
      const [limitRes, subRes] = await Promise.all([
        fetch('https://open.bigmodel.cn/api/monitor/usage/quota/limit', { headers, signal }),
        fetch('https://open.bigmodel.cn/api/biz/subscription/list', { headers, signal }).catch(() => null)
      ]);
      const limitBody = limitRes && limitRes.ok ? await limitRes.json().catch(() => null) : null;
      const limits = limitBody && limitBody.data && Array.isArray(limitBody.data.limits) ? limitBody.data.limits : null;
      if (!limitRes.ok || !limits) {
        /* Fallback: verify if this is a standard Zhipu Open Platform API key via /paas/v4/models */
        const mRes = await fetch('https://open.bigmodel.cn/api/paas/v4/models', { headers, signal }).catch(() => null);
        if (mRes && mRes.ok) {
          const mBody = await mRes.json().catch(() => null);
          const count = mBody && Array.isArray(mBody.data) ? mBody.data.length : 0;
          const manual = Number(entry.manualBalance);
          const hasManual = entry.manualBalance !== null && entry.manualBalance !== undefined && entry.manualBalance !== '' && Number.isFinite(manual) && manual >= 0;
          return {
            balance: {
              amount: hasManual ? manual : null,
              statusText: hasManual ? null : ('已接入' + (count > 0 ? ' · ' + count + ' 模型' : '')),
              currency: 'CNY',
              granted: 0,
              topped: hasManual ? manual : 0,
              available: true,
              verified: true,
              modelCount: count || null,
              planName: '智谱开放平台 API',
              note: '通用 API Key 验证通过' + (count > 0 ? ' · ' + count + ' 个模型可用' : '')
            }
          };
        }
        if (!limitRes.ok) {
          return { error: limitRes.status === 401 ? '密钥无效或非 Coding Plan 专用 Key' : ('HTTP ' + limitRes.status) };
        }
        return { error: '无法解析智谱额度响应（请确认填写的是有效智谱 Key）' };
      }
      let planName = null;
      let renewAt = null;
      if (subRes && subRes.ok) {
        const subBody = await subRes.json().catch(() => null);
        const list = subBody && Array.isArray(subBody.data) ? subBody.data : [];
        const active = list.find((s) => s && s.status === 'VALID') || list[0];
        if (active) {
          planName = active.productName || null;
          renewAt = active.nextRenewTime || null;
        }
      }
      const windows = limits.map((lim) => {
        const used = Number(lim.usage) || 0;
        const size = Number(lim.currentValue) || 0;
        const remain = Number.isFinite(Number(lim.remaining)) ? Number(lim.remaining) : Math.max(0, size - used);
        const pct = Number.isFinite(Number(lim.percentage)) ? Number(lim.percentage) : (size > 0 ? (used / size) * 100 : 0);
        const resetRaw = Number(lim.nextResetTime);
        const resetMs = Number.isFinite(resetRaw) && resetRaw > 0 ? (resetRaw < 1e12 ? resetRaw * 1000 : resetRaw) : null;
        return {
          label: parseZhipuWindowLabel(lim.unit, lim.number, lim.type),
          remain: remain,
          size: size,
          usedPercent: Math.max(0, Math.min(100, pct)),
          remainingPercent: Math.max(0, Math.min(100, 100 - pct)),
          resetsAtMs: resetMs,
          unitText: lim.type === 'TIME_LIMIT' ? '次' : (lim.type === 'CREDIT_LIMIT' ? '积分' : 'tok')
        };
      });
      const primary = windows[0] || null;
      return {
        balance: {
          amount: primary ? Math.round(primary.remainingPercent) : 0,
          currency: 'PCT',
          granted: 0,
          topped: 0,
          available: true,
          planName: planName || 'GLM Coding Plan',
          renewAt: renewAt,
          windows: windows
        }
      };
    }
  },
  xiaomi: {
    label: '小米 MiMo',
    authType: 'bearer',
    keyLabel: 'API Key (sk-...)',
    keysUrl: 'https://platform.xiaomimimo.com/#/console/api-keys',
    hint: '填写小米 MiMo 开放平台按量 API Key（sk- 开头），可查现金、赠金与信控余额。',
    url: 'https://api.xiaomimimo.com/v1/platform/balance',
    parse(body) {
      const list = body && Array.isArray(body.balance_infos) ? body.balance_infos : [];
      const row = list.find((b) => b && String(b.currency).toUpperCase() === 'CNY') || list[0];
      if (!row) return null;
      const total = Number(row.total_available);
      const cash = Number(row.cash_balance) || 0;
      const gift = Number(row.gift_balance) || 0;
      const credit = Number(row.credit_available) || 0;
      const frozen = Number(row.frozen_balance) || 0;
      if (!Number.isFinite(total)) return null;
      return {
        amount: total,
        currency: String(row.currency || 'CNY').toUpperCase(),
        granted: gift,
        topped: cash,
        credit: credit,
        frozen: frozen,
        available: body.is_available !== false
      };
    }
  },
  openrouter: {
    label: 'OpenRouter',
    authType: 'bearer',
    keyLabel: 'API Key',
    keysUrl: 'https://openrouter.ai/settings/keys',
    hint: '填写 OpenRouter API Key，可查看美元充值额度与已用消耗。',
    url: 'https://openrouter.ai/api/v1/credits',
    parse(body) {
      const data = body && body.data ? body.data : body;
      const bought = Number(data && data.total_credits);
      const used = Number(data && (data.total_usage !== undefined ? data.total_usage : data.usage));
      if (Number.isFinite(bought)) {
        return {
          amount: bought - (Number.isFinite(used) ? used : 0),
          currency: 'USD',
          granted: 0,
          topped: bought,
          used: Number.isFinite(used) ? used : 0,
          available: true
        };
      }
      const limitRem = Number(data && data.limit_remaining);
      if (Number.isFinite(limitRem)) {
        return {
          amount: limitRem,
          currency: 'USD',
          granted: 0,
          topped: Number(data && data.limit) || 0,
          used: Number.isFinite(used) ? used : 0,
          available: limitRem > 0
        };
      }
      return null;
    },
    async fetchBalance(entry, signal) {
      const headers = {
        authorization: 'Bearer ' + entry.key,
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; DSH-CreditExpiry/1.0)'
      };
      const res = await fetch('https://openrouter.ai/api/v1/credits', { headers, signal });
      const body = await res.json().catch(() => null);
      if (res.ok && body) {
        const parsed = this.parse(body);
        if (parsed) return { balance: parsed };
      }
      const keyRes = await fetch('https://openrouter.ai/api/v1/auth/key', { headers, signal }).catch(() => null);
      if (keyRes && keyRes.ok) {
        const keyBody = await keyRes.json().catch(() => null);
        const parsedKey = keyBody ? this.parse(keyBody) : null;
        if (parsedKey) return { balance: parsedKey };
        if (keyBody && keyBody.data) {
          const used = Number(keyBody.data.usage) || 0;
          return {
            balance: {
              amount: Number.isFinite(Number(entry.manualBalance)) ? Number(entry.manualBalance) : 0,
              currency: 'USD',
              granted: 0,
              topped: 0,
              used: used,
              available: true,
              note: '已用 $' + used.toFixed(2)
            }
          };
        }
      }
      const detail = (body && body.error && body.error.message) || '';
      return { error: res.status === 401 ? '密钥无效或已撤销' : ('HTTP ' + res.status + (detail ? '：' + detail : '')) };
    }
  },
  grok: {
    label: 'Grok / xAI',
    authType: 'teamkey',
    keyLabel: 'Management Key',
    secretLabel: 'Team ID',
    keysUrl: 'https://console.x.ai/',
    hint: '在 xAI Console 开启 Management Keys 权限后，填写 Management Key 与 Team ID 查询预付美元余额。',
    async fetchBalance(entry, signal) {
      if (!entry.secret) return { error: '需要填写 Team ID' };
      const href = 'https://management-api.x.ai/v1/billing/teams/' + encodeURIComponent(entry.secret) + '/prepaid/balance';
      const response = await fetch(href, {
        headers: { authorization: 'Bearer ' + entry.key, accept: 'application/json' },
        signal
      });
      if (!response.ok) {
        return { error: response.status === 401 || response.status === 403 ? 'Management Key 无效或无 Billing 权限' : ('HTTP ' + response.status) };
      }
      const body = await response.json().catch(() => null);
      const rawVal = body && body.total && body.total.val !== undefined ? Number(body.total.val) : NaN;
      if (!Number.isFinite(rawVal)) return { error: '无法解析 xAI 余额响应' };
      /* xAI stores prepaid credit as negative cents strings (e.g. "-1000" => $10.00). */
      return {
        balance: {
          amount: -rawVal / 100,
          currency: 'USD',
          granted: 0,
          topped: 0,
          available: (-rawVal) > 0
        }
      };
    }
  },
  aliyun: {
    label: '阿里云百炼 / 千问',
    authType: 'aksk',
    keyLabel: 'AccessKey ID',
    secretLabel: 'AccessKey Secret',
    keysUrl: 'https://ram.console.aliyun.com/users',
    hint: '建议创建仅含 AliyunBSSReadOnlyAccess 只读权限的 RAM 子账号，填写 AK 与 SK 可查账户余额及百炼资源包。',
    async fetchBalance(entry, signal) {
      if (!entry.secret) return { error: '需要填写 AccessKey Secret' };
      const balUrl = buildAliyunSignedUrl(entry.key, entry.secret, 'QueryAccountBalance');
      const pkgUrl = buildAliyunSignedUrl(entry.key, entry.secret, 'QueryResourcePackageInstances', { PageSize: '20', PageNum: '1' });
      const [balRes, pkgRes] = await Promise.all([
        fetch(balUrl, { headers: { accept: 'application/json' }, signal }),
        fetch(pkgUrl, { headers: { accept: 'application/json' }, signal }).catch(() => null)
      ]);
      const balBody = await balRes.json().catch(() => null);
      if (!balRes.ok || !balBody || balBody.Success === false) {
        const msg = (balBody && (balBody.Message || balBody.Code)) || ('HTTP ' + balRes.status);
        return { error: String(msg).slice(0, 120) };
      }
      const data = balBody.Data || {};
      const amount = cleanAmount(data.AvailableAmount);
      const cash = cleanAmount(data.AvailableCashAmount);
      const credit = cleanAmount(data.CreditAmount);
      if (!Number.isFinite(amount)) return { error: '无法解析阿里云余额响应' };
      const packages = [];
      if (pkgRes && pkgRes.ok) {
        const pkgBody = await pkgRes.json().catch(() => null);
        const rawList = pkgBody && pkgBody.Data && pkgBody.Data.Instances && Array.isArray(pkgBody.Data.Instances.Instance)
          ? pkgBody.Data.Instances.Instance
          : [];
        for (const inst of rawList) {
          if (!inst) continue;
          const rem = cleanAmount(inst.RemainingAmount);
          const tot = cleanAmount(inst.TotalAmount);
          if (!(rem > 0)) continue;
          const expMs = inst.ExpiryTime ? Date.parse(inst.ExpiryTime) : NaN;
          packages.push({
            name: inst.Remark || inst.PackageType || inst.CommodityCode || '资源包',
            remain: rem,
            size: Number.isFinite(tot) ? tot : rem,
            unit: inst.RemainingAmountUnit || '',
            expiresAtMs: Number.isFinite(expMs) ? expMs : null
          });
        }
        packages.sort((a, b) => (a.expiresAtMs || Infinity) - (b.expiresAtMs || Infinity));
      }
      return {
        balance: {
          amount: amount,
          currency: String(data.Currency || 'CNY').toUpperCase(),
          granted: 0,
          topped: Number.isFinite(cash) ? cash : 0,
          credit: Number.isFinite(credit) ? credit : 0,
          available: amount > 0,
          packages: packages.slice(0, 6)
        }
      };
    }
  },
  volcengine: {
    label: '火山引擎 / 火山方舟',
    authType: 'aksk',
    keyLabel: 'Access Key (AK)',
    secretLabel: 'Secret Key (SK)',
    keysUrl: 'https://console.volcengine.com/iam/keymanage/',
    hint: '建议创建仅授权 billing:QueryBalanceAcct 的 IAM 子账号，填写 AK 与 SK 查询现金及赠金余额。',
    async fetchBalance(entry, signal) {
      if (!entry.secret) return { error: '需要填写 Secret Key' };
      const signed = signVolcengineHeaders(entry.key, entry.secret, 'billing', 'cn-north-1', 'open.volcengineapi.com', {
        Action: 'QueryBalanceAcct',
        Version: '2022-01-01'
      });
      const response = await fetch(signed.url, { headers: signed.headers, signal });
      const body = await response.json().catch(() => null);
      if (!response.ok || (body && body.ResponseMetadata && body.ResponseMetadata.Error)) {
        const err = body && body.ResponseMetadata && body.ResponseMetadata.Error;
        return { error: err ? (err.Message || err.Code) : ('HTTP ' + response.status) };
      }
      const res = body && body.Result ? body.Result : null;
      const amount = res ? cleanAmount(res.AvailableBalance) : NaN;
      if (!Number.isFinite(amount)) return { error: '无法解析火山引擎余额响应' };
      const cash = cleanAmount(res.CashBalance);
      const credited = cleanAmount(res.CreditedBalance);
      const frozen = cleanAmount(res.FreezeBalance);
      return {
        balance: {
          amount: amount,
          currency: String(res.Currency || 'CNY').toUpperCase(),
          granted: Number.isFinite(credited) ? credited : 0,
          topped: Number.isFinite(cash) ? cash : 0,
          frozen: Number.isFinite(frozen) ? frozen : 0,
          available: amount > 0
        }
      };
    }
  },
  baidu: {
    label: '百度智能云 / 千帆',
    authType: 'aksk',
    keyLabel: 'Access Key (AK)',
    secretLabel: 'Secret Key (SK)',
    keysUrl: 'https://console.bce.baidu.com/iam/#/iam/accesslist',
    hint: '填写百度智能云主账号或含财务只读权限子账号的 AK 与 SK，查询现金余额。',
    async fetchBalance(entry, signal) {
      if (!entry.secret) return { error: '需要填写 Secret Key' };
      const host = 'billing.baidubce.com';
      const path = '/v1/finance/cash/balance';
      const headers = signBaiduBceHeaders(entry.key, entry.secret, 'POST', path, host);
      const response = await fetch('https://' + host + path, { method: 'POST', headers, body: '{}', signal });
      const body = await response.json().catch(() => null);
      if (!response.ok || (body && body.code && body.message)) {
        return { error: (body && body.message) || ('HTTP ' + response.status) };
      }
      const amount = body && body.cashBalance !== undefined ? Number(body.cashBalance) : NaN;
      if (!Number.isFinite(amount)) return { error: '无法解析百度智能云余额响应' };
      return {
        balance: {
          amount: amount,
          currency: 'CNY',
          granted: 0,
          topped: amount,
          available: amount > 0
        }
      };
    }
  }
};
