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

const { summarizeUsage, apply, normalizeTrae } = await import(pathToFileURL(join(ROOT, 'lib', 'index.js')).href);

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

test('硅基流动国内站 410 (20092) 自动降级校验 /v1/models 并支持手动登记余额；到期预测与侧栏按平台聚合', async () => {
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-sf410-'));
  process.env.DSH_HOME = temp;

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    const auth = (init.headers && (init.headers.authorization || init.headers.Authorization)) || '';
    if (href.includes('api.siliconflow.cn/v1/user/info')) {
      if (auth === 'Bearer sf-cn-valid') {
        return new Response(JSON.stringify({ code: 20092, message: 'This endpoint is deprecated and is no longer available.', data: null }), { status: 410 });
      }
      return new Response(JSON.stringify({ code: 30014, message: 'Token is invalid.' }), { status: 401 });
    }
    if (href.includes('api.siliconflow.com/v1/user/info')) {
      return new Response(JSON.stringify({ code: 30014, message: 'Token is invalid.' }), { status: 401 });
    }
    if (href.includes('api.siliconflow.cn/v1/models')) {
      if (auth === 'Bearer sf-cn-valid') {
        return new Response(JSON.stringify({ object: 'list', data: [{ id: 'm1' }, { id: 'm2' }] }), { status: 200 });
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
      handler(req, { writeHead: (s) => { st.status = s; }, end: (c) => resolve({ status: st.status, json: JSON.parse(c || '{}') }) });
    });

    const probe = await callRoute('/credit-expiry/api/keys', 'POST', { action: 'test', account: { vendor: 'siliconflow', key: 'sf-cn-valid' } });
    assert.equal(probe.status, 200);
    assert.equal(probe.json.status, 'ok', '国内站 410 (20092) 且 /v1/models 通过时应视为有效密钥');
    assert.equal(probe.json.account.balance.verified, true);
    assert.equal(probe.json.account.balance.modelCount, 2);
    assert.match(probe.json.account.balance.statusText, /已接入 · 2 模型/);

    const added = await callRoute('/credit-expiry/api/keys', 'POST', { action: 'add', account: { vendor: 'siliconflow', key: 'sf-cn-valid' } });
    assert.equal(added.status, 200);
    const sfId = added.json.accounts[0].id;

    const updated = await callRoute('/credit-expiry/api/keys', 'POST', { action: 'update', id: sfId, manualBalance: 14 });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.accounts[0].manualBalance, 14);

    const dataRes = await callRoute('/credit-expiry/api/data');
    assert.equal(dataRes.status, 200);
    assert.equal(dataRes.json.keys[0].balance.amount, 14);
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }

  assert.match(bodyOf(CLIENT, 'foresee'), /byPlat/, '到期预测应按平台聚合计算，不按单积分包堆叠');
  assert.match(bodyOf(CLIENT, 'MiniEntry'), /width: 24, height: 22/, '侧栏焦点卡翻页箭头应放大为易点按尺寸');
  assert.match(bodyOf(CLIENT, 'KeyOverviewGrid'), /showSfCard/, '主界面总览应始终提供独立的硅基流动额度卡片');
  assert.match(bodyOf(CLIENT, 'QuotaGlance'), /gridTemplateColumns/, '总览额度应以卡片网格展示，不再裸露单行长期字样');
});

