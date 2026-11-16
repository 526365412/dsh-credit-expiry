/**
 * 计价纯函数测试（isPeak / tierCost / versionGt）。
 *
 * 权宜做法（重要）：这三个函数目前都写在 lib/index.js 里且没有 export，本测试
 * 不能直接 import。按约定，这里用 node:fs 读取 lib/index.js 的源码文本，用正则
 * 加括号配对截取函数体与它依赖的常量，再用 new Function 在沙箱里重建一份可调用
 * 版本后测试。好处是 lib/ 完全不用改；坏处是源码一旦重命名或重构，截取会直接抛
 * 错（测试失败，而不是静默通过）——这是预期行为，不是漏测。
 *
 * 将来把纯函数抽到 lib/money.js 并 export 之后，本文件应改成：
 *   import { isPeak, tierCost, versionGt } from '../lib/money.js'
 * 并删掉下面的截取器与 buildSandbox。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(HERE, '..', 'lib', 'index.js');
const SOURCE = readFileSync(SOURCE_PATH, 'utf8');

/* ---------------- 从源码文本里截取片段 ---------------- */

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

/** 从 open 位置开始做括号配对，返回配对的 close 下标（跳过字符串与注释）。 */
function matchBracket(text, openIndex) {
  const open = text[openIndex];
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'" || ch === '"' || ch === '`') { i = skipString(text, i); continue; }
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      if (nl === -1) break;
      i = nl;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('无法在 lib/index.js 里配对 ' + open + '（源码结构变了？）');
}

/** 截取 function 声明（含函数体）的完整源码。 */
function extractFunction(name) {
  const head = new RegExp('^function[ \\t]+' + name + '[ \\t]*\\(', 'm').exec(SOURCE);
  if (!head) throw new Error('lib/index.js 里找不到函数 ' + name + '（被重命名或搬走了？）');
  const parenOpen = SOURCE.indexOf('(', head.index);
  const parenClose = matchBracket(SOURCE, parenOpen);
  const bodyOpen = SOURCE.indexOf('{', parenClose);
  const bodyClose = matchBracket(SOURCE, bodyOpen);
  return SOURCE.slice(head.index, bodyClose + 1);
}

/** 截取顶层 const 声明（到同层的分号为止）的完整源码。 */
function extractConst(name) {
  const head = new RegExp('^const[ \\t]+' + name + '[ \\t]*=', 'm').exec(SOURCE);
  if (!head) throw new Error('lib/index.js 里找不到常量 ' + name);
  let i = head.index + head[0].length;
  let depth = 0;
  for (; i < SOURCE.length; i += 1) {
    const ch = SOURCE[i];
    if (ch === "'" || ch === '"' || ch === '`') { i = skipString(SOURCE, i); continue; }
    if (ch === '/' && SOURCE[i + 1] === '/') {
      const nl = SOURCE.indexOf('\n', i);
      if (nl === -1) break;
      i = nl;
      continue;
    }
    if (ch === '/' && SOURCE[i + 1] === '*') {
      const end = SOURCE.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ';' && depth === 0) break;
  }
  return SOURCE.slice(head.index, i + 1);
}

/** 在独立作用域里重建这些函数（连同它们依赖的常量）。 */
function buildSandbox() {
  const parts = [
    extractConst('DEEPSEEK_PEAK_WINDOWS'),
    extractConst('BJ_OFFSET_MS'),
    extractConst('BUNDLED_HOLIDAYS'),
    extractFunction('holidaySet'),
    extractFunction('isTier'),
    extractFunction('isPeak'),
    extractFunction('tierCost'),
    extractFunction('versionGt'),
    'return { isPeak, tierCost, versionGt, holidaySet, isTier };'
  ];
  // new Function 只在测试进程内执行，输入是仓库自己的源码文本。
  return new Function(parts.join('\n\n'))();
}

const { isPeak, tierCost, versionGt, holidaySet, isTier } = buildSandbox();

/* ---------------- 时间工具 ---------------- */

/** 把「北京时间 年-月-日T时:分」转成毫秒时间戳。 */
function bj(stamp) {
  const ms = Date.parse(stamp + ':00+08:00');
  if (!Number.isFinite(ms)) throw new Error('时间字面量写错了: ' + stamp);
  return ms;
}

