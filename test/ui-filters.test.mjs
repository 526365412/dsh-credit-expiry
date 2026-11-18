/**
 * 0.12.0 新功能守卫：统计口径、筛选组件渲染方式、宽窗口取数、密度与日历图层偏好。
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

test('统计口径：饼图按窗口 rows 聚合，不再读全账本 usage.providers', () => {
  const body = bodyOf(CLIENT, 'StatsView');
  assert.doesNotMatch(body, /usage\.providers/, '饼图不许再读 usage.providers（那是全账本累计）');
  assert.match(body, /metricOf\(r,\s*p\.id\)|metricOf\(r,/, '饼图必须按窗口行里的指标聚合');
  assert.match(body, /byPool|poolOf/, '扇区仍按平台口径分支');
});

test('筛选组件一律元素渲染：hook 只挂在组件自己身上，不挂到 PanelView', () => {
  ['CreditLedger', 'SessionList', 'ProviderList', 'ExpiryCalendar'].forEach((name) => {
    assert.match(CLIENT, new RegExp('h\\(' + name + ',|h\\(' + name + '\\b'), name + ' 必须以元素方式渲染');
    assert.doesNotMatch(CLIENT, new RegExp('(^|[^h])\\b' + name + '\\(\\{'), name + ' 不许被当普通函数裸调用');
    assert.match(bodyOf(CLIENT, name), /React\.useState|React\.usePrefs|usePrefs\(/, name + ' 自己持有状态 hook');
  });
});

test('取数：筛选要宽窗口，宿主按 prov/sess 放宽截断且夹上限', () => {
  assert.match(CLIENT, /api\/data\?prov=\d+&sess=\d+/, '客户端必须请求更宽的模型/会话窗口');
  assert.match(HOST, /searchParams\.get\('prov'\)/, '宿主从查询串读 prov');
  assert.match(HOST, /searchParams\.get\('sess'\)/, '宿主从查询串读 sess');
  const clamp = bodyOf(HOST, 'clampLimit');
  assert.match(clamp, /Math\.max|Math\.min/, 'clampLimit 必须夹上下限');
});

test('偏好演进：密度与日历图层各有默认值、兜底与独立键', () => {
  assert.match(CLIENT, /density:\s*'comfort'/, 'DEFAULT_PREFS 必须有密度默认值');
  assert.match(bodyOf(CLIENT, 'clonePrefs'), /density/, 'clonePrefs 必须兜底 density');
  assert.match(CLIENT, /cal:\s*\{ wb: true/, 'DEFAULT_PREFS 必须有日历图层开关');
  assert.match(bodyOf(CLIENT, 'clonePrefs'), /cal/, 'clonePrefs 必须兜底 cal');
  const cal = bodyOf(CLIENT, 'ExpiryCalendar');
  assert.match(cal, /PREFS\.cal/, '日历只看自己的图层开关');
  assert.doesNotMatch(cal, /PREFS\.platforms/, '日历不许复用侧栏 platforms 开关');
  assert.match(bodyOf(CLIENT, 'setPref'), /cal/, 'setPref 要能写 cal 图层');
});

test('键盘：只认真实按键，且焦点不在面板里就不抢', () => {
  const body = bodyOf(CLIENT, 'PanelView');
  assert.match(body, /e\.isTrusted !== true/, 'Esc/数字键必须忽略别的界面伪发的事件');
  assert.match(body, /PANEL_ROOT_ID/, '必须确认按键发生在面板内');
  assert.match(CLIENT, /var PANEL_ROOT_ID = 'cxe-panel-root';/, '面板根节点要有 id');
});
