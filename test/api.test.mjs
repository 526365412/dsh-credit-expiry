/**
 * 宿主路由测试：GET /credit-expiry/api/data、/update。
 *
 * 不启动真实的 DSH Web 服务：构造一个假 ctx（webServer.register 捕获 handler、
 * effect(fn) 立即执行、其余服务空实现），加载 lib/index.js 的 apply 拿到 handler，
 * 再用假 req/res 直接调用。网络一律打桩（globalThis.fetch），保证测试离线可跑、
 * 不会碰到真实上游，也顺便记录每次请求的目标地址，用来断言凭据没有被转发到
 * 请求方伪造的 Host 上。
 *
 * DSH_HOME 指向临时目录，避开本机真实账本（约 1.4 MB）与价格缓存。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PORT = 1309;

/* ---------------- 假 ctx / 假 req / 假 res ---------------- */

/** 模拟 DSH connection.requestRejection(req)：先查 Host/Origin 围栏（403），再查本机/凭据（401）。 */
function defaultRequestRejection(req) {
  const origin = req && req.headers && (req.headers.origin || req.headers['sec-fetch-site']);
  if (origin && origin !== 'same-origin' && origin !== 'none') {
    try {
      const u = new URL(String(origin));
      if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost' && u.hostname !== '[::1]') return 403;
    } catch {
      return 403;
    }
  }
  const addr = req && req.socket && req.socket.remoteAddress;
  if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') return 401;
  return undefined;
}

/** 造一个最小可用的 ctx：提供 webServer、connection 与 effect。 */
function makeCtx(options) {
  const opts = options || {};
  const registered = [];
  const ctx = {
    webServer: {
      port: PORT,
      protocol: 'http',
      // 真实 DSH 返回一个 disposer；这里给一个什么都不做的函数。
      register: (route) => {
        registered.push(route);
        return () => {};
      }
    },
    connection: opts.connection !== undefined ? opts.connection : {
      requestRejection: opts.requestRejection || defaultRequestRejection
    },
    // effect 的契约是「立即执行并返回 disposer」，本测试就按这个契约实现。
    effect: (fn) => {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    slots: {
      // 宿主 slot 服务，本插件不用；空实现即可
      contribute: () => {},
      register: () => {}
    }
  };
  return { ctx, registered };
}

/** 假 IncomingMessage。remoteAddress 为 null 时模拟没有 socket 的极端情况。 */
function makeReq(pathname, options) {
  const opts = options || {};
  const headers = opts.headers || {};
  return {
    url: pathname,
    method: 'GET',
    headers: Object.assign({ host: 'dsh.local' }, headers),
    socket: opts.remoteAddress === null ? {} : { remoteAddress: opts.remoteAddress || '127.0.0.1' }
  };
}

/** 假 ServerResponse：记录状态码与响应体。 */
function makeRes() {
  const state = { status: 0, headers: null, body: '' };
  return {
    state: state,
    writeHead: (status, headers) => {
      state.status = status;
      state.headers = headers || {};
      return state;
    },
    end: (chunk) => {
      if (typeof chunk === 'string') state.body += chunk;
    },
    json: () => JSON.parse(state.body || 'null')
  };
}

/** lib/index.js 的绝对 file URL（不依赖进程 cwd）。 */
function moduleUrl() {
  return pathToFileURL(join(ROOT, 'lib', 'index.js')).href;
}

/** 加载 lib/index.js 的 apply，返回它注册的 handler。 */
async function loadHandler() {
  const mod = await import(moduleUrl());
  assert.equal(typeof mod.apply, 'function', 'lib/index.js 必须导出 apply(ctx)');
  const { ctx, registered } = makeCtx();
  mod.apply(ctx);
  assert.equal(registered.length, 1, 'apply 应只注册一个前缀路由');
  assert.equal(registered[0].kind, 'prefix');
  assert.equal(registered[0].path, '/credit-expiry/api');
  assert.equal(typeof registered[0].handler, 'function');
  return registered[0].handler;
}

/* ---------------- fetch 打桩 ---------------- */

/** 记录每次 fetch 的目标与请求头，并统一返回失败响应。 */
function stubFetch() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), headers: (init && init.headers) || {} });
    return {
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => ''
    };
  };
  return {
    calls: calls,
    restore: () => { globalThis.fetch = original; }
  };
}