/* ---------------- isPeak ---------------- */

test('isPeak：工作日 9-12、14-18 点高峰', () => {
  const holidays = holidaySet();
  // 2026-11-16 是周一。
  assert.equal(isPeak(bj('2026-11-16T09:00'), holidays), true, '9:00 整应算高峰');
  assert.equal(isPeak(bj('2026-11-16T11:59'), holidays), true, '11:59 应算高峰');
  assert.equal(isPeak(bj('2026-11-16T14:00'), holidays), true, '14:00 整应算高峰');
  assert.equal(isPeak(bj('2026-11-16T17:59'), holidays), true, '17:59 应算高峰');
  assert.equal(isPeak(bj('2026-11-16T10:30'), holidays), true);
});

test('isPeak：窗口左闭右开，午休与夜间空闲', () => {
  const holidays = holidaySet();
  assert.equal(isPeak(bj('2026-11-16T08:59'), holidays), false, '8:59 还没到高峰');
  assert.equal(isPeak(bj('2026-11-16T12:00'), holidays), false, '12:00 已离开高峰');
  assert.equal(isPeak(bj('2026-11-16T13:00'), holidays), false, '13:00 午休空闲');
  assert.equal(isPeak(bj('2026-11-16T18:00'), holidays), false, '18:00 已离开高峰');
  assert.equal(isPeak(bj('2026-11-16T23:30'), holidays), false, '深夜空闲');
  assert.equal(isPeak(bj('2026-11-16T03:00'), holidays), false, '凌晨空闲');
});

test('isPeak：周末全天空闲', () => {
  const holidays = holidaySet();
  // 2026-11-21 周六、2026-11-22 周日。
  assert.equal(isPeak(bj('2026-11-21T10:30'), holidays), false, '周六 10:30 不算高峰');
  assert.equal(isPeak(bj('2026-11-21T15:00'), holidays), false, '周六 15:00 不算高峰');
  assert.equal(isPeak(bj('2026-11-22T10:30'), holidays), false, '周日 10:30 不算高峰');
});

test('isPeak：节假日全天空闲，并支持额外补充的节假日', () => {
  // 2026-10-01 是周四，但在内置国庆假期里。
  assert.equal(isPeak(bj('2026-10-01T10:30'), holidaySet()), false, '国庆 10:30 不算高峰');
  assert.equal(isPeak(bj('2026-10-01T10:30'), null), true, '不传节假日集合时按普通工作日算');
  // 补充节假日：把 2026-11-16（周一）人为设成假期。
  assert.equal(isPeak(bj('2026-11-16T10:30'), holidaySet(['2026-11-16'])), false);
  // 补充的节假日不影响别的日子。
  assert.equal(isPeak(bj('2026-11-17T10:30'), holidaySet(['2026-11-16'])), true);
});

test('isPeak：非法时间戳返回 false，不会抛错', () => {
  const holidays = holidaySet();
  assert.equal(isPeak(0, holidays), false);
  assert.equal(isPeak(-1, holidays), false);
  assert.equal(isPeak(NaN, holidays), false);
  assert.equal(isPeak(undefined, holidays), false);
});

/* ---------------- tierCost ---------------- */

test('tierCost：按输入/缓存读/缓存写/输出分别计价', () => {
  const rate = { input: 1, cached: 0.02, output: 4 };
  const tokens = { input: 1e6, cacheRead: 1e6, cacheWrite: 1e6, output: 1e6 };
  // 1 + 0.02 + 1（缓存写按未命中计） + 4
  assert.equal(tierCost(tokens, rate), 6.02);
});

test('tierCost：缺 cached 时缓存读按输入价计', () => {
  const rate = { input: 1, output: 4 };
  const tokens = { input: 0, cacheRead: 1e6, output: 0 };
  assert.equal(tierCost(tokens, rate), 1);
});