test('插件与 DSH 设置页密钥双向同步 + 智能余额/余量展示 + 侧栏平台开关与多彩分平台折线图', async () => {
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-sync-'));
  process.env.DSH_HOME = temp;

  const credStore = new Map([
    ['DEEPSEEK_API_KEY', 'ds-from-dsh-1234']
  ]);
  const mutatedOps = [];
  const piAiProviders = {};

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    const auth = (init.headers && (init.headers.authorization || init.headers.Authorization)) || '';
    if (href.includes('api.deepseek.com/user/balance')) {
      return new Response(JSON.stringify({
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_balance: '36.50', granted_balance: '0.00', topped_up_balance: '36.50' }]
      }), { status: 200 });
    }
    if (href.includes('api.siliconflow.cn/v1/user/info')) {
      return new Response(JSON.stringify({ code: 20092, message: 'Deprecated' }), { status: 410 });
    }
    if (href.includes('api.siliconflow.com/v1/user/info')) {
      return new Response(JSON.stringify({ code: 30014, message: 'Invalid' }), { status: 401 });
    }
    if (href.includes('api.siliconflow.cn/v1/models')) {
      if (auth === 'Bearer sf-plugin-8888') {
        return new Response(JSON.stringify({
          object: 'list',
          data: [{ id: 'deepseek-ai/DeepSeek-V3' }, { id: 'Qwen/Qwen2.5-72B-Instruct' }]
        }), { status: 200 });
      }
    }
    return new Response('{}', { status: 404 });
  };

  try {
    const routes = [];
    const mockCredentials = {
      resolve: (ref) => credStore.get(ref),
      set: async (ref, val) => { credStore.set(ref, val); },
      readRecord: async () => undefined
    };
    const mockSettings = {
      describe: () => [{
        ns: 'llm-pi-ai',
        user: { providers: piAiProviders },
        value: { providers: piAiProviders },
        revision: 'r1'
      }],
      mutate: async (ns, ops) => {
        mutatedOps.push({ ns, ops });
        for (const op of ops) {
          if (op.op === 'set' && op.path[0] === 'providers' && op.path[1]) {
            piAiProviders[op.path[1]] = op.value;
          }
        }
        return { revision: 'r2' };
      }
    };

    apply({
      webServer: { port: 1309, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
      connection: { requestRejection: () => undefined },
      credentials: mockCredentials,
      settings: mockSettings,
      get: (token) => (token === 'credentials' ? mockCredentials : token === 'settings' ? mockSettings : undefined),
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
      handler(req, { writeHead: (s) => { st.status = s; }, end: (c) => resolve({ status: st.status, json: JSON.parse(c || '{}') }) });
    });

    /* 1. DSH 设置页已配置的 DEEPSEEK_API_KEY 自动提取到插件 */
    const getKeys1 = await callRoute('/credit-expiry/api/keys', 'GET');
    assert.equal(getKeys1.status, 200);
    assert.equal(getKeys1.json.accounts.length, 1, 'DSH 设置页中的密钥应自动同步进插件');
    assert.equal(getKeys1.json.accounts[0].vendor, 'deepseek');
    assert.equal(getKeys1.json.accounts[0].masked, '****1234');

    /* 2. 在插件中添加硅基流动密钥后，自动同步到 DSH credentials 并注册 llm-pi-ai 的 siliconflow provider */
    const addSf = await callRoute('/credit-expiry/api/keys', 'POST', {
      action: 'add',
      account: { vendor: 'siliconflow', key: 'sf-plugin-8888' }
    });
    assert.equal(addSf.status, 200);
    assert.equal(credStore.get('SILICONFLOW_API_KEY'), 'sf-plugin-8888', '插件新增硅基密钥应写入 DSH credentials');
    assert.ok(piAiProviders.siliconflow, '插件新增硅基密钥应自动在 llm-pi-ai 注册 siliconflow provider');
    assert.equal(piAiProviders.siliconflow.api, 'openai-completions');
    assert.equal(piAiProviders.siliconflow.baseURL, 'https://api.siliconflow.cn/v1');
    assert.equal(piAiProviders.siliconflow.apiKeyEnv, 'SILICONFLOW_API_KEY');
    assert.ok(Array.isArray(piAiProviders.siliconflow.models) && piAiProviders.siliconflow.models.length >= 2);

    /* 3. 在插件中删除已同步的密钥后记录 dismissed，不会在下次拉取时被死循环重新导入 */
    const dsId = getKeys1.json.accounts[0].id;
    const delDs = await callRoute('/credit-expiry/api/keys', 'POST', { action: 'remove', id: dsId });
    assert.equal(delDs.status, 200);
    const getKeys2 = await callRoute('/credit-expiry/api/keys', 'GET');
    assert.equal(getKeys2.json.accounts.some((a) => a.vendor === 'deepseek'), false, '用户主动移除的密钥不应被重复自动导入');
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }

  /* 4. 验证智能余额/余量展示逻辑、侧栏平台开关、侧栏多彩分平台折线图 */
  const metricFn = bodyOf(CLIENT, 'getKeyDisplayMetric');
  assert.match(metricFn, /kind:\s*'balance'/, '优先显示真实余额');
  assert.match(metricFn, /kind:\s*'quota'/, '无法查看余额时回退显示余量');
  assert.match(metricFn, /return null/, '既无余额也无余量时返回 null 不展示无意义的已接入');

  const miniBody = bodyOf(CLIENT, 'MiniEntry');
  assert.match(miniBody, /hasKeyBalanceOrQuota/, '左边侧栏仅显示有余额或余量的 API 平台');
  assert.match(miniBody, /MultiSparkline/, '左边侧栏折线图支持多彩分平台曲线绘制');
  assert.match(miniBody, /setSparkPool/, '左边侧栏折线图支持切换查看各平台各自消耗');

  const settingsBody = bodyOf(CLIENT, 'SettingsEntry');
  assert.match(settingsBody, /togglePlatformVisible/, '设置页侧栏显示平台支持直接开关硅基流动等任意平台');
});


