#!/usr/bin/env node
// 生成自建插件市场索引（plugin market index format 1）。
// 用法：node scripts/build-index.mjs [--check]
// 输出：仓库根目录 index.json —— 直接提交推送后即可作为索引源 URL。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

// 固定到最近一次改动插件代码（lib/ 或 package.json）的提交：文档类提交不会让索引失效，
// 装到的也始终是带真实代码的那个版本，--check 才能稳定通过。
const commit = git('log', '-1', '--format=%H', '--', 'lib', 'package.json')
const publishTimestamp = Number(git('show', '-s', '--format=%ct', commit))
const repoUrl = 'https://github.com/526365412/dsh-credit-expiry'

// 图标内嵌成 data: URL（<32KiB），索引自包含，换机器/换源都不用再带资源。
const iconFile = path.join(root, 'docs', 'icon.png')
const iconBytes = fs.readFileSync(iconFile)
const icon = iconBytes.length <= 32 * 1024
  ? 'data:image/png;base64,' + iconBytes.toString('base64')
  : null

const title = { en: 'Credit Expiry', zh: '积分到期' }
const description = {
  en: 'Credit expiry panel for WorkBuddy, Trae, MiniMax Code and Qoder: one row in the left sidebar shows every pool balance and the nearest expiry, and the full page breaks down expiry buckets, credit spend and the sessions that consumed credits.',
  zh: '积分到期面板：左侧边栏一行显示 WorkBuddy、Trae、MiniMax Code、Qoder 四个积分池的余额与最近到期日，点开是完整页面（到期分布 + 积分消耗 + 积分会话）。',
}

const index = {
  format: 1,
  title: { en: 'DSH 自建插件索引', zh: 'DSH 自建插件索引' },
  description: {
    en: 'Self-hosted index for plugins published by 526365412.',
    zh: '526365412 自建插件索引，收录本机自用插件。',
  },
  metadata: {
    categories: {
      usage: { title: { en: 'Usage & Quota', zh: '用量与额度' } },
    },
    labels: {
      credits: { title: { en: 'Credits', zh: '积分' } },
    },
  },
  plugins: [
    {
      name: pkg.name,
      title,
      description,
      ...icon === null ? {} : { icon },
      author: pkg.author,
      homepage: pkg.homepage,
      repository: { url: repoUrl },
      metadata: {
        category: 'usage',
        keywords: pkg.keywords.filter(k => k !== 'dsh' && k !== 'dsh-plugin'),
        labels: ['credits'],
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp,
          source: { type: 'git', url: repoUrl, commit },
          engines: { dsh: pkg.engines.dsh },
        },
      ],
    },
  ],
}

const text = JSON.stringify(index, null, 2) + '\n'
const out = path.join(root, 'index.json')
if (process.argv.includes('--check')) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
  if (current !== text) {
    console.error('index.json 与当前 package.json / git HEAD 不一致，请重新运行 node scripts/build-index.mjs')
    process.exit(1)
  }
  console.log('index.json 已是最新')
} else {
  fs.writeFileSync(out, text)
  console.log('wrote ' + out + ' (' + text.length + ' 字节, ' + pkg.name + '@' + pkg.version + ' @ ' + commit.slice(0, 7) + ')')
}