/* ---------------- 测试 ---------------- */

let handler;
let tempHome;

test.before(async () => {
  tempHome = await mkdtemp(join(tmpdir(), 'credit-expiry-test-'));
  // 必须在 import lib/index.js 之前设置，homeDir() 是每次调用才读的，但早点设更稳。
  process.env.DSH_HOME = tempHome;
  handler = await loadHandler();
});

test.after(async () => {
  if (tempHome) await rm(tempHome, { recursive: true, force: true });
});

test('非回环来源且无 cookie：/data 返回 401', async () => {
  const res = makeRes();
  await handler(makeReq('/credit-expiry/api/data', {
    remoteAddress: '10.1.2.3',
    headers: { host: 'evil.example' }
  }), res);
  assert.equal(res.state.status, 401);
  assert.deepEqual(res.json(), { status: 'error', error: 'unauthorized' });
});

test('非回环来源且无 cookie：/update 返回 401', async () => {
  const res = makeRes();
  await handler(makeReq('/credit-expiry/api/update?force=1', {
    remoteAddress: '192.168.1.20',
    headers: { host: 'evil.example' }
  }), res);
  assert.equal(res.state.status, 401);
  assert.deepEqual(res.json(), { status: 'error', error: 'unauthorized' });
});

test('未知子路由返回 404', async () => {
  for (const pathname of ['/credit-expiry/api/unknown', '/credit-expiry/api', '/credit-expiry/api/data/x']) {
    const res = makeRes();
    await handler(makeReq(pathname, { remoteAddress: '127.0.0.1' }), res);
    assert.equal(res.state.status, 404, pathname + ' 应返回 404');
    assert.deepEqual(res.json(), { status: 'error', error: 'not found' });
  }
});

test('前缀外的路径也返回 404', async () => {
  const res = makeRes();
  await handler(makeReq('/other/api/data', { remoteAddress: '127.0.0.1' }), res);
  assert.equal(res.state.status, 404);
});

test('回环来源：/data 放行并返回 200 JSON', async () => {
  const stub = stubFetch();
  try {
    const res = makeRes();
    await handler(makeReq('/credit-expiry/api/data', {
      remoteAddress: '127.0.0.1',
      headers: { host: '127.0.0.1:' + PORT }
    }), res);
    assert.equal(res.state.status, 200);
    assert.equal(res.state.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.state.headers['cache-control'], 'no-store');
    const payload = res.json();
    assert.equal(typeof payload.updatedAt, 'number');
    assert.ok(Array.isArray(payload.errors));
    // 上游拿不到（打桩返回 503），但形状必须是完整的
    assert.equal(payload.wb, null);
    assert.equal(payload.tr, null);
    assert.equal(payload.mm, null);
    assert.equal(payload.qd, null);
    assert.ok(payload.errors.some((e) => e.startsWith('WorkBuddy: ')));
  } finally {
    stub.restore();
  }
});

test('鉴权加固：非本机带任意 cookie 也被拒；本机伪造 Host 时 origin 仍指向回环', async () => {
  const stub = stubFetch();
  try {
    // 评审 P0-1：非本机请求即使带任意 cookie 也不再放行（原漏洞已修）。
    const bad = makeRes();
    await handler(makeReq('/credit-expiry/api/data', {
      remoteAddress: '10.1.2.3',
      headers: { host: 'evil.example', cookie: 'dsh_session=secret-cookie' }
    }), bad);
    assert.equal(bad.state.status, 401, '非本机请求不得凭任意 cookie 放行');
    assert.equal(stub.calls.length, 0, '被拒的请求不应触发任何上游读取');

    // 本机请求：Host 头攻击者可控，origin 绝不能跟着它走。
    const res = makeRes();
    await handler(makeReq('/credit-expiry/api/data', {
      remoteAddress: '127.0.0.1',
      headers: {
        host: 'evil.example',
        cookie: 'dsh_session=secret-cookie',
        'x-forwarded-host': 'evil.example'
      }
    }), res);
    assert.equal(res.state.status, 200);
    assert.ok(stub.calls.length > 0, '应当尝试读取上游，否则这条断言没有意义');

    for (const call of stub.calls) {
      assert.equal(
        call.url.startsWith('http://127.0.0.1:' + PORT + '/'),
        true,
        '请求必须打到本机回环端口，实际是: ' + call.url
      );
      assert.equal(call.url.includes('evil.example'), false, '不能把请求发往伪造的 Host');
      assert.equal(call.url.startsWith('http://'), true, 'protocol 为 http 时不该出现 https');
    }

    // 本机调用才转发 cookie，且只转发到回环地址。
    const forwarded = stub.calls.filter((c) => c.headers && c.headers.cookie);
    assert.ok(forwarded.length > 0, '本机请求应把 cookie 转发给本机上游');
    for (const call of forwarded) {
      assert.equal(call.headers.cookie, 'dsh_session=secret-cookie');
      assert.equal(call.url.startsWith('http://127.0.0.1:' + PORT + '/'), true);
    }
  } finally {
    stub.restore();
  }
});

