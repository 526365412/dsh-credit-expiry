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
