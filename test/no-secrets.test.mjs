/**
 * 「库里不要包含任何 key」——扫描所有被 git 跟踪的文本文件，断言不含常见格式的
 * 凭据字面量，也不含写死的 Bearer token。
 *
 * 只扫 git 跟踪的文件（用 git ls-files），因为 node_modules、dist、.git 本来就不
 * 该进库；未跟踪的临时文件也不该让 CI 红掉。仓库不是 git 仓库时（例如 tarball 解
 * 压后跑测试）回退到递归遍历，并跳过 .git/node_modules/dist。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.tmp']);
/** 二进制文件不扫（图片/压缩包里的字节会误报）。 */
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.zip', '.gz', '.tgz', '.pdf', '.woff', '.woff2', '.ttf']);
/** 大小上限：超过 2 MiB 的文件当作资产跳过。 */
const MAX_BYTES = 2 * 1024 * 1024;

/** 凭据模式。故意写得宽松——宁可误报也不漏报。 */
const PATTERNS = [
  { name: 'OpenAI/DeepSeek 风格 sk- key', re: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'GitHub personal token (ghp_)', re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: 'GitHub OAuth token (gho_/ghu_/ghs_/ghr_)', re: /gh[ousr]_[A-Za-z0-9]{20,}/ },
  { name: 'npm token (npm_)', re: /npm_[A-Za-z0-9]{20,}/ },
  { name: 'AWS access key (AKIA...)', re: /AKIA[0-9A-Z]{16}/ },
  { name: '硬编码 Bearer token', re: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i },
  { name: 'Anthropic key (sk-ant-)', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'Google API key (AIza...)', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Slack token (xox...)', re: /xox[abprs]-[A-Za-z0-9-]{10,}/ }
];

/** 被 git 跟踪的文件（相对仓库根、正斜杠）。 */
function trackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\u0000').filter(Boolean);
  } catch {
    return null;
  }
}

/** git 不可用时的回退：递归遍历。 */
async function walkFiles(dir, acc) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkFiles(full, acc);
    } else if (entry.isFile()) {
      acc.push(relative(ROOT, full).split(sep).join('/'));
    }
  }
  return acc;
}

/** 读成文本；二进制或超大文件返回 null。 */
function readText(path) {
  const full = join(ROOT, path);
  let info;
  try {
    info = statSync(full);
  } catch {
    return null;
  }
  if (!info.isFile() || info.size > MAX_BYTES) return null;
  const dot = path.lastIndexOf('.');
  if (dot !== -1 && BINARY_EXT.has(path.slice(dot).toLowerCase())) return null;
  const buffer = readFileSync(full);
  // 含 NUL 字节视为二进制
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

test('库里不含任何硬编码凭据', async () => {
  const listed = trackedFiles();
  const files = listed && listed.length ? listed : await walkFiles(ROOT, []);
  assert.ok(files.length > 0, '没有找到任何待扫描的文件');

  // 测试文件自身含有这些正则的字面量（例如 "ghp_"），扫描时必须排除自己。
  const self = relative(ROOT, fileURLToPath(import.meta.url)).split(sep).join('/');

  const findings = [];
  for (const file of files) {
    if (file === self) continue;
    const text = readText(file);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const pattern of PATTERNS) {
        if (pattern.re.test(lines[i])) {
          findings.push(file + ':' + (i + 1) + ' -> ' + pattern.name);
        }
      }
    }
  }

  assert.deepEqual(
    findings,
    [],
    '发现疑似凭据，请改为从运行时凭据读取：\n' + findings.join('\n')
  );
});

test('被扫描的文件集合里不包含 node_modules / dist / .git', async () => {
  const listed = trackedFiles();
  const files = listed && listed.length ? listed : await walkFiles(ROOT, []);
  const bad = files.filter((f) =>
    f.startsWith('node_modules/') || f.startsWith('dist/') || f.startsWith('.git/'));
  assert.deepEqual(bad, [], '这些路径不该出现在待扫描集合里：\n' + bad.join('\n'));
});