test('origin 跟随 ctx.webServer.protocol：https 时拼 https://127.0.0.1', async () => {
  const url = moduleUrl();
  const mod = await import(url);
  const registered = [];
  mod.apply({
    webServer: {
      port: 4567,
      protocol: 'https',
      register: (route) => { registered.push(route); return () => {}; }
    },
    connection: { requestRejection: () => undefined },
    effect: (fn) => { fn(); },
    slots: { contribute: () => {}, register: () => {} }
  });
  const stub = stubFetch();
  try {
    const res = makeRes();
    await registered[0].handler(makeReq('/credit-expiry/api/data', { remoteAddress: '::1' }), res);
    assert.equal(res.state.status, 200);
    assert.ok(stub.calls.length > 0);
    for (const call of stub.calls) {
      assert.equal(call.url.startsWith('https://127.0.0.1:4567/'), true, '实际是: ' + call.url);
    }
  } finally {
    stub.restore();
  }
});

test('webServer.port 缺失时 /data 不崩溃：200 且把原因写进 errors', async () => {
  const url = moduleUrl();
  const mod = await import(url);
  const registered = [];
  mod.apply({
    webServer: { register: (route) => { registered.push(route); return () => {}; } },
    connection: { requestRejection: () => undefined },
    effect: (fn) => { fn(); },
    slots: { contribute: () => {}, register: () => {} }
  });
  const res = makeRes();
  await registered[0].handler(makeReq('/credit-expiry/api/data', { remoteAddress: '127.0.0.1' }), res);
  // origin() 由每个 readUsage 调用，抛出的错误被 Promise.allSettled 收走，
  // 因此整体仍是 200，失败原因逐条进 errors——面板照常渲染，不会白屏。
  assert.equal(res.state.status, 200);
  const payload = res.json();
  assert.ok(Array.isArray(payload.errors));
  assert.ok(
    payload.errors.some((e) => e.includes('无法确定 DSH Web 端口')),
    '应把端口缺失的原因写进 errors，实际: ' + JSON.stringify(payload.errors)
  );
  assert.equal(payload.wb, null);
});

test('回环来源：/update 返回 200，离线时带 error 而不是抛错', async () => {
  const stub = stubFetch();
  try {
    const res = makeRes();
    await handler(makeReq('/credit-expiry/api/update', { remoteAddress: '127.0.0.1' }), res);
    assert.equal(res.state.status, 200);
    const payload = res.json();
    assert.equal(typeof payload.current, 'string');
    assert.equal(payload.hasUpdate, false);
    // 四个镜像全部打桩失败：应退化成「无法访问索引源」而不是 5xx
    assert.equal(payload.latest, null);
    assert.equal(typeof payload.error, 'string');
    for (const call of stub.calls) {
      assert.equal(call.url.startsWith('http'), true, '更新检查走的是公网镜像，不是回环');
      assert.equal(call.url.includes('evil.example'), false);
    }
  } finally {
    stub.restore();
  }
});

/* ================================================================== *
 * 追加回归测试：/keys、/notify、/export、/update，以及鉴权边界组合。
 * 这几条路径此前零覆盖；宿主侧逻辑刚修好，这里把行为锁住。
 * 需要干净模块状态（lastBundle / versionMemo）的用例用带 query 的
 * import 拿到全新实例，避免被本文件前面的测试污染。
 * ================================================================== */

