/**
 * 豆包口径守卫：赠送额度与订阅额度走两条完全不同的路，改错一边就会污染另一边。
 *
 * 规则（与作者确认）：
 *   - 豆包赠送（incentive）约一个月作废 → 是会过期的余额，走 BALANCE_ORDER，
 *     进剩余合计、积分账本、到期日历、侧栏平台行与临期提醒。
 *   - 豆包订阅（fiveHour / weekly）到点补满 → 不是会过期的余额，不进上面这些。
 *   - 算钱相关的口径（消耗速度、到期预测、金额折算、近 14 天堆叠、缺失提示、
 *     周期额度判定）继续只认 PLATFORM_ORDER 四个计价池：cost-meter 里没有豆包，
 *     把豆包塞进去只会算出不存在的钱。
 *
 * 权宜做法同 money.test.mjs：client.js 是注入浏览器的脚本、没有 export，这里读
 * 源码文本，用括号配对（跳过字符串与注释）截出函数体做断言。函数改名或口径被改
 * 错时测试直接失败，不会静默通过。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, '..', 'lib', 'client.js'), 'utf8');

/** 跳过一个字符串字面量，返回收尾引号的下标。 */
function skipString(text, start) {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === quote) return i;
    i += 1;
  }
  return text.length;
}

/** 从 openIndex 的花括号开始配对，返回配对的右花括号下标。 */
function matchBrace(text, openIndex) {
  var depth = 0;
  var i = openIndex;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(text, i) + 1; continue; }
    if (c === '/' && text[i + 1] === '/') { const n = text.indexOf('\n', i); i = n < 0 ? text.length : n + 1; continue; }
    if (c === '/' && text[i + 1] === '*') { const n = text.indexOf('*/', i); i = n < 0 ? text.length : n + 2; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return i; }
    i += 1;
  }
  return -1;
}

/** 按函数名截出完整函数体文本（含首尾花括号）。 */
function bodyOf(name) {
  const at = SRC.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'client.js 里找不到函数 ' + name);
  const open = SRC.indexOf('{', at);
  const close = matchBrace(SRC, open);
  assert.ok(close > open, '函数 ' + name + ' 的花括号没配对');
  return SRC.slice(open, close + 1);
}

test('两个口径分工：BALANCE_ORDER 带豆包，PLATFORM_ORDER 不带', () => {
  assert.match(SRC, /var PLATFORM_ORDER = \['wb', 'tr', 'mm', 'qd'\];/);
  assert.match(SRC, /var BALANCE_ORDER = \['wb', 'tr', 'mm', 'qd', 'db'\];/);
});

test('collect 只把豆包赠送并进余额，订阅窗口不进', () => {
  const b = bodyOf('collect');
  assert.match(b, /platform: 'db'/, 'collect 应当产出豆包余额项');
  assert.match(b, /w\.kind === 'incentive'/, 'collect 只该放行 incentive');
  assert.doesNotMatch(b, /fiveHour/, 'collect 不该把 5 小时订阅窗口算成余额');
  assert.doesNotMatch(b, /weekly/, 'collect 不该把每周订阅窗口算成余额');
});

test('算钱与判定口径看不见 BALANCE_ORDER', () => {
  ['missingPlatforms', 'burnOf', 'cnyOf', 'foresee', 'hasSubscription', 'Burndown', 'DailyChart'].forEach(function (name) {
    assert.doesNotMatch(bodyOf(name), /BALANCE_ORDER/, name + ' 只该认四个计价池');
  });
  assert.match(bodyOf('missingPlatforms'), /PLATFORM_ORDER/, 'missingPlatforms 应继续用 PLATFORM_ORDER');
  assert.match(bodyOf('hasSubscription'), /PLATFORM_ORDER/, 'hasSubscription 应继续用 PLATFORM_ORDER');
});

test('展示口径按 BALANCE_ORDER 排，豆包才有位置', () => {
  ['bucketPools', 'byPlatform', 'MiniEntry', 'Hero', 'BucketRow'].forEach(function (name) {
    assert.match(bodyOf(name), /BALANCE_ORDER/, name + ' 应按 BALANCE_ORDER 展示');
  });
});

test('赠送说过期、订阅说刷新', () => {
  const b = bodyOf('DoubaoQuota');
  assert.match(b, /w\.kind === 'incentive'/, 'DoubaoQuota 需要区分赠送与订阅');
  assert.match(b, /t\(' 天后过期'\)/, '赠送要说到期');
  assert.match(b, /t\(' 天后刷新'\)/, '订阅要说到点刷新');
});
test('BALANCE_ORDER 里每个平台都要有真品牌图标，不能退化成圆点', () => {
  const order = SRC.match(/var BALANCE_ORDER = \[([^\]]*)\]/);
  assert.ok(order, '没找到 BALANCE_ORDER');
  const ids = Array.from(order[1].matchAll(/'([a-z]{2})'/g), function (m) { return m[1]; });
  assert.ok(ids.length >= 5, 'BALANCE_ORDER 解析异常：' + ids.join(','));
  const start = SRC.indexOf('var ICON = {');
  assert.ok(start >= 0, '没找到 ICON 表');
  const block = SRC.slice(start, SRC.indexOf('\n    };', start));
  ids.forEach(function (id) {
    assert.match(block, new RegExp('^\\s*' + id + ": 'data:image/", 'm'), id + ' 缺品牌图标，平台上会退化成圆点');
  });
});

