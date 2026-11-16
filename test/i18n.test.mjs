// Every Chinese literal that reaches the screen goes through t(), and every
// one of those has to exist in the English dictionary — otherwise an English
// UI silently falls back to Chinese. This test reads the client source and
// checks both directions, so adding a string without translating it fails CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'lib', 'client.js'), 'utf8');

// CJK ideographs plus the fullwidth/CJK punctuation that rides along with
// them: 「」，、（）：。 all need translating too, they are not ASCII.
const CJK = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;

function callSites() {
  const found = new Set();
  const re = /t\('((?:[^'\\\n]|\\.)*)'\)/g;
  for (const m of src.matchAll(re)) {
    if (CJK.test(m[1])) found.add(m[1]);
  }
  return found;
}

function dictionary() {
  const start = src.indexOf('var LOCALE =');
  assert.ok(start > 0, 'LOCALE 字典不见了');
  const end = src.indexOf('var LANG =', start);
  assert.ok(end > start, 'LANG 在 LOCALE 之前');
  const block = src.slice(start, end);
  const out = new Map();
  const re = /^\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/gm;
  for (const m of block.matchAll(re)) out.set(m[1], m[2]);
  return out;
}

test('每个中文文案都走 t()，没有被漏掉的裸字面量', () => {
  const bare = [];
  const re = /'((?:[^'\\\n]|\\.)*)'/g;
  for (const m of src.matchAll(re)) {
    if (!CJK.test(m[1])) continue;
    const pre = src.slice(Math.max(0, m.index - 40), m.index);
    // a quoted CJK string that is not wrapped in t( and is not a dictionary
    // key/value (those live between LOCALE and LANG, in double quotes) is a leak
    if (/t\(\s*$/.test(pre)) continue;
    // the language picker names each language in its own script on purpose
    if (m[1] === '中文') continue;
    bare.push(m[1]);
  }
  assert.deepEqual(bare, [], '这些中文字面量没有包 t()：' + bare.slice(0, 5).join(' / '));
});

test('英文词典覆盖全部 t() 文案', () => {
  const dict = dictionary();
  const missing = [...callSites()].filter((k) => !dict.has(k));
  assert.deepEqual(missing, [], '缺英文：' + missing.slice(0, 5).join(' / '));
});

test('翻译不是把原样粘一遍', () => {
  const dict = dictionary();
  const identical = [...dict.entries()].filter(([k, v]) => k === v && CJK.test(k));
  assert.deepEqual(identical.map(([k]) => k), [], '这些条目没有真的翻译');
});

test('词典里没有没人用的死条目', () => {
  const dict = dictionary();
  const used = callSites();
  // single-character separators may only appear via join(...) style calls
  const dead = [...dict.keys()].filter((k) => !used.has(k));
  assert.deepEqual(dead, [], '词典里这些键没有被引用：' + dead.slice(0, 5).join(' / '));
});