/** 带 JSON body 的假 POST：readBody 依赖 req.on('data'/'end')。 */
function makeBodyReq(pathname, body, options) {
  const req = makeReq(pathname, options);
  req.method = 'POST';
  const payload = Buffer.from(JSON.stringify(body));
  req.on = (event, cb) => {
    if (event === 'data') process.nextTick(() => cb(payload));
    else if (event === 'end') process.nextTick(() => cb());
    return req;
  };
  return req;
}

/** 加载全新 lib/index.js 实例（query 让 ESM 缓存失效），返回干净 handler。 */
let freshSeq = 0;
async function freshHandler(options) {
  const mod = await import(moduleUrl() + '?case=' + (++freshSeq));
  const built = makeCtx(options);
  mod.apply(built.ctx);
  return built.registered[0].handler;
}

/** 可指定响应的假 fetch；calls 记录每次请求的完整 URL。 */
function installFetch(resolver) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return resolver(String(url), init || {});
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
function okJson(obj) {
  return { ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) };
}

/* ---------------- /keys ---------------- */

test('/keys GET：非本机无凭据 → 401', async () => {
  const res = makeRes();
  await handler(makeReq('/credit-expiry/api/keys', {
    remoteAddress: '10.1.2.3', headers: { host: 'evil.example' }
  }), res);
  assert.equal(res.state.status, 401);
  assert.deepEqual(res.json(), { status: 'error', error: 'unauthorized' });
});

test('/keys GET：本机放行，返回 accounts 与 vendors', async () => {
  const res = makeRes();
  await handler(makeReq('/credit-expiry/api/keys', { remoteAddress: '127.0.0.1' }), res);
  assert.equal(res.state.status, 200);
  const payload = res.json();
  assert.equal(payload.status, 'ok');
  assert.ok(Array.isArray(payload.accounts));
  assert.ok(Array.isArray(payload.vendors));
});

test('/keys POST：带跨站 Origin → 403', async () => {
  const res = makeRes();
  await handler(makeBodyReq('/credit-expiry/api/keys',
    { action: 'remove', id: 'x' },
    { remoteAddress: '127.0.0.1', headers: { origin: 'https://evil.example' } }), res);
  assert.equal(res.state.status, 403);
  assert.deepEqual(res.json(), { status: 'error', error: 'forbidden' });
});

test('/keys POST：无 Origin → 允许（200）', async () => {
  const res = makeRes();
  await handler(makeBodyReq('/credit-expiry/api/keys',
    { action: 'remove', id: 'does-not-exist' },
    { remoteAddress: '127.0.0.1' }), res);
  assert.equal(res.state.status, 200);
  assert.equal(res.json().status, 'ok');
});

/* ---------------- /notify ---------------- */

test('/notify：非本机无凭据 → 401', async () => {
  const res = makeRes();
  await handler(makeBodyReq('/credit-expiry/api/notify',
    { action: 'config', url: '' },
    { remoteAddress: '10.1.2.3', headers: { host: 'evil.example' } }), res);
  assert.equal(res.state.status, 401);
  assert.deepEqual(res.json(), { status: 'error', error: 'unauthorized' });
});

test('/notify POST：带跨站 Origin → 403', async () => {
  const res = makeRes();
  await handler(makeBodyReq('/credit-expiry/api/notify',
    { action: 'config', url: '' },
    { remoteAddress: '127.0.0.1', headers: { origin: 'https://evil.example' } }), res);
  assert.equal(res.state.status, 403);
  assert.deepEqual(res.json(), { status: 'error', error: 'forbidden' });
});

test('/notify POST：无 Origin → 允许（config 清空返回 200）', async () => {
  const res = makeRes();
  await handler(makeBodyReq('/credit-expiry/api/notify',
    { action: 'config', url: '' },
    { remoteAddress: '127.0.0.1' }), res);
  assert.equal(res.state.status, 200);
  assert.deepEqual(res.json(), { status: 'ok', notify: { kind: null, hasUrl: false } });
});

/* ---------------- /export ---------------- */