/* ---------------- 0.9.0 分区界面 + 豆包订阅分组守卫 ---------------- */

test('SECTION_META 每个区块都归进四个分区之一', () => {
  const start = SRC.indexOf('function makeSectionMeta()');
  assert.ok(start >= 0, 'makeSectionMeta 不见了');
  const block = SRC.slice(start, SRC.indexOf('var SECTION_META', start));
  const ids = [...block.matchAll(/\{ id: '([a-z]+)', group: '([a-z]+)'/g)];
  assert.equal(ids.length, 13, '13 个区块都应带 group，实际 ' + ids.length);
  const groups = new Set(ids.map((m) => m[2]));
  assert.deepEqual([...groups].sort(), ['accounts', 'balances', 'overview', 'usage']);
});

test('PanelView 四个分区都在场，区块没有被分区改版弄丢', () => {
  const b = bodyOf('PanelView');
  ['overview', 'balances', 'usage', 'accounts'].forEach(function (g) {
    assert.match(b, new RegExp("shownTab === '" + g + "'"), '缺分区 ' + g);
  });
  assert.match(b, /PanelTabs\(/, 'PanelView 应渲染分区导航');
  ['Foresight', 'Burndown', 'Subscription', 'DoubaoQuota', 'PlatformCard', 'BucketRow',
   'CreditLedger', 'ExpiryCalendar', 'DailyChart', 'SessionList', 'KeyBalances',
   'AccountPool', 'CredentialLine'].forEach(function (name) {
    assert.ok(b.includes(name + '(') || b.includes('h(' + name), name + ' 在分区改版后丢了');
  });
});

test('DoubaoQuota 把订阅与赠送分成两组显示，套餐积分有兜底名', () => {
  const b = bodyOf('DoubaoQuota');
  assert.match(b, /w\.kind !== 'incentive'/, '订阅组应放行 package/fiveHour/weekly');
  assert.match(b, /w\.kind === 'incentive'/, '赠送组只认 incentive');
  assert.match(b, /订阅额度 · 到点补满/);
  assert.match(b, /赠送额度 · 到期作废/);
  assert.match(b, /w\.kind === 'package' \? t\('套餐积分'\)/, 'package 窗口缺 label 时要有「套餐积分」兜底');
});

/* ---------------- 0.9.1 白屏守卫：含 hooks 的组件不能当普通函数调用 ---------------- */

test('Conditional blocks with hooks must be rendered as elements, not called', () => {
  // ThresholdPicker owns a useState. If a conditional tab calls it as a plain
  // function with a bare call, that hook attaches to PanelView and the
  // hook count changes when the tab hides it -> React crashes the page white.
  // It must be mounted as h(ThresholdPicker, ...) so the hook belongs to itself.
  const tp = bodyOf('ThresholdPicker');
  assert.match(tp, /React\.useState/, '前提：ThresholdPicker 含 useState');
  // No call site may invoke it as a bare function. Strip comments first so
  // the explanatory comment above does not match itself.
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const bareCalls = [...code.matchAll(/(?<![\w.])ThresholdPicker\(\{/g)];
  assert.equal(bareCalls.length, 0,
    'ThresholdPicker 被当普通函数调用，切分区会白屏；必须用 h(ThresholdPicker, ...)');
  assert.match(SRC, /h\(ThresholdPicker,/, 'ThresholdPicker 应作为元素渲染');
});

test('Every tab in PanelView is gated and the panel keeps a stable hook surface', () => {
  const b = bodyOf('PanelView');
  // 4 zones, each behind shownTab, no naked component call with hooks outside.
  ['overview', 'balances', 'usage', 'accounts'].forEach(function (g) {
    assert.match(b, new RegExp("shownTab === '" + g + "'"), '分区 ' + g + ' 缺门控');
  });
  // The stateful picker must be inside the balances zone (element form) only.
  assert.match(b, /h\(ThresholdPicker,/, '有态组件 ThresholdPicker 应以元素形式出现在分区内');
});


test('normalizeDoubao（宿主）读取 package 窗口并计入订阅', () => {
  const host = readFileSync(join(HERE, '..', 'lib', 'index.js'), 'utf8');
  const at = host.indexOf('function normalizeDoubao(');
  assert.ok(at >= 0);
  const open = host.indexOf('{', at);
  const close = matchBrace(host, open);
  const b = host.slice(open, close + 1);
  assert.match(b, /windows\.package/, '套餐积分窗口必须被读取');
  assert.match(b, /kind: 'package'/);
  assert.match(b, /w\.kind === 'package' \|\| w\.kind === 'fiveHour' \|\| w\.kind === 'weekly'/, 'package 应计入订阅额度');
});

