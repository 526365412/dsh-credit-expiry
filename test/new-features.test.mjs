/**
 * 0.10.0 新功能守卫：GPT/Codex 额度、魔搭魔粒、统计图表、输入框小条、平台开关。
 * 客户端是注入脚本没有 export，沿用 balance-order.test.mjs 的源码文本断言法。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CLIENT = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const HOST = readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8');

function bodyOf(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, '找不到函数 ' + name);
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  assert.fail('花括号没配对: ' + name);
}

test('宿主：Codex 走 POST RPC 桥，resetsAt 秒转毫秒，balance 字符串转数字', () => {
  assert.match(HOST, /export const inject = \['webServer', 'credentials'\]/, 'inject 必须带 credentials');
  const rpc = bodyOf(HOST, 'readCodexRpc');
  assert.match(rpc, /method: 'POST'/, 'Codex 额度走 POST RPC');
  assert.match(rpc, /type: 'client-request'/, '用 client-request 信封');
  const norm = bodyOf(HOST, 'normalizeCodex');
  assert.match(norm, /w\.resetsAt \* 1000/, 'resetsAt 是秒，必须乘 1000');
  assert.match(norm, /Number\(bal\)/, 'credits.balance 是字符串，必须转数字');
});

test('宿主：魔搭从凭据读 MODELSCOPE_API_KEY，GET magicubes/balance 取 available_balance', () => {
  const ms = bodyOf(HOST, 'readModelScope');
  assert.match(ms, /resolve\('MODELSCOPE_API_KEY'\)/, '从 DSH 凭据库读 key');
  assert.match(ms, /magicubes\/balance/, '打魔搭余额接口');
  assert.match(ms, /available_balance/, '取 available_balance 字段');
  assert.match(ms, /Bearer ' \+ apiKey/, '用 Bearer 头');
  assert.doesNotMatch(ms, /writeFile/, '实时余额不落盘');
});

test('客户端：统计组件支持柱状/折线/饼图与积分/token/调用次数切换', () => {
  const sv = bodyOf(CLIENT, 'StatsView');
  assert.match(sv, /label: t\('柱状图'\)/);
  assert.match(sv, /label: t\('折线图'\)/);
  assert.match(sv, /label: t\('饼图'\)/);
  assert.match(sv, /label: t\('积分'\)/, '积分指标');
  assert.match(sv, /value: 'tokens'/, 'token 指标');
  assert.match(sv, /label: t\('调用次数'\)/, '调用次数指标');
  assert.match(sv, /近 7 天/, '按天查看');
  assert.match(sv, /byPool/, '按平台分类');
  assert.match(sv, /React\.useState/, '图表控件自带 hook');
});

test('客户端：StatsView 作为元素渲染，不选页签也不会白屏', () => {
  const code = CLIENT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.equal([...code.matchAll(/(?<![\w.])StatsView\(\{/g)].length, 0,
    'StatsView 不能当普通函数调用（含 hooks，会白屏）');
  assert.match(CLIENT, /h\(StatsView,/, 'StatsView 必须作为元素渲染');
});

test('客户端：输入框小条注册到 conversation.input.dock，且可被设置关闭', () => {
  assert.match(CLIENT, /name: 'conversation.input.dock'/, '注册输入框旁 slot');
  assert.match(CLIENT, /PREFS\.dock !== false/, '小条能被偏好开关控制');
  const dock = bodyOf(CLIENT, 'InputDock');
  assert.match(dock, /selectPanel\(PANEL_ID\)/, '点小条能打开面板');
});

test('客户端：GPT/Codex 与魔搭各有展示区块，且默认开启', () => {
  const sm = bodyOf(CLIENT, 'makeSectionMeta');
  assert.match(sm, /id: 'codex'/, '缺少 Codex 区块');
  assert.match(sm, /id: 'modelscope'/, '缺少魔搭区块');
  assert.match(CLIENT, /doubao: true, codex: true, modelscope: true/, '新区块默认开启');
  const pv = bodyOf(CLIENT, 'PanelView');
  assert.match(pv, /CodexQuota\(\{/, '面板渲染 Codex 卡片');
  assert.match(pv, /ModelScopeQuota\(\{/, '面板渲染魔搭卡片');
});

test('客户端：平台开关偏好存在，侧栏按开关过滤', () => {
  assert.match(CLIENT, /platforms: \{ wb: true, tr: true, mm: true, qd: true, db: true \}/, '默认五个平台都显示');
  const mini = bodyOf(CLIENT, 'MiniEntry');
  assert.match(mini, /prefs\.platforms\[id\] !== false/, '侧栏要按平台开关过滤');
});