test('/export：无 lastBundle 时自调用 /data 生成导出，不是 503', async () => {
  const fresh = await freshHandler();
  const bundle = {
    updatedAt: 1730000000000,
    errors: [],
    wb: { total: 100 }, tr: { total: 200 }, mm: { total: 300 }, qd: { total: 400 },
    usage: { providers: [] }
  };
  const stub = installFetch((url) =>
    url.endsWith('/credit-expiry/api/data') ? okJson(bundle) : okJson({}));
  try {
    const res = makeRes();
    await fresh(makeReq('/credit-expiry/api/export?format=json', { remoteAddress: '127.0.0.1' }), res);
    assert.equal(res.state.status, 200, '首次导出应自调用 /data，而不是返回 503');
    const payload = res.json();
    for (const key of ['updatedAt', 'errors', 'wb', 'tr', 'mm', 'qd', 'usage']) {
      assert.ok(key in payload, '导出应包含字段 ' + key);
    }
    assert.equal(payload.wb.total, 100);
    assert.ok(
      stub.calls.some((c) => c.url.endsWith('/credit-expiry/api/data')),
      '应自调用 /data，实际请求: ' + JSON.stringify(stub.calls.map((c) => c.url))
    );
  } finally {
    stub.restore();
  }
});

/* ---------------- /update ---------------- */

test('/update：镜像回退到更旧版本时不把 latest 改小', async () => {
  const fresh = await freshHandler();
  const index = (ver) => ({
    plugins: [{ name: 'dsh-credit-expiry', versions: [{
      version: ver, publishTimestamp: 1730000000, source: { commit: 'abcdef1234567890' }
    }] }]
  });
  let phase = 'high';
  const stub = installFetch(() => okJson(index(phase === 'high' ? '99.0.0' : '0.0.1')));
  try {
    const r1 = makeRes();
    await fresh(makeReq('/credit-expiry/api/update?force=1', { remoteAddress: '127.0.0.1' }), r1);
    assert.equal(r1.state.status, 200);
    assert.equal(r1.json().latest, '99.0.0');

    phase = 'old';
    const r2 = makeRes();
    await fresh(makeReq('/credit-expiry/api/update?force=1', { remoteAddress: '127.0.0.1' }), r2);
    assert.equal(r2.state.status, 200);
    assert.equal(r2.json().latest, '99.0.0', '更旧的镜像不得把 latest 改小');
    assert.equal(r2.json().hasUpdate, true);
  } finally {
    stub.restore();
  }
});

test('/update?force=1：自带 ? 的镜像 URL 用 &t= 追加 cache buster', async () => {
  const fresh = await freshHandler();
  const stub = installFetch(() => okJson({
    plugins: [{ name: 'dsh-credit-expiry', versions: [{ version: '0.7.0' }] }]
  }));
  try {
    const res = makeRes();
    await fresh(makeReq('/credit-expiry/api/update?force=1', { remoteAddress: '127.0.0.1' }), res);
    assert.equal(res.state.status, 200);
    const apiCall = stub.calls.find((c) => c.url.includes('api.github.com'));
    assert.ok(apiCall, '应请求 api.github.com 镜像');
    assert.ok(apiCall.url.includes('?ref=main&t='),
      '自带 ?ref=main 的 URL 必须用 &t= 追加，实际: ' + apiCall.url);
    assert.ok(!apiCall.url.includes('?ref=main?t='), '不能用 ? 重复拼接');
    const rawCall = stub.calls.find((c) => c.url.includes('raw.githubusercontent.com'));
    assert.ok(rawCall && rawCall.url.includes('/index.json?t='),
      '无 ? 的 raw 镜像用 ?t=，实际: ' + (rawCall && rawCall.url));
  } finally {
    stub.restore();
  }
});

/* ---------------- ctx.connection.requestRejection 访问检查 ---------------- */

