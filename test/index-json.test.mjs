/**
 * index.json 校验：它同时是插件市场索引和本插件的版本信标（lib/index.js 的
 * updateState 会去拉这份文件比较版本），所以字段错一处，更新检查就静默失效。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8'));

test('index.json 是 format 1 且 plugins 是非空数组', () => {
  assert.equal(index.format, 1);
  assert.ok(Array.isArray(index.plugins));
  assert.ok(index.plugins.length > 0);
});

test('index.json 里的插件名与 package.json 一致', () => {
  const plugin = index.plugins.find((p) => p && p.name === pkg.name);
  assert.ok(plugin, 'index.json 里没有名为 ' + pkg.name + ' 的插件条目');
});

test('版本与 package.json 一致，且 versions[0] 是它', () => {
  const plugin = index.plugins.find((p) => p && p.name === pkg.name);
  assert.ok(Array.isArray(plugin.versions) && plugin.versions.length > 0, 'versions 必须是非空数组');
  assert.equal(plugin.versions[0].version, pkg.version, 'index.json 版本落后于 package.json（忘了跑 build:index？）');
});

test('versions[0].source.url 是本仓库的 GitHub 地址', () => {
  const plugin = index.plugins.find((p) => p && p.name === pkg.name);
  const source = plugin.versions[0].source || {};
  assert.equal(source.type, 'git');
  assert.equal(typeof source.url, 'string');
  assert.match(source.url, /^https:\/\/github\.com\/[^/]+\/dsh-credit-expiry\/?$/, '实际是: ' + source.url);
  // 仓库地址必须和 package.json 的 repository 指向同一个仓库
  const repoUrl = pkg.repository && pkg.repository.url ? pkg.repository.url : '';
  const normalized = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '').replace(/\/$/, '');
  assert.equal(source.url.replace(/\/$/, ''), normalized, 'source.url 与 package.json repository 不一致');
});

test('versions[0].source.commit 是 40 位小写十六进制', () => {
  const plugin = index.plugins.find((p) => p && p.name === pkg.name);
  const commit = plugin.versions[0].source.commit;
  assert.equal(typeof commit, 'string');
  assert.match(commit, /^[0-9a-f]{40}$/, 'commit 必须是 40 位小写十六进制，实际是: ' + commit);
});

test('versions[0] 带 publishTimestamp 与 engines.dsh 约束', () => {
  const plugin = index.plugins.find((p) => p && p.name === pkg.name);
  const entry = plugin.versions[0];
  assert.equal(typeof entry.publishTimestamp, 'number');
  assert.ok(entry.publishTimestamp > 0);
  assert.equal(typeof entry.engines.dsh, 'string');
  assert.equal(entry.engines.dsh, pkg.engines.dsh, 'engines.dsh 与 package.json 不一致会让装到的版本报错');
});

test('index.json 的内嵌图标是 data URL（不是外链，索引需自包含）', () => {
  const plugin = index.plugins.find((p) => p && p.name === pkg.name);
  if (plugin.icon === undefined) return; // 图标可省略，build-index 在超过 32KiB 时会丢弃
  assert.match(plugin.icon, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
});
