/**
 * 回归与新增功能守卫：
 *   - 日均消耗 burn 按日历填零后的最近 7 天算（含补齐 byPoolTokens/byPoolCalls）
 *   - 侧栏卡片支持「积分 / 额度」切换、焦点翻页、平台开关过滤总余额、mini.rows 生效
 *   - StatsView 隐藏平台后 Y 轴与合计重算、日均展示、点击筛选会话
 *   - DegradedBadge 与 SettingsEntry 含 useState，必须用 h(...) 元素渲染
 *   - SessionList 告别 window.prompt 改行内输入
 *   - /notify 支持自动提醒时段与提前天数配置
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CLIENT = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const HOST = readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');

const { summarizeUsage, apply } = await import(pathToFileURL(join(ROOT, 'lib', 'index.js')).href);

function bodyOf(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, '找不到函数 ' + name);
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail('花括号没配对: ' + name);
}

test('burn 口径：中间断更数天时按日历 7 天均摊，不被旧活跃日拉高', () => {
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const tenDaysAgo = new Date(Date.now() + 8 * 3600 * 1000 - 10 * 86400000).toISOString().slice(0, 10);
  const ledger = {
    days: {
      [tenDaysAgo]: { byProviderModel: { 'workbuddy:deepseek-v4.1-flash': { calls: 10, input: 900000, output: 100000 } } },
      [today]: { byProviderModel: { 'workbuddy:deepseek-v4.1-flash': { calls: 10, input: 900000, output: 100000 } } }
    }
  };
  const r = summarizeUsage(ledger, { consumed: { wb: 700 } });
  // wb 总消耗 700 在 10 天前与今天对半拆分（各 350）；最近 7 个自然日只有今天这 350，日均应为 350/7 = 50（而不是 (350+350)/7 = 100）
  assert.ok(Math.abs(r.burn.wb - 50) < 1e-6, '7 日日均应为 50，实际: ' + r.burn.wb);
  const emptyDay = r.daily.find((d) => d.date !== today && d.date !== tenDaysAgo);
  assert.ok(emptyDay, '应补齐空日历日');
  assert.deepEqual(emptyDay.byPoolTokens, {});
  assert.deepEqual(emptyDay.byPoolCalls, {});
});

test('Hook 守卫：DegradedBadge 与 SettingsEntry 含 useState，必须元素渲染', () => {
  const code = CLIENT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ['DegradedBadge', 'SettingsEntry'].forEach((name) => {
    assert.match(bodyOf(CLIENT, name), /React\.useState/, name + ' 含有 useState');
    assert.match(CLIENT, new RegExp('h\\(' + name + ','), name + ' 必须用 h(' + name + ', ...) 渲染');
    assert.doesNotMatch(code, new RegExp('(^|[^h])\\b' + name + '\\(\\{'), name + ' 不许裸调用');
  });
});

test('侧栏卡片：支持积分/额度切换、平台过滤总计、mini.rows 多行与焦点翻页', () => {
  const mini = bodyOf(CLIENT, 'MiniEntry');
  assert.match(mini, /miniQuotaItems/, 'MiniEntry 应支持额度视图');
  assert.match(mini, /switchMode\('quotas'/, '应能切换到额度页签');
  assert.match(mini, /prefs\.platforms\[i\.platform\] !== false/, '侧栏总计与到期项需按平台开关过滤');
  assert.match(mini, /setFocusIdx\(/, '焦点提醒卡应支持左右翻页切换');
  assert.match(mini, /renderSoonRows\(extraSoon\)/, 'mini.rows > 1 时应渲染更多近期到期行');
  assert.match(mini, /wb\.checkin|wbUnchecked/, '侧栏应展示签到状态提醒');
});

test('图表、日历、会话与订阅页签优化均在场', () => {
  const sv = bodyOf(CLIENT, 'StatsView');
  assert.match(sv, /visibleDayTotal/, '隐藏平台后应重算每日可见总计');
  assert.match(sv, /avgPerDay/, '应展示窗口内日均消耗');
  assert.match(sv, /hoverBanner/, '应提供悬停汇总条');

  const cal = bodyOf(CLIENT, 'ExpiryCalendar');
  assert.match(cal, /pickedDay/, '日历支持点击日期查看当日到期明细');

  const sess = bodyOf(CLIENT, 'SessionList');
  assert.doesNotMatch(sess, /window\.prompt/, '打标签不再使用 window.prompt');
  assert.match(sess, /dateFilter/, '会话列表支持按图表选中日期筛选');

  const sub = bodyOf(CLIENT, 'SubscriptionOverview');
  assert.match(sub, /quotaGlanceRows\(subscriptionRows\(data\)\)/, '订阅页签遵循区块开关');
  assert.match(sub, /t\('魔粒'\)/, '魔搭余额显示魔粒单位');
  assert.match(sub, /isAlarm/, '区分快到期与即将刷新样式');
});

test('宿主 /notify 支持自动提醒时段配置，且清空配置保持向后兼容', async () => {
  const prev = process.env.DSH_HOME;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-v014-'));
  process.env.DSH_HOME = temp;
  try {
    const routes = [];
    apply({
      webServer: { port: 1309, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
      connection: { requestRejection: () => undefined },
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
      slots: { contribute: () => {}, register: () => {} }
    });
    const handler = routes[0].handler;
    const post = (body) => new Promise((resolve) => {
      const buf = Buffer.from(JSON.stringify(body));
      const req = {
        url: '/credit-expiry/api/notify',
        method: 'POST',
        headers: { host: '127.0.0.1:1309' },
        socket: { remoteAddress: '127.0.0.1' },
        on: (ev, cb) => {
          if (ev === 'data') process.nextTick(() => cb(buf));
          else if (ev === 'end') process.nextTick(() => cb());
          return req;
        }
      };
      const st = { status: 0, body: '' };
      const res = {
        writeHead: (s) => { st.status = s; },
        end: (c) => { st.body = c || ''; resolve({ status: st.status, json: JSON.parse(st.body) }); }
      };
      handler(req, res);
    });

    const saved = await post({ action: 'config', url: 'https://open.feishu.cn/open-apis/bot/v2/hook/test', autoEnabled: true, autoHour: 10, warnDays: 14 });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.notify.kind, 'feishu');
    assert.equal(saved.json.notify.autoEnabled, true);
    assert.equal(saved.json.notify.autoHour, 10);
    assert.equal(saved.json.notify.warnDays, 14);

    const updated = await post({ action: 'config', url: '__KEEP__', autoEnabled: false });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.notify.hasUrl, true);
    assert.equal(updated.json.notify.autoEnabled, false);

    const cleared = await post({ action: 'config', url: '' });
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.json, { status: 'ok', notify: { kind: null, hasUrl: false } });
  } finally {
    process.env.DSH_HOME = prev;
    await rm(temp, { recursive: true, force: true });
  }
});

test('多平台 API 与云厂商余额：支持 10 家接入、校验 AK/SK 必填并解析套餐/赠金/资源包', async () => {
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-vendors-'));
  process.env.DSH_HOME = temp;
  const seenAuth = {};

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    const hdrs = init.headers || {};
    const auth = hdrs.authorization || hdrs.Authorization || '';
    if (href.includes('api.siliconflow.cn/v1/user/info')) {
      return new Response(JSON.stringify({ data: { totalBalance: '25.50', chargeBalance: '15.50', balance: '10.00', status: 'normal' } }), { status: 200 });
    }
    if (href.includes('open.bigmodel.cn/api/monitor/usage/quota/limit')) {
      return new Response(JSON.stringify({
        data: { limits: [{ type: 'TOKENS_LIMIT', unit: 3, number: 5, usage: 20, currentValue: 100, remaining: 80, percentage: 20, nextResetTime: Date.now() + 3600000 }] }
      }), { status: 200 });
    }
    if (href.includes('open.bigmodel.cn/api/biz/subscription/list')) {
      return new Response(JSON.stringify({ data: [{ productName: 'GLM Coding Pro', status: 'VALID', nextRenewTime: '2026-12-01' }] }), { status: 200 });
    }
    if (href.includes('api.xiaomimimo.com/v1/platform/balance')) {
      return new Response(JSON.stringify({
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_available: '18.8', cash_balance: '10', gift_balance: '8.8', credit_available: '50', frozen_balance: '1.2' }]
      }), { status: 200 });
    }
    if (href.includes('management-api.x.ai/v1/billing/teams/team-abc/prepaid/balance')) {
      return new Response(JSON.stringify({ total: { val: '-1050' } }), { status: 200 });
    }
    if (href.includes('business.aliyuncs.com') && href.includes('Action=QueryAccountBalance')) {
      seenAuth.aliyun = href.includes('Signature=');
      return new Response(JSON.stringify({ Data: { AvailableAmount: '123.45', AvailableCashAmount: '100.00', CreditAmount: '200.00', Currency: 'CNY' } }), { status: 200 });
    }
    if (href.includes('business.aliyuncs.com') && href.includes('Action=QueryResourcePackageInstances')) {
      return new Response(JSON.stringify({
        Data: {
          Instances: {
            Instance: [
              { Remark: '百炼百万Token包', RemainingAmount: '800', TotalAmount: '1000', RemainingAmountUnit: '万tok', ExpiryTime: '2026-12-30T00:00:00Z' },
              { Remark: '已耗尽包', RemainingAmount: '0', TotalAmount: '100', ExpiryTime: '2026-12-31T00:00:00Z' }
            ]
          }
        }
      }), { status: 200 });
    }
    if (href.includes('open.volcengineapi.com')) {
      seenAuth.volcengine = String(auth).startsWith('HMAC-SHA256 Credential=');
      return new Response(JSON.stringify({ Result: { AvailableBalance: '88.8', CashBalance: '60', CreditedBalance: '28.8', FreezeBalance: '2.0', Currency: 'CNY' } }), { status: 200 });
    }
    if (href.includes('billing.baidubce.com/v1/finance/cash/balance')) {
      seenAuth.baidu = String(auth).startsWith('bce-auth-v1/');
      return new Response(JSON.stringify({ cashBalance: 66.6 }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };

  try {
    const routes = [];
    apply({
      webServer: { port: 1309, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
      connection: { requestRejection: () => undefined },
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
      slots: { contribute: () => {}, register: () => {} }
    });
    const handler = routes[0].handler;
    const callRoute = (path, method = 'GET', bodyObj = null) => new Promise((resolve) => {
      const buf = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
      const req = {
        url: path,
        method,
        headers: { host: '127.0.0.1:1309' },
        socket: { remoteAddress: '127.0.0.1' },
        on: (ev, cb) => {
          if (ev === 'data' && buf) process.nextTick(() => cb(buf));
          else if (ev === 'end') process.nextTick(() => cb());
          return req;
        }
      };
      const st = { status: 0, body: '' };
      const res = {
        writeHead: (s) => { st.status = s; },
        end: (c) => { st.body = c || ''; resolve({ status: st.status, json: JSON.parse(st.body) }); }
      };
      handler(req, res);
    });

    const meta = await callRoute('/credit-expiry/api/keys');
    assert.equal(meta.status, 200);
    assert.equal(meta.json.vendors.length, 10);
    assert.ok(meta.json.vendors.every((v) => v.keysUrl && v.hint));

    const badAliyun = await callRoute('/credit-expiry/api/keys', 'POST', { action: 'add', account: { vendor: 'aliyun', key: 'demoak-1234' } });
    assert.equal(badAliyun.status, 400);

    const toAdd = [
      { vendor: 'siliconflow', key: 'demo-sf-1234', label: 'SF主号' },
      { vendor: 'zhipu', key: 'demo-zp-1234', label: '智谱套餐' },
      { vendor: 'xiaomi', key: 'demo-xm-1234', label: '小米' },
      { vendor: 'grok', key: 'demo-xai-1234', secret: 'team-abc', label: 'Grok团队' },
      { vendor: 'aliyun', key: 'demo-ali-ak', secret: 'demo-ali-sk', label: '阿里云' },
      { vendor: 'volcengine', key: 'demo-volc-ak', secret: 'demo-volc-sk', label: '火山' },
      { vendor: 'baidu', key: 'demo-bd-ak', secret: 'demo-bd-sk', label: '百度' }
    ];
    let lastAdd = null;
    for (const account of toAdd) {
      lastAdd = await callRoute('/credit-expiry/api/keys', 'POST', { action: 'add', account });
      assert.equal(lastAdd.status, 200, account.vendor + ' 保存应成功');
    }
    const aliyunMasked = lastAdd.json.accounts.find((a) => a.vendor === 'aliyun');
    assert.ok(aliyunMasked.secretMasked && !aliyunMasked.secret && !aliyunMasked.key, '密钥与 Secret 不得回传明文');

    const dataRes = await callRoute('/credit-expiry/api/data');
    assert.equal(dataRes.status, 200);
    const keys = dataRes.json.keys;
    assert.equal(keys.length, 7);

    const byV = Object.fromEntries(keys.map((k) => [k.vendor, k]));
    assert.equal(byV.siliconflow.balance.amount, 25.5);
    assert.equal(byV.siliconflow.balance.granted, 10);
    assert.equal(byV.siliconflow.balance.topped, 15.5);
    assert.match(byV.siliconflow.balance.note, /10\.00/);

    assert.equal(byV.zhipu.balance.currency, 'PCT');
    assert.equal(byV.zhipu.balance.planName, 'GLM Coding Pro');
    assert.equal(byV.zhipu.balance.renewAt, '2026-12-01');
    assert.equal(byV.zhipu.balance.windows.length, 1);

    assert.equal(byV.xiaomi.balance.amount, 18.8);
    assert.equal(byV.xiaomi.balance.credit, 50);
    assert.equal(byV.xiaomi.balance.frozen, 1.2);

    assert.equal(byV.grok.balance.amount, 10.5);
    assert.equal(byV.grok.balance.currency, 'USD');

    assert.equal(byV.aliyun.balance.amount, 123.45);
    assert.equal(byV.aliyun.balance.packages.length, 1);
    assert.equal(byV.aliyun.balance.packages[0].name, '百炼百万Token包');
    assert.equal(seenAuth.aliyun, true);

    assert.equal(byV.volcengine.balance.amount, 88.8);
    assert.equal(byV.volcengine.balance.granted, 28.8);
    assert.equal(seenAuth.volcengine, true);

    assert.equal(byV.baidu.balance.amount, 66.6);
    assert.equal(seenAuth.baidu, true);
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }
});

test('sourceStatus 准确区分插件未安装与未登录，且前端支持双字段表单与引导', async () => {
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-status-'));
  process.env.DSH_HOME = temp;

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/plugins/dsh-connect-workbuddy/usage')) return new Response('missing', { status: 404 });
    if (href.includes('/plugins/dsh-connect-trae/usage')) return new Response('unauthorized', { status: 401 });
    if (href.includes('/plugins/dsh-connect-minimaxcode/status')) return new Response(JSON.stringify({ status: 'signed-out' }), { status: 200 });
    return new Response(JSON.stringify({ status: 'signed-out' }), { status: 200 });
  };

  try {
    const routes = [];
    apply({
      webServer: { port: 1309, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
      connection: { requestRejection: () => undefined },
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
      slots: { contribute: () => {}, register: () => {} }
    });
    const handler = routes[0].handler;
    const dataRes = await new Promise((resolve) => {
      const req = { url: '/credit-expiry/api/data', method: 'GET', headers: { host: '127.0.0.1:1309' }, socket: { remoteAddress: '127.0.0.1' }, on: () => req };
      const st = { status: 0, body: '' };
      handler(req, { writeHead: (s) => { st.status = s; }, end: (c) => resolve({ status: st.status, json: JSON.parse(c || '{}') }) });
    });
    assert.equal(dataRes.status, 200);
    assert.equal(dataRes.json.sourceStatus.wb.state, 'not-installed');
    assert.equal(dataRes.json.sourceStatus.tr.state, 'signed-out');
    assert.equal(dataRes.json.sourceStatus.mm.state, 'signed-out');
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }

  const km = bodyOf(CLIENT, 'KeyManager');
  assert.match(km, /secretText/, 'KeyManager 支持第二凭据输入');
  assert.match(km, /selectedVendor\.keysUrl/, 'KeyManager 展示获取链接');
  const kb = bodyOf(CLIENT, 'KeyBalances');
  assert.match(kb, /b\.packages/, 'KeyBalances 展示资源包列表');
  assert.match(kb, /b\.windows/, 'KeyBalances 展示套餐配额窗口');
  const sub = bodyOf(CLIENT, 'SubscriptionOverview');
  assert.match(sub, /SOURCE_GUIDES/, '订阅卡包含缺失插件安装与登录引导');
  assert.match(sub, /zhipuKeys/, '订阅页展示智谱 GLM Coding Plan');
  const miniQ = bodyOf(CLIENT, 'miniQuotaItems');
  assert.match(miniQ, /'zhipu'/, '侧栏额度切换同步支持智谱 GLM Coding Plan');
});

test('硅基流动容错（去除 Bearer 前缀、cn/com 回退、详细错误）与 /keys test 动作', async () => {
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-sf-'));
  process.env.DSH_HOME = temp;
  let seenAuth = '';

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    seenAuth = (init.headers && (init.headers.authorization || init.headers.Authorization)) || '';
    if (href.includes('api.siliconflow.cn/v1/user/info')) {
      return new Response(JSON.stringify({ code: 30014, message: 'Token is invalid.' }), { status: 401 });
    }
    if (href.includes('api.siliconflow.com/v1/user/info')) {
      if (seenAuth === 'Bearer demo-com-key') {
        return new Response(JSON.stringify({ data: { totalBalance: '12.50', balance: '2.50', status: 'normal' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 30014, message: 'Token is invalid.' }), { status: 401 });
    }
    return new Response('{}', { status: 404 });
  };

  try {
    const routes = [];
    apply({
      webServer: { port: 1309, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
      connection: { requestRejection: () => undefined },
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
      slots: { contribute: () => {}, register: () => {} }
    });
    const handler = routes[0].handler;
    const postKeys = (body) => new Promise((resolve) => {
      const buf = Buffer.from(JSON.stringify(body));
      const req = {
        url: '/credit-expiry/api/keys',
        method: 'POST',
        headers: { host: '127.0.0.1:1309' },
        socket: { remoteAddress: '127.0.0.1' },
        on: (ev, cb) => {
          if (ev === 'data') process.nextTick(() => cb(buf));
          else if (ev === 'end') process.nextTick(() => cb());
          return req;
        }
      };
      const st = { status: 0, body: '' };
      handler(req, { writeHead: (s) => { st.status = s; }, end: (c) => resolve({ status: st.status, json: JSON.parse(c || '{}') }) });
    });

    const badTest = await postKeys({ action: 'test', account: { vendor: 'siliconflow', key: 'Bearer bad-key-123' } });
    assert.equal(badTest.status, 200);
    assert.equal(badTest.json.status, 'error');
    assert.equal(seenAuth, 'Bearer bad-key-123', '应自动剥离重复的 Bearer 前缀');
    assert.match(badTest.json.error, /Token is invalid/);

    const okCom = await postKeys({ action: 'test', account: { vendor: 'siliconflow', key: 'Bearer demo-com-key' } });
    assert.equal(okCom.status, 200);
    assert.equal(okCom.json.status, 'ok');
    assert.equal(okCom.json.account.balance.amount, 12.5);
    assert.equal(okCom.json.account.balance.currency, 'USD');
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }
});

test('主界面、侧栏、订阅页占位与设置拖拽排序均接入全部平台', () => {
  assert.match(CLIENT, /var ALL_CARD_ORDER = \[/);
  assert.match(CLIENT, /cardHidden: \{\}/);
  assert.match(CLIENT, /cardOrder: ALL_CARD_ORDER\.slice\(\)/);

  const poe = bodyOf(CLIENT, 'PlatformOrderEditor');
  assert.match(poe, /React\.useState/);
  assert.match(poe, /draggable: true/);
  assert.match(poe, /onDrop:/);
  assert.match(CLIENT, /h\(PlatformOrderEditor,/, 'PlatformOrderEditor 必须以元素形式挂载');

  const pv = bodyOf(CLIENT, 'PanelView');
  assert.match(pv, /KeyOverviewGrid\(/, '主界面总览应展示已设置的 API 卡片');

  const mini = bodyOf(CLIENT, 'MiniEntry');
  assert.match(mini, /visibleApiKeys/, '侧栏应展示已配置的 API 卡片');
  assert.match(bodyOf(CLIENT, 'miniQuotaItems'), /VENDOR_META\[k\.vendor\]/, '侧栏额度模式应涵盖全部 API 平台');

  const sub = bodyOf(CLIENT, 'SubscriptionOverview');
  assert.match(sub, /renderVendorCards/, '订阅页签应直接展示所有 API 平台占位与登录引导');
  assert.match(sub, /renderQuickForm/, '订阅页签支持原地填入与测试密钥');
});