test('inject 声明包含 connection，且 handler 最开头调用 ctx.connection.requestRejection(req)', async () => {
  const mod = await import(moduleUrl() + '?case=' + (++freshSeq));
  assert.ok(Array.isArray(mod.inject), 'inject 必须是数组');
  assert.ok(mod.inject.includes('connection'), 'inject 必须包含 connection');
  assert.ok(mod.inject.includes('webServer'), 'inject 必须包含 webServer');
  assert.ok(mod.inject.includes('credentials'), 'inject 必须包含 credentials');

  const seen = [];
  const conn = {
    marker: 'bound',
    requestRejection(req) {
      assert.equal(this.marker, 'bound', '应保留 connection 成员调用的 this 绑定');
      seen.push(req.url);
      return 403;
    }
  };
  const h = await freshHandler({ connection: conn });
  const stub = stubFetch();
  try {
    for (const path of ['/credit-expiry/api/data', '/credit-expiry/api/update', '/credit-expiry/api/export', '/credit-expiry/api/keys', '/credit-expiry/api/notify', '/credit-expiry/api/unknown']) {
      const res = makeRes();
      await h(makeReq(path, { remoteAddress: '127.0.0.1' }), res);
      assert.equal(res.state.status, 403, path + ' 被 requestRejection 拒绝时应立即返回 403');
      assert.deepEqual(res.json(), { status: 'error', error: 'forbidden' });
    }
    assert.equal(seen.length, 6, '每个请求都应先经过 requestRejection');
    assert.equal(stub.calls.length, 0, '被拒绝后不得发起上游请求');
  } finally {
    stub.restore();
  }
});

test('requestRejection 返回 401 时所有路由返回 401；缺失 connection 时 fail-closed 返回 403', async () => {
  const h401 = await freshHandler({ connection: { requestRejection: () => 401 } });
  for (const route of ['/data', '/keys', '/notify', '/export', '/update']) {
    const res = makeRes();
    await h401(makeReq('/credit-expiry/api' + route, {
      remoteAddress: '127.0.0.1',
      headers: { host: '127.0.0.1:' + PORT, cookie: 'dsh_session=bad' }
    }), res);
    assert.equal(res.state.status, 401, route + ' 未通过会话校验应返回 401');
    assert.deepEqual(res.json(), { status: 'error', error: 'unauthorized' });
  }

  const hNoConn = await freshHandler({ connection: null });
  const res = makeRes();
  await hNoConn(makeReq('/credit-expiry/api/data', { remoteAddress: '127.0.0.1' }), res);
  assert.equal(res.state.status, 403, '缺少 ctx.connection 时应 fail-closed 返回 403');
});

test('requestRejection 放行时（含远端受信任访问）不再额外按 remoteAddress 拒收', async () => {
  const hAllow = await freshHandler({ connection: { requestRejection: () => undefined } });
  const res = makeRes();
  await hAllow(makeReq('/credit-expiry/api/keys', {
    remoteAddress: '10.1.2.3',
    headers: { origin: 'https://trusted.dsh.example' }
  }), res);
  assert.equal(res.state.status, 200);
});

/* ---------------- 豆包额度（独立数据块，不进计价分摊） ---------------- */

test('/data：豆包额度按窗口归一化返回，不污染积分池', async () => {
  const fresh = await freshHandler();
  const now = Date.now();
  const quota = {
    ok: true, plan: '免费体验', profile: 'tester', exhausted: false,
    windows: {
      fiveHour: null, weekly: null,
      incentive: [{
        usedPercent: 0.5, remainingPercent: 99.5,
        resetsAt: now + 86400000, resetsInMs: 86400000,
        label: '活动赠送额度', startsOnUse: true,
        usedAmount: 1, totalAmount: 200
      }]
    },
    fetchedAt: now, error: null
  };
  const stub = installFetch((url) =>
    url.includes('/plugins/dsh-connect-doubao/quota')
      ? okJson(quota)
      : okJson({}));
  try {
    const res = makeRes();
    await fresh(makeReq('/credit-expiry/api/data', { remoteAddress: '127.0.0.1' }), res);
    assert.equal(res.state.status, 200);
    const payload = res.json();
    assert.ok(payload.db, '应返回 db 数据块');
    assert.equal(payload.db.status, 'ok');
    assert.equal(payload.db.plan, '免费体验');
    assert.equal(payload.db.exhausted, false);
    assert.ok(Array.isArray(payload.db.windows));
    assert.equal(payload.db.windows.length, 1);
    const w = payload.db.windows[0];
    assert.equal(w.kind, 'incentive');
    assert.equal(w.label, '活动赠送额度');
    assert.equal(w.size, 200);
    assert.equal(w.used, 1);
    assert.equal(w.remain, 199);
    assert.equal(w.startsOnUse, true);
    assert.equal(w.resetsAtMs, now + 86400000);
    // 活动赠送是一次性礼包，不能被当成周期额度。
    assert.equal(payload.db.subscription, null);
    // 豆包不进计价分摊：errors 里不应出现「豆包:」的读取失败。
    assert.ok(!payload.errors.some((e) => e.startsWith('豆包: ')),
      '豆包读取成功时不应报读取失败，实际: ' + JSON.stringify(payload.errors));
  } finally {
    stub.restore();
  }
});