test('tierCost：字段缺失返回有限数（0），绝不产出 NaN', () => {
  // 说明：lib/index.js:684-692 的实际契约是「费率不是合法 tier 时返回 0」，
  // 返回 null 的是 lookupPrice（lib/index.js:669-681）。这里按真实实现断言：
  // 结果是有限数且为 0，永远不是 NaN。
  const partial = { input: 1 };            // 缺 output
  const tokens = { input: 1e6, output: 1e6 };
  const got = tierCost(tokens, partial);
  assert.equal(Number.isFinite(got), true, '必须是有限数');
  assert.equal(got, 0, '非法费率按 0 处理');
  assert.equal(Number.isNaN(got), false, '绝不产出 NaN');

  assert.equal(tierCost(tokens, null), 0);
  assert.equal(tierCost(tokens, undefined), 0);
  assert.equal(tierCost(tokens, {}), 0);
  assert.equal(tierCost(tokens, { input: NaN, output: 4 }), 0, 'NaN 费率视为非法');
  assert.equal(tierCost(tokens, { input: '1', output: 4 }), 0, '字符串费率视为非法');
});

test('tierCost：tokens 字段缺失按 0 计，不产生 NaN', () => {
  const rate = { input: 1, cached: 0.02, output: 4 };
  assert.equal(tierCost({}, rate), 0);
  assert.equal(tierCost({ input: 1e6 }, rate), 1);
  assert.equal(tierCost({ output: 1e6 }, rate), 4);
  assert.equal(tierCost({ input: NaN, output: 1e6 }, rate), 4, 'NaN 令牌数按 0 计');
  assert.equal(tierCost({ input: null, cacheRead: null, cacheWrite: null, output: null }, rate), 0, 'null 令牌数按 0 计');
});

test('isTier：只有两个令牌价都是有限数才算合法费率', () => {
  assert.equal(isTier({ input: 1, output: 4 }), true);
  assert.equal(isTier({ input: 1, output: 4, cached: 0.02 }), true);
  assert.equal(isTier({ input: 1 }), false);
  assert.equal(isTier({ output: 4 }), false);
  assert.equal(isTier({ input: 1, output: Infinity }), false);
  assert.equal(isTier(null), false);
  assert.equal(isTier(4), false);
});

/* ---------------- versionGt ---------------- */

test('versionGt：普通补丁号比较', () => {
  assert.equal(versionGt('0.3.1', '0.3.0'), true);
  assert.equal(versionGt('0.3.0', '0.3.1'), false);
  assert.equal(versionGt('0.3.1', '0.3.1'), false, '相等不算更大');
});

test('versionGt：按数位比较而不是字符串比较', () => {
  assert.equal(versionGt('0.10.0', '0.9.9'), true, '10 > 9，不能被字典序骗了');
  assert.equal(versionGt('1.2.3', '1.2.10'), false);
  assert.equal(versionGt('2.0.0', '1.99.99'), true);
});

test('versionGt：预发布版低于同名正式版', () => {
  assert.equal(versionGt('0.3.1-rc.1', '0.3.1'), false, 'rc 比正式版低');
  assert.equal(versionGt('0.3.1', '0.3.1-rc.1'), true, '正式版比 rc 高');
  assert.equal(versionGt('1.0.0-rc.1', '1.0.0'), false);
  assert.equal(versionGt('0.2.2-rc.2', '0.2.2-rc.1'), true, 'rc 序号递增');
  assert.equal(versionGt('1.2.3-beta', '1.2.3-alpha'), true, '字母段按字符串比较');
});

test('versionGt：缺省段按 0 处理，空值不抛错', () => {
  assert.equal(versionGt('1.2', '1.2.0'), false);
  assert.equal(versionGt('1.2.1', '1.2'), true);
  assert.equal(versionGt(undefined, '0.0.1'), false);
  assert.equal(versionGt('0.0.1', undefined), true);
  assert.equal(versionGt(null, null), false);
});

/* ---------------- 截取器自身 ---------------- */

test('源码截取器拿到的是真实实现，而不是空壳', () => {
  const sandboxSource = [
    extractFunction('isPeak'),
    extractFunction('tierCost'),
    extractFunction('versionGt')
  ].join('\n');
  assert.match(sandboxSource, /function isPeak\(ms, holidays\)/);
  assert.match(sandboxSource, /function tierCost\(tokens, rate\)/);
  assert.match(sandboxSource, /function versionGt\(a, b\)/);
  assert.equal(extractConst('DEEPSEEK_PEAK_WINDOWS').startsWith('const DEEPSEEK_PEAK_WINDOWS ='), true);
});