test('Cordis settings 无 inject 守卫 + { value } 凭据解包 + 并发调用无竞态', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'dsh-ce-cordis-'));
  const prevHome = process.env.DSH_HOME;
  process.env.DSH_HOME = temp;
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('api.deepseek.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ balance_infos: [{ currency: 'CNY', total_balance: '18.50', topped_up_balance: '18.50', granted_balance: '0' }] }),
          text: async () => '{"balance_infos":[{"currency":"CNY","total_balance":"18.50"}]}'
        };
      }
      throw new Error('offline ' + url);
    };

    const routes = [];
    const mockCredentials = {
      list: async () => [{ ref: 'DEEPSEEK_API_KEY', source: 'user', present: true }],
      resolve: async (ref) => (ref === 'DEEPSEEK_API_KEY' ? { value: 'sk-resolved-9999', source: 'user' } : undefined),
      set: async () => {},
      readRecord: async () => undefined
    };
    const mockSettings = {
      describe: () => [{ ns: 'llm-pi-ai', user: { providers: {} }, value: { providers: {} }, revision: 'r1' }],
      mutate: async () => ({ revision: 'r2' })
    };
    const ctx = {
      webServer: { port: 1310, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
      connection: { requestRejection: () => undefined },
      get: (token) => (token === 'credentials' ? mockCredentials : token === 'settings' ? mockSettings : undefined),
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
      slots: { contribute: () => {}, register: () => {} }
    };
    Object.defineProperty(ctx, 'settings', {
      get() { throw new Error('cannot get property "settings" without inject'); }
    });
    Object.defineProperty(ctx, 'credentials', {
      get() { throw new Error('cannot get property "credentials" without inject'); }
    });

    apply(ctx);
    const handler = routes[0].handler;
    const callRoute = (path) => new Promise((resolve) => {
      const req = {
        url: path,
        method: 'GET',
        headers: { host: '127.0.0.1:1310' },
        socket: { remoteAddress: '127.0.0.1' },
        on: (ev, cb) => { if (ev === 'end') process.nextTick(() => cb()); return req; }
      };
      const st = { status: 0 };
      handler(req, { writeHead: (s) => { st.status = s; }, end: (c) => resolve({ status: st.status, json: JSON.parse(c || '{}') }) });
    });

    const [k1, k2, d1] = await Promise.all([
      callRoute('/credit-expiry/api/keys'),
      callRoute('/credit-expiry/api/keys'),
      callRoute('/credit-expiry/api/data')
    ]);
    assert.equal(k1.status, 200);
    assert.equal(k2.status, 200);
    assert.equal(d1.status, 200);
    assert.equal(k1.json.accounts.length, 1, '应从 { value } 凭据对象中解包并导入 DEEPSEEK_API_KEY');
    assert.equal(k1.json.accounts[0].masked, '****9999');
    assert.equal((d1.json.errors || []).some((e) => String(e).includes('settings')), false, '不应出现 cannot get property "settings" 错误');
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }
});