test('/data：豆包有固定窗口时形成 quota 周期额度，重置日取最早', async () => {
  const fresh = await freshHandler();
  const now = Date.now();
  const quota = {
    ok: true, plan: '会员', exhausted: false,
    windows: {
      fiveHour: { label: '5 小时额度', startsOnUse: false, usedAmount: 20, totalAmount: 100, usedPercent: 20, remainingPercent: 80, resetsAt: now + 3600000 },
      weekly: { label: '每周额度', startsOnUse: false, usedAmount: 100, totalAmount: 500, usedPercent: 20, remainingPercent: 80, resetsAt: now + 7200000 },
      incentive: []
    },
    fetchedAt: now, error: null
  };
  const stub = installFetch((url) =>
    url.includes('/plugins/dsh-connect-doubao/quota')
      ? okJson(quota)
      : okJson({}));
  try {
    const res = makeRes();
    await fresh(makeReq('/credit-expiry/api/data', { remoteAddress: '127.0.0.1' }), res);
    const payload = res.json();
    assert.ok(payload.db.subscription, '两个固定窗口应形成周期额度');
    const sub = payload.db.subscription;
    assert.equal(sub.cycle, 'quota');
    assert.equal(sub.label, '会员');
    assert.equal(sub.size, 600);
    assert.equal(sub.remain, 480);
    assert.equal(sub.resetAtMs, now + 3600000, '重置日应取最早的 5 小时窗口');
    assert.equal(payload.db.windows.length, 2);
  } finally {
    stub.restore();
  }
});

test('/data：豆包套餐积分（package）按订阅窗口归一化，计入周期额度', async () => {
  const fresh = await freshHandler();
  const now = Date.now();
  const quota = {
    ok: true, plan: '标准套餐', profile: 'tester', exhausted: false,
    windows: {
      package: { usedPercent: 86, remainingPercent: 14, resetsAt: now + 573908995, resetsInMs: 573908995, label: null, startsOnUse: true, usedAmount: 1807, totalAmount: 2100 },
      fiveHour: null, weekly: null,
      incentive: [{ usedPercent: 100, remainingPercent: 0, resetsAt: now + 2541691437, resetsInMs: 2541691437, label: '活动赠送额度', startsOnUse: true, usedAmount: 5550, totalAmount: 5550 }]
    },
    fetchedAt: now, error: null
  };
  const stub = installFetch((url) =>
    url.includes('/plugins/dsh-connect-doubao/quota')
      ? okJson(quota)
      : okJson({}));
  try {
    const res = makeRes();
    await fresh(makeReq('/credit-expiry/api/data', { remoteAddress: '127.0.0.1' }), res);
    const payload = res.json();
    assert.equal(payload.db.windows.length, 2);
    const pkg = payload.db.windows.find((w) => w.kind === 'package');
    assert.ok(pkg, '套餐积分窗口不能被丢掉——那是用户的订阅余额');
    assert.equal(pkg.label, '套餐积分');
    assert.equal(pkg.size, 2100);
    assert.equal(pkg.used, 1807);
    assert.equal(pkg.remain, 293);
    assert.equal(pkg.startsOnUse, true);
    assert.ok(payload.db.subscription, '套餐积分是订阅额度，应形成周期额度');
    assert.equal(payload.db.subscription.size, 2100);
    assert.equal(payload.db.subscription.remain, 293);
    assert.equal(payload.db.subscription.resetAtMs, now + 573908995);
    const bonus = payload.db.windows.find((w) => w.kind === 'incentive');
    assert.equal(bonus.remain, 0, '赠送已用完应显示 0');
  } finally {
    stub.restore();
  }
});


