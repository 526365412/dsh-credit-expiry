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

test('客户端：对话框上方的积分长条已移除，不再注册到 conversation.input.dock', () => {
  assert.doesNotMatch(CLIENT, /name: 'conversation.input.dock'/, '不应再注册输入框旁 slot');
  assert.doesNotMatch(CLIENT, /PREFS\.dock !== false/, '不应再保留 dock 偏好开关');
});

test('客户端：GPT/Codex 与魔搭各有展示区块，且默认开启', () => {
  const sm = bodyOf(CLIENT, 'makeSectionMeta');
  assert.match(sm, /id: 'codex'/, '缺少 Codex 区块');
  assert.match(sm, /id: 'modelscope'/, '缺少魔搭区块');
  assert.match(CLIENT, /doubao: true, codex: true, modelscope: true/, '新区块默认开启');
  const sub = bodyOf(CLIENT, 'SubscriptionOverview');
  assert.match(sub, /CodexQuota\(\{/, '订阅与额度页签渲染 Codex 额度构成卡');
  assert.match(sub, /ModelScopeQuota\(\{/, '订阅与额度页签渲染魔搭卡片');
  assert.doesNotMatch(bodyOf(CLIENT, 'PanelView'), /CodexQuota/, '总览不复制额度明细');
});

test('客户端：折线渐变、区块淡背景、额度图标与合并区块都在场', () => {
  const sec = bodyOf(CLIENT, 'Section');
  assert.match(sec, /SECTION_PLATFORM/, '区块按平台取淡背景');
  assert.match(sec, /PlatformIcon\(\{ id: pid/, '额度区块标题带平台图标');
  assert.match(CLIENT, /usage-area-grad/, '折线面积用平台色渐变');
  assert.match(CLIENT, /ICON_CX/, 'Codex 有图标');
  assert.match(CLIENT, /ICON_MS/, '魔搭有图标');
  assert.match(CLIENT, /t\('额度与订阅'\)/, '总览额度改成一张速览卡');
  assert.match(CLIENT, /quotaGlanceRows\(subscriptionRows\(data\)\)/, '总览与订阅页签共用同一份额度模型');
});

test('客户端：平台开关偏好存在，侧栏按开关过滤', () => {
  assert.match(CLIENT, /platforms: \{ wb: true, tr: true, mm: true, qd: true, db: true \}/, '默认五个平台都显示');
  const mini = bodyOf(CLIENT, 'MiniEntry');
  assert.match(mini, /prefs\.platforms\[id\] !== false/, '侧栏要按平台开关过滤');
});

test('客户端：动态临期提示、订阅页签、套餐积分计入余额、七平台订阅卡都在场', () => {
  assert.match(CLIENT, /ACTIVE\.l30 \+ t\(' 天内没有到期积分'\)/, '临期提示用 ACTIVE.l30 动态天数');
  const sub2 = bodyOf(CLIENT, 'SubscriptionOverview');
  assert.match(sub2, /border: '1px solid ' \+ C\.line, borderRadius: R\.lg, padding: '11px 12px', background: C\.bg/, '额度构成卡统一线框');
  const collect = bodyOf(CLIENT, 'collect');
  assert.match(collect, /w\.kind === 'incentive' \|\| w\.kind === 'package'/, '套餐积分也计入余额');
  assert.match(HOST, /hasPlan:/, 'Trae 有 hasPlan 标志');
  assert.match(HOST, /expiresAtMs: finiteOrNull\(usage\.plan\.expiresAtMs\)/, 'MiniMax 有 plan 到期字段');
  const rowFn = bodyOf(CLIENT, 'subscriptionRows');
  assert.match(rowFn, /\.sort\(/, '紧急的排前面');
  const sub = bodyOf(CLIENT, 'SubscriptionOverview');
  ['快到期', '需刷新', '未订阅', '没有读取到订阅信息'].forEach(function (k) {
    assert.ok(sub.indexOf("t('" + k + "')") >= 0, '订阅卡有标记 ' + k);
  });
  assert.match(CLIENT, /id: 'subscriptions'/, '面板有订阅页签');
  assert.match(CLIENT, /h\(SubscriptionOverview, \{ data: data \}\)/, '订阅页签渲染组件');
  const sb = bodyOf(CLIENT, 'Subscription');
  assert.match(sb, /props\.platformId \|\| null/, 'Subscription 支持按平台过滤');
  assert.ok(rowFn.indexOf("mk('wb'") >= 0, 'WorkBuddy 额度单独一行');
  assert.ok(rowFn.indexOf("mk('qd'") >= 0, 'Qoder 额度单独一行，不与 WorkBuddy 合并');
  assert.match(sb, /levelColor\(levelOf\(sub\.expiresAtMs\)\)/, '订阅到期按等级上色');
  const so = bodyOf(CLIENT, 'SubscriptionOverview');
  assert.match(so, /deadlineColor/, '订阅页签到日期按等级上色');
  assert.match(CLIENT, /mini: \{[\s\S]{0,160}?total: true,[\s\S]{0,160}?modelscope: true/, '魔搭侧栏开关默认开启');
  assert.match(CLIENT, /layout: 'focus'/, '侧栏默认焦点版式');
  assert.match(bodyOf(CLIENT, 'MiniEntry'), /prefs\.mini\.modelscope === false/, '侧栏魔搭余额受开关控制');
});