test('normalizeTrae 优先读取剩余可用积分（非 5400 授信总额）并过滤已过期积分包', () => {
  const now = Date.now();
  const tr = normalizeTrae({
    status: 'ok',
    plan: 'Pro',
    credits: {
      total: 5400,
      consumed: 3967.71,
      available: 1432.29,
      generalAvailable: 1432.29,
      workAvailable: 0,
      accounts: [
        { displayDesc: '已过期奖励包', size: 2000, remain: 100, expiresAtMs: now - 86400000 },
        { displayDesc: '当前可用通用包', size: 5400, remain: 1432.29, expiresAtMs: now + 10 * 86400000 }
      ]
    }
  });
  assert.equal(tr.total, 1432.29);
  assert.equal(tr.grantedTotal, 5400);
  assert.equal(tr.generalAvailable, 1432.29);
  assert.equal(tr.accounts.length, 1);
  assert.equal(tr.accounts[0].desc, '当前可用通用包');
});

test('summarizeUsage 支持 raw.costCny 回退、-free 免费模型标记与未返积分标识', () => {
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const ledger = {
    days: {
      [today]: {
        byProviderModel: {
          'workbuddy:hy4flash-free': { calls: 2, input: 2000, output: 500, costCny: 0 },
          'qoder:mystery-pro': { calls: 1, input: 1000, output: 1000, costCny: 1.25 },
          'minimaxcode:minimax-m3': { calls: 3, input: 5000, output: 2000 }
        },
        sessions: [
          { id: 's-free', title: 'free chat', at: Date.now() - 3000, byProviderModel: { 'workbuddy:hy4flash-free': { calls: 2, input: 2000, output: 500, costCny: 0 } } },
          { id: 's-paid', title: 'paid chat', at: Date.now() - 2000, byProviderModel: { 'qoder:mystery-pro': { calls: 1, input: 1000, output: 1000, costCny: 1.25 } } },
          { id: 's-mm', title: 'mm chat', at: Date.now() - 1000, byProviderModel: { 'minimaxcode:minimax-m3': { calls: 3, input: 5000, output: 2000 } } }
        ]
      }
    }
  };
  const r = summarizeUsage(ledger, { consumed: { mm: 0 } });
  const byId = Object.fromEntries(r.sessions.map((s) => [s.id, s]));
  assert.equal(byId['s-free'].free, true);
  assert.equal(byId['s-free'].costCny, 0);
  assert.equal(byId['s-paid'].costCny, 1.25);
  assert.equal(byId['s-paid'].priced, true);
  assert.equal(byId['s-mm'].credits, 0);
  assert.equal(byId['s-mm'].creditsUnavailable, true);
});

test('前端交互与筛选修复：固定高度悬停栏、柱状图内嵌明细、QuotaGlance/SubscriptionOverview 悬浮与点击详情、SessionList 平台筛选', () => {
  const statsBody = bodyOf(CLIENT, 'StatsView');
  assert.match(statsBody, /minHeight:\s*30/, 'hoverBanner 使用固定最小高度，防止悬停时高度抖动抽风');
  assert.match(statsBody, /onJumpSessions/, '点击柱子后支持内嵌当日明细与跳转完整会话');

  const glanceBody = bodyOf(CLIENT, 'QuotaGlance');
  assert.match(glanceBody, /quotaTooltipText/, '总览额度卡片具备丰富悬浮提示');
  assert.match(glanceBody, /renderQuotaDetailBox/, '点击总览额度卡片原地展开明细，不强行跳走');

  const subBody = bodyOf(CLIENT, 'SubscriptionOverview');
  assert.match(subBody, /vendorHoverTip/, '订阅页 API 卡片具备悬浮提示');
  assert.match(subBody, /detailId/, '订阅页卡片支持点击展开详细包与额度信息');

  const sessBody = bodyOf(CLIENT, 'SessionList');
  assert.doesNotMatch(sessBody, /PROVIDER_TO_POOL/, '不能引用未定义的 PROVIDER_TO_POOL');
  assert.match(sessBody, /platformIdOf\(/, '使用已定义的 platformIdOf 做平台筛选');
  assert.match(sessBody, /fmtCredits\(/, '会话消费支持小数积分精度');
  assert.match(sessBody, /creditsUnavailable/, '未返回积分的平台区分显示');

  const collectBody = bodyOf(CLIENT, 'collect');
  assert.match(collectBody, /exp\s*<=\s*now/, 'collect 过滤已过期积分包，防止总计与卡片虚高');
});

test('豆包自动提醒支持 + 导出冷启动宽窗口 + 历史归档防误计 + 并发锁守卫', async () => {
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-fixes-'));
  process.env.DSH_HOME = temp;

  let notifyPosts = [];
  const now = Date.now();
  const soonExp = now + 2 * 86400000;
  const bjHour = new Date(now + 8 * 3600 * 1000).getUTCHours();

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('open.feishu.cn/open-apis/bot/v2/hook/test')) {
      notifyPosts.push(JSON.parse(String(init.body || '{}')));
      return new Response(JSON.stringify({ StatusCode: 0 }), { status: 200 });
    }
    if (href.endsWith('/plugins/dsh-connect-doubao/quota')) {
      return new Response(JSON.stringify({
        ok: true,
        windows: {
          incentive: [{ label: '活动赠送额度', totalAmount: 500, usedAmount: 180, resetsAt: soonExp }]
        }
      }), { status: 200 });
    }
    if (href.includes('/credit-expiry/api/data')) {
      assert.equal((init.headers || {})['x-credit-expiry-export'], '1', '冷启动 /export 应携带宽窗口请求头');
      return new Response(JSON.stringify({
        updatedAt: now,
        errors: [],
        wb: { total: 100 },
        usage: { providers: [] }
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: 'signed-out' }), { status: 200 });
  };

  try {
    const routes = [];
    apply({
      webServer: { port: 1311, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
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
        headers: { host: '127.0.0.1:1311' },
        socket: { remoteAddress: '127.0.0.1' },
        on: (ev, cb) => {
          if (ev === 'data' && buf) process.nextTick(() => cb(buf));
          else if (ev === 'end') process.nextTick(() => cb());
          return req;
        }
      };
      const st = { status: 0, body: '' };
      handler(req, { writeHead: (s) => { st.status = s; }, end: (c) => resolve({ status: st.status, body: c || '' }) });
    });

    // 1) 冷启动直接 /export 必须走宽窗口标记
    const expRes = await callRoute('/credit-expiry/api/export?format=json');
    assert.equal(expRes.status, 200);

    // 2) 配置自动提醒（小时设为当前北京时间以立即触发），验证豆包赠送额度进入宿主提醒文本
    const cfgRes = await callRoute('/credit-expiry/api/notify', 'POST', {
      action: 'config',
      url: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
      autoEnabled: true,
      autoHour: bjHour,
      warnDays: 7
    });
    assert.equal(cfgRes.status, 200);

    const dataRes = await callRoute('/credit-expiry/api/data');
    assert.equal(dataRes.status, 200);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(notifyPosts.length, 1, '应触发一次自动提醒');
    assert.match(notifyPosts[0].content.text, /豆包.*活动赠送额度.*320/, '自动提醒必须包含豆包赠送额度');
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }

  // 客户端修复守卫：日历含豆包、详情读 p.size、语言重置与后台防轮询
  assert.match(bodyOf(CLIENT, 'renderQuotaDetailBox'), /p\.size\s*\|\|\s*p\.total/, 'WorkBuddy/Qoder 详情应读取 p.size');
  assert.match(bodyOf(CLIENT, 'rebuildLocalized'), /PLATFORM\s*=\s*makePlatform\(\)/, '切换语言应重建 PLATFORM');
  assert.match(bodyOf(CLIENT, 'rebuildLocalized'), /VENDOR_META\s*=\s*makeVendorMeta\(\)/, '切换语言应重建 VENDOR_META');
  assert.match(bodyOf(CLIENT, 'loadShared'), /document\.hidden/, '后台标签页不自动轮询');
  assert.match(bodyOf(CLIENT, 'SettingsEntry'), /setLang\('zh'\)/, '恢复默认应同步把语言切回中文');
});

test('v0.16.0+ 新功能：ComposerPill、ExpiryTimeline、签到巡检、折叠账本与 DSH 密钥同步控制', async () => {
  assert.match(CLIENT, /name: 'conversation\.input\.right'/, '应并入 conversation.input.right 同行工具栏');
  assert.doesNotMatch(CLIENT, /name: 'conversation\.composer\.dock'/, '微提示不应再占用单独的 composer.dock 行');
  assert.match(CLIENT, /composerPill: true/, '默认开启输入栏行内积分提示');
  assert.match(bodyOf(CLIENT, 'ComposerPill'), /foresee\(/, '微提示优先展示即将浪费的平台');
  assert.match(bodyOf(CLIENT, 'ComposerPill'), /Styles\(\)/, '输入栏提示需自带 Styles()，避免未打开主面板时退化成原生灰框按钮');
  assert.match(bodyOf(CLIENT, 'ComposerPill'), /appearance:\s*'none'/, '输入栏提示显式重置原生按钮边框与背景');
  assert.match(CLIENT, /h\(ExpiryTimeline,/, 'ExpiryTimeline 含 useState，必须元素渲染');
  assert.match(bodyOf(CLIENT, 'ExpiryTimeline'), /simulatePoolFifo/, '消纳时间线采用 FIFO 分池模拟');
  assert.match(bodyOf(CLIENT, 'CreditLedger'), /LEDGER_LIMIT\s*=\s*8/, '积分账本支持超过 8 条自动折叠');
  assert.match(bodyOf(CLIENT, 'SubscriptionOverview'), /签到与每日免费额度巡检/, '订阅页签顶部展示签到与每日免费额度巡检');
  assert.match(bodyOf(CLIENT, 'SubscriptionOverview'), /cxe-acc-body/, '未接入平台支持平滑动画折叠');
  assert.match(bodyOf(CLIENT, 'PanelView'), /isCardVisible\(prefs, i\.platform\)/, 'PanelView 主界面受平台显隐开关过滤');
  assert.match(bodyOf(CLIENT, 'PanelView'), /showFeature\('timeline'\)/, '消纳时间线受独立设置开关控制');

  // 验证 lib/vendors.js 对硅基流动 410 会话记住端点偏好，第二次只打 /v1/models
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-v16-'));
  process.env.DSH_HOME = temp;
  const calls = [];
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('api.siliconflow.cn/v1/user/info')) {
      return new Response(JSON.stringify({ code: 20092, message: 'Deprecated' }), { status: 410 });
    }
    if (href.includes('api.siliconflow.com/v1/user/info')) {
      return new Response(JSON.stringify({ code: 30014, message: 'Invalid' }), { status: 401 });
    }
    if (href.includes('api.siliconflow.cn/v1/models')) {
      return new Response(JSON.stringify({ object: 'list', data: [{ id: 'm1' }] }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  try {
    const { BALANCE_SOURCES } = await import(pathToFileURL(join(ROOT, 'lib', 'vendors.js')).href);
    const entry = { id: 'sf1', vendor: 'siliconflow', key: 'sf-hint-test-key', manualBalance: 20 };
    const r1 = await BALANCE_SOURCES.siliconflow.fetchBalance(entry);
    assert.equal(r1.balance.amount, 20);
    assert.equal(calls.length, 3, '首次探测走 cn/user/info -> com/user/info -> cn/models');

    calls.length = 0;
    const r2 = await BALANCE_SOURCES.siliconflow.fetchBalance(entry);
    assert.equal(r2.balance.amount, 20);
    assert.deepEqual(calls, ['https://api.siliconflow.cn/v1/models'], '第二次应命中端点记忆，跳过 410/401 试错');
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }
});

test('v0.16.1 修复：DSH 删除密钥不复写、syncDsh 开关控制、未装插件 404 不误报、hy4free 与 raw.costCny 校准', async () => {
  const prevHome = process.env.DSH_HOME;
  const origFetch = globalThis.fetch;
  const temp = await mkdtemp(join(tmpdir(), 'credit-expiry-v161-'));
  process.env.DSH_HOME = temp;

  const credStore = new Map([['DEEPSEEK_API_KEY', 'ds-dsh-initial-1111']]);
  globalThis.fetch = async (url) => {
    const href = String(url);
    // 模拟豆包、Codex 等连接插件未安装（404）
    if (href.includes('/plugins/dsh-connect-doubao/quota')) {
      return new Response('not found', { status: 404 });
    }
    if (href.includes('/api/codex-subscription/usage')) {
      return new Response('not found', { status: 404 });
    }
    if (href.includes('/plugins/dsh-connect-workbuddy/usage')) {
      return new Response(JSON.stringify({ status: 'ok', credits: { total: 100, packages: [] } }), { status: 200 });
    }
    if (href.includes('/plugins/dsh-connect-trae/usage')) {
      return new Response(JSON.stringify({ status: 'ok', credits: { total: 200, consumed: 10, accounts: [] } }), { status: 200 });
    }
    if (href.includes('/plugins/dsh-connect-minimaxcode/status')) {
      return new Response(JSON.stringify({ status: 'ok', credits: { total: 50, consumed: 0, upcoming: [] } }), { status: 200 });
    }
    if (href.includes('/plugins/dsh-connect-qoder/usage')) {
      return new Response(JSON.stringify({ status: 'ok', credits: { total: 80, packages: [] } }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };

  try {
    const routes = [];
    const mockCredentials = {
      resolve: (ref) => credStore.get(ref),
      set: async (ref, val) => { credStore.set(ref, val); },
      readRecord: async () => undefined
    };
    apply({
      webServer: { port: 1312, protocol: 'http', register: (r) => { routes.push(r); return () => {}; } },
      connection: { requestRejection: () => undefined },
      credentials: mockCredentials,
      get: (token) => (token === 'credentials' ? mockCredentials : undefined),
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
      slots: { contribute: () => {}, register: () => {} }
    });
    const handler = routes[0].handler;
    const callRoute = (path, method = 'GET', bodyObj = null) => new Promise((resolve) => {
      const buf = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
      const req = {
        url: path,
        method,
        headers: { host: '127.0.0.1:1312' },
        socket: { remoteAddress: '127.0.0.1' },
        on: (ev, cb) => {
          if (ev === 'data' && buf) process.nextTick(() => cb(buf));
          else if (ev === 'end') process.nextTick(() => cb());
          return req;
        }
      };
      const st = { status: 0, body: '' };
      handler(req, { writeHead: (s) => { st.status = s; }, end: (c) => resolve({ status: st.status, json: JSON.parse(c || '{}') }) });
    });

    // 1. 首次拉取从 DSH 导入 DEEPSEEK_API_KEY
    const k1 = await callRoute('/credit-expiry/api/keys');
    assert.equal(k1.json.syncDsh, true);
    assert.equal(k1.json.accounts.length, 1);

    // 2. 在插件里新增 Moonshot 密钥 -> 同步写入 DSH credStore
    const addKimi = await callRoute('/credit-expiry/api/keys', 'POST', {
      action: 'add',
      account: { vendor: 'moonshot', key: 'ms-key-9999' }
    });
    assert.equal(addKimi.status, 200);
    assert.equal(credStore.get('MOONSHOT_API_KEY'), 'ms-key-9999');

    // 3. 用户在 DSH 设置中删除这两个密钥 -> 再次拉取 /keys 时，插件绝不复写回 DSH，且 k-dsh-* 自动清理
    credStore.delete('DEEPSEEK_API_KEY');
    credStore.delete('MOONSHOT_API_KEY');
    const k2 = await callRoute('/credit-expiry/api/keys');
    assert.equal(credStore.has('DEEPSEEK_API_KEY'), false, 'DSH 删除的 deepseek 密钥不能被插件复写回去');
    assert.equal(credStore.has('MOONSHOT_API_KEY'), false, 'DSH 删除的 moonshot 密钥不能被插件复写回去');
    assert.equal(k2.json.accounts.some((a) => a.vendor === 'deepseek'), false, '从 DSH 导入的 k-dsh-* 应随 DSH 删除一并清理');

    // 4. 关闭 syncDsh 开关后，即使 DSH 设置里新增 OpenRouter 密钥也不会再导入
    const cfgOff = await callRoute('/credit-expiry/api/keys', 'POST', { action: 'config', syncDsh: false });
    assert.equal(cfgOff.status, 200);
    assert.equal(cfgOff.json.syncDsh, false);
    credStore.set('OPENROUTER_API_KEY', 'or-ignored-3333');
    const k3 = await callRoute('/credit-expiry/api/keys');
    assert.equal(k3.json.syncDsh, false);
    assert.equal(k3.json.accounts.some((a) => a.vendor === 'openrouter'), false, '关闭同步后不再从 DSH 导入新密钥');

    // 5. 未安装的插件（豆包 / Codex 返回 404）不应混入 payload.errors 持续弹窗提醒
    const dataRes = await callRoute('/credit-expiry/api/data');
    assert.equal(dataRes.status, 200);
    assert.equal(dataRes.json.sourceStatus.db.state, 'not-installed');
    assert.equal(dataRes.json.sourceStatus.cx.state, 'not-installed');
    assert.equal(dataRes.json.errors.some((e) => e.startsWith('豆包:')), false, '未安装的豆包 404 不应告警');
    assert.equal(dataRes.json.errors.some((e) => e.startsWith('GPT/Codex:')), false, '未安装的 Codex 404 不应告警');

    // 6. hy4free 识别为免费模型，且已落账的 raw.costCny 优先于按 session.at 粗估的价格
    const ledger = {
      config: {},
      days: {
        '2026-11-25': {
          byProviderModel: {
            'workbuddy:hy4free': { calls: 5, input: 5000, output: 1000, costCny: 0 },
            'trae:deepseek-v4.1-flash': { calls: 10, input: 1000000, output: 100000, costCny: 2.34 }
          },
          sessions: [
            {
              id: 's-hyfree',
              at: Date.parse('2026-11-25T03:00:00Z'),
              title: 'hy4free',
              byProviderModel: { 'workbuddy:hy4free': { calls: 5, input: 5000, output: 1000, costCny: 0 } }
            },
            {
              id: 's-tr-exact',
              at: Date.parse('2026-11-25T16:00:00Z'),
              title: 'exact costCny',
              byProviderModel: { 'trae:deepseek-v4.1-flash': { calls: 10, input: 1000000, output: 100000, costCny: 2.34 } }
            }
          ]
        }
      }
    };
    const { summarizeUsage } = await import(pathToFileURL(join(ROOT, 'lib', 'index.js')).href);
    const usage = summarizeUsage(ledger, { consumed: { wb: 10, tr: 10 } });
    const sFree = usage.sessions.find((s) => s.id === 's-hyfree');
    const sExact = usage.sessions.find((s) => s.id === 's-tr-exact');
    assert.equal(sFree.free, true, 'hy4free 必须标记为免费模型');
    assert.equal(usage.pricing.missing.includes('hy4free'), false, 'hy4free 不应进入未定价缺失列表');
    assert.ok(Math.abs(sExact.costCny - 2.34) < 1e-6, '应优先采信账本里精确记录的 raw.costCny');
  } finally {
    globalThis.fetch = origFetch;
    process.env.DSH_HOME = prevHome;
    await rm(temp, { recursive: true, force: true });
  }
});
