# dsh-credit-expiry

左侧边栏的「积分到期」：底栏一行只放最要紧的信息（四平台余额 + 最该处理的浪费），点进去是完整页面——到期预测、统一积分账本、到期日历、积分消耗与峰谷、积分会话。

它回答的不是「我还有多少积分」，而是「照现在这个用法，哪些积分会在到期前用不完」。

## 数据来源

宿主半（`lib/index.js`）在 DSH Web 服务上注册同源路由 `GET /credit-expiry/api/data`，一次返回五份数据：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `wb` | `/plugins/dsh-connect-workbuddy/usage` | WorkBuddy 积分包（含到期毫秒时间戳） |
| `tr` | `/plugins/dsh-connect-trae/usage` | Trae 积分账户（含到期毫秒时间戳） |
| `mm` | `/plugins/dsh-connect-minimaxcode/status` | MiniMax Code 积分（`credits.upcoming` → `lots`） |
| `qd` | `/plugins/dsh-connect-qoder/usage` | Qoder 积分包（到期日取套餐到期时间） |
| `usage` | `~/.dsh/storages/cost-meter/ledger.json` + 三家厂商官方价目 | 近 14 天积分消耗（含 `byPool` 分平台）、按模型汇总（含缓存命中率）、最近若干条积分会话、峰谷 token 占比、每个池子的实测分/元（`pools`）与价目元信息（`pricing`）、近 7 天各池日均消耗（`burn`，到期预测的唯一输入） |

任一上游失败都不影响其余，失败项写进 `errors`，客户端照常渲染成功的一侧。账本按 `ino:mtime:size` 缓存，1.4MB 的单行 JSON 不会每次重解析。

**只统计积分池**：`CREDIT_PROVIDERS = ['workbuddy', 'trae', 'minimaxcode', 'qoder']`，`PROVIDER_POOL` 把它们映射到 `wb / tr / mm / qd` 四个池。DeepSeek 直连、CLI Proxy、魔搭这些走现金的 provider 一律排除——它们不消耗任何会过期的余额，混进来只会淹没积分口径。

**Qoder 的到期日是套餐日**：它返回的 `credits.packages` 只有 `base` / `addon` 两个包，各自没有到期时间，只有 `credits.planExpiresAtMs`。套餐失效后余额一并消失，所以每个包都套用套餐日，而不是多开一个「永不过期」的桶。

## 积分的口径

**积分数字只用平台自己报的，插件不自己推。** 早期版本拿账本里的 `costCny` 除以一个常数换积分，结果是 Trae 显示 1421.64 而平台实际只扣了 657.53——差了一倍多。四个池子的可信来源各不相同，现在分别取：

| 平台 | 已消耗积分的来源 |
| --- | --- |
| WorkBuddy | `sum(packages.size - packages.remain)` |
| Trae | `credits.consumed`（平台直接给） |
| MiniMax Code | `credits.consumed` |
| Qoder | `sum(packages.size - packages.remain)` |

拿到每个池子的真实消耗后，池内再按条目分摊：**每个条目的积分 = 池子消耗 × 该条目权重 / 池内权重之和**，所以一个池子里所有模型加起来永远等于平台报的那个数，不会多也不会少。权重优先用该条目的实时金额（贵模型占的额度多，符合按量计费的实际），池内一笔有价的调用都没有时（比如 Qoder 的 `dfmodel` 没有公开价）才退回用 tokens 分摊。

## 人民币参考价

界面以**积分**为主，人民币只作 `≈¥` 注释。金额按**官方单价 × 实际 token** 实时算，不走 OpenRouter、也不算汇率——那是上一版的做法，会把智谱一类的模型系统性算歪（OpenRouter 上 `glm-5.3` 约 0.47 / 9.3 元每百万，智谱官方国内直连是 8 / 28 元，差一个数量级）。

价源是三家厂商自己的定价页，各写一个 parser：

| 厂商 | 价页 | 覆盖模型 |
| --- | --- | --- |
| DeepSeek | `https://api-docs.deepseek.com/zh-cn/quick_start/pricing.md` | `deepseek-flash`、`deepseek-v4-pro`（含空闲/高峰双档） |
| 智谱 | `https://docs.bigmodel.cn/cn/guide/start/pricing.md` | `GLM-5.3`、`GLM-5.3-Flash`、`GLM-5.3-FlashX` |
| MiniMax | `https://platform.minimaxi.com/document/price` | `MiniMax-M3.1-Flash`、`MiniMax-M3` |

计价规则：

1. 每个条目按**输入、缓存命中、缓存未命中、输出**四路分别乘单价。缓存命中走命中价（DeepSeek flash 0.02 vs 未命中 1 元/百万，差 50 倍），这一项正是早期金额虚高的主因。
2. **峰谷**：DeepSeek 的高峰价是空闲价的 2 倍。高峰 = 北京时间周一至周五 9:00-12:00、14:00-18:00，法定节假日与周末全天空闲。会话记录带 `at` 毫秒时间戳，所以按会话时刻判定峰谷，页面上单独给出「高峰 X% · 空闲 Y%」。智谱与 MiniMax 不分峰谷，按平价计。
3. 价目缓存 6 小时，落在 `<DSH_HOME>/storages/credit-expiry/prices.json`（`schema: 2`，旧版 USD 缓存直接丢弃）；联网失败先用磁盘缓存，再退回内置快照，页脚标明当前是官方实时价目还是缓存。

模型名走 `MODEL_ALIAS` 归一：`deepseek-v4.1-flash` / `deepseek-v4.1-flash-1017` / `deepseek-v4-flash` 都按 `deepseek-flash` 计价，`glm-5.3-flashx-legal` 按 `glm-5.3-flashx`。

免费模型（平台 `creditMultiplier` 为 0）单独标「免费模型」，既不算钱也不占积分；没有公开价的模型标「无公开价」，并在页面上方提示是哪些——不猜、不按别的模型代填。

**已知的数据限制**：Trae 走 `solo_work_remote`，不上报 `cached_tokens`，账本里 `trae:deepseek-v4.1-flash` 的 `cacheRead` 恒为 0。所以 Trae 那部分全部按缓存未命中计价，金额只会偏高不会偏低；WorkBuddy 的同一模型命中率 95%，两者不可直接比较。

## 界面

### 侧边栏底栏（compact）

![row](docs/preview-row.png)

顶部一行是四平台官方图标 + 余额合计；如果按近 7 天的速度有关不掉的积分，下面跟一行红字「X 积分会在用掉前过期」——不打开页面也能看到最该处理的那件事。再往下每行一个最近到期的项目：到期平台的图标 + 日期 + 剩余天数 + 积分。点整块打开完整页面。

### 完整页面

![preview](docs/preview.png)

整页 `height:100%; overflow-y:auto` 独立滚动，不会把外层容器撑高。自上而下：

1. 标题栏：返回会话、标题、更新时间、刷新。
2. 合计卡：剩余积分总计 + 按平台的堆叠条 + 带图标的图例。
3. 提醒条：30 天内到期的到期日数量与积分合计；没有临期时显示绿色常态。
4. 工具行：「复制摘要」（把合计、已用、最近几个到期日和处置建议贴成一段纯文本）与「到期提醒」（浏览器通知，权限只在点击时申请）。
5. 到期预测：按近 7 天实测速度算哪些积分会在到期前用不完，附浪费金额与「建议先用哪家的哪个包」。详见下一节。
6. 按平台：四张卡 2×2 排列，各含平台图标与名称、平台总量、内部紧迫度堆叠条、最近 3 个到期日（同日多项合并成「N 项」）。点卡片可按平台筛选。
7. 按到期日：每天一行，左侧是到期平台的官方图标，**条形长度 = 该行积分 / 当前显示行的最大积分**，所以 200 积分明显比 100 积分长，而不是每行都拉满；默认 8 行，可展开全部。页眉左侧是五档紧迫度图例，右侧是「临期档位 紧 / 标准 / 宽」切换。
8. 积分账本：把所有平台的积分包拍平成一张表——平台 / 包名、剩余、总量、已用、到期日、倒计时。这是唯一一处把不同平台的积分包当成同一种东西排列的地方。
9. 到期日历：周一起头的月网格，格内数字是当天到期的积分，红块深浅按相对量，今天带描边，页眉可翻月。
10. 积分消耗 · 近 14 天：柱状图按平台分色堆叠（柱高按积分，带最高日与日均两条参考线）+ 按 `provider:model` 的消耗排行（每行带缓存命中率），右侧积分大、人民币小，免费模型与无公开价分别单独标注。
11. 峰谷用量：高峰/空闲双色占比条 + 两段 token 量，说明高峰时段定义与 DeepSeek 高峰 2 倍价。
12. 积分会话：时间、平台图标、标题、次数、tokens、积分（下方小字 ≈¥）。
13. 页脚：数据来源、官方价目来源与抓取时刻、各池实测分/元、无公开价的模型清单。

## 到期预测

预测区只做一件事：把「还剩多少天」换成「照现在这个用法，到期前能花掉多少、剩下多少会作废」。

- **速率是实测的，分摊是假设的**。宿主按平台算近 7 天日均消耗（`usage.burn[pool]`），这是账本里的真实数字；但一个平台里有多个包时，平台并不告诉你哪一次调用扣的是哪个包，所以页面按当前余额比例把速率摊到各包（`share = poolBurn × remain / poolRemain`）。余额多的包分到的消耗多，这符合大多数平台"先扣快过期的"之外的常见行为，但它是估算——卡片底部写明了这一点，不要把它当成平台的扣减顺序。
- 判定式：`可消耗 = 每日速率 × 剩余天数`；`浪费 = 剩余 − 可消耗`。浪费为正才算风险，按金额降序，最多列 4 行，其余合并成「另有 N 个积分包同样会在到期前用不完」。
- 金额用所在池的实测「分/元」折算。Qoder 没有公开价（`rate` 为 null），它的浪费只报积分不报钱。
- 决策行只给一条：浪费金额最大的那个包，写「建议先用 X 的「Y」（约 ¥Z 会作废）」。不做多目标优化，因为真正的约束是"先用哪个"，不是"怎么分配最优"。
- 没有任何池子有用量时预测区整块消失，不显示「暂无数据」这种空壳；有速率但没有风险时显示绿点常态。

## 配色

两套颜色正交，互不干扰：

| 平台 | 主色 | 深色描边 | 品牌图标 |
| --- | --- | --- | --- |
| WorkBuddy（CodeBuddy） | `#6C4DFF` | `#5B3EE8` | 紫色圆角方形双斜条 |
| Trae | `#12B76A` | `#0B8A55` | 黑底绿框双菱形 |
| MiniMax Code | `#00A8F0` | `#0A7DB4` | 蓝色四足小怪兽 |
| Qoder | `#84CC16` | `#4D7C0F` | 白绿官方标志（mintlify 版） |

平台色取自各平台官方 logo 的主色，硬编码不跟皮肤——这样一眼就能分辨"这条是哪家的积分"。Trae 与 Qoder 品牌都是绿色，所以 Trae 取偏冷的 emerald `#12B76A`，Qoder 取偏暖的 lime `#84CC16`，11px 下也能分开。Qoder 用的是官网文档站（qoder.mintlify.app）那张白绿标志，抠掉黑底、保留原始 alpha 后缩到 48×48。

紧迫度色**不跟皮肤**，全部硬编码并把色相拉开：

| 档位 | 色值 | 说明 |
| --- | --- | --- |
| ≤7 天 | `#E5484D` | 红 |
| ≤30 天 | `#F97316` | 橙红 |
| ≤90 天 | `#FACC15` | 亮黄 |
| 90 天以上 | `#94A3B8` | 中性石板灰 |
| 长期有效 | `label-tertiary` | 跟随皮肤 |

90 天以上从绿改成灰，是因为 Trae 和 Qoder 已经占了绿色，紧迫度再绿会和平台色混淆；灰同时也表达"不急"。

档位不是固定的：页面上「临期档位」可切三套（紧 3/7/30 天、标准 7/30/90 天、宽 14/60/180 天），存在 `localStorage` 的 `dsh-credit-expiry:threshold`。切换只影响分档与配色，不影响排序和预测。

图标是 48×48 透明底 PNG 内联成 base64（`ICON` 常量），不发起网络请求，离线也能显示。缺图标时回落成平台色圆点。

## 主题适配

文字、边框、背景、状态色全部走 DSH 设计令牌（`--dsw-alias-label-primary/secondary/tertiary`、`--dsw-alias-border-l1|l2`、`--dsw-alias-bg-layer-1|l2`、`--dsw-alias-brand-primary`、`--dsw-alias-state-error/warn/success-primary`），跟随皮肤自动换色。只有平台身份色与图标是固定的。

## 注册位置

- 底栏行：槽位 `sidebar.footer.action`，id `credit-expiry-mini`，order 2（与 cost-meter 的额度卡片同区）。
- 完整页：槽位 `main`，key `credit-expiry`，`inject` 提供 `surface: 'page'` 与 `backToConversation`。
- 客户端 `inject = ['slots']`；所有注册都包在 `ctx.effect` 里，单点失败只打日志，不影响另一个。

## 与 cost-meter 的关系

侧边栏底部的"费用"卡片由 dsh-cost-meter 绘制，本插件不接管它。各平台积分是通过 cost-meter 的 `config.customBalances` 接入的，现有四条：

| label | request.url | extract.remaining |
| --- | --- | --- |
| 魔搭魔粒 | `https://modelscope.cn/openapi/v1/magicubes/balance` | `data.available_balance` |
| Trae 通用积分 | `/plugins/dsh-connect-trae/usage` | `credits.generalAvailable` |
| MiniMax Code 积分 | `/plugins/dsh-connect-minimaxcode/status` | `credits.total` |
| Qoder 积分 | `/plugins/dsh-connect-qoder/usage` | `credits.total` |

注意 MiniMax 的 `credits.consumed` 是"上次读取后消耗"而非累计值，`maxBudget` 也拿不到历史总额，所以这条只写 `remaining`，不写 `maxBudget` / `spend`。cost-meter 的 `customBalances` schema 没有 `icon` 字段，费用卡里只能靠 label 文字区分。

## 依赖与降级

本插件不 import 任何 `@deepseek-ai/*` 包，只消费两个服务：宿主侧 `webServer`（注册同源路由）与客户端侧 `slots`（挂底栏行和整页）。所以换机器装的时候不会因为 DSH 内部包版本对不上而炸。

四个数据源全部是**可选**的，缺谁少谁，不互相拖累：

| 缺失情况 | 表现 |
| --- | --- |
| 某个 `dsh-connect-*` 没装或没登录 | 该平台不出现在图例、平台卡和到期列表里，`errors` 里记一条 `WorkBuddy: HTTP 404` 这类原因 |
| 四个都没装 | 页面只剩「用量统计」，合计卡为 0，不报错 |
| 没有 cost-meter 账本 | 消耗区块消失，顶部提示「用量统计暂未加载」 |
| 账本路径不在默认位置 | 依次尝试 `$DSH_HOME/storages/cost-meter/ledger.json` 和 `~/.dsh/storages/cost-meter/ledger.json` |
| 请求没带 host 头且拿不到 `webServer.port` | 上游读取报「无法确定 DSH Web 端口」，前端显示错误态，不静默 |

## 兼容性

`engines.dsh = ">=0.2.2-rc.1 <0.3.0-0"`，在 DSH **0.2.2-rc.3** 上实测可用。

这条范围不是随手写的：DSH 当前版本号带预发布标记，semver 的普通范围（`>=0.2.0`、`^0.2.0`）对 `0.2.2-rc.3` **判为不满足**，插件管理器会在下载前直接拒装（`incompatible-version`）。所以下界必须显式写 `-rc`，上界用 `<0.3.0-0` 把整个 0.3 线挡在外面。

如果确实要在别的运行时上强装，走插件管理器的版本豁免：`dsh plugin --profile <p> allow-version dsh-credit-expiry@0.1.0 --dsh-version <运行时版本> --accept-risk`。

## 发布状态

- 仓库：<https://github.com/526365412/dsh-credit-expiry>（MIT）
- Release：<https://github.com/526365412/dsh-credit-expiry/releases/tag/v0.2.0>，附件 `dsh-credit-expiry-0.2.0.tgz` 是预构建包，装它不用跑构建脚本。历史版本 `v0.1.0` 仍可取。
- 更新记录：[`CHANGELOG.md`](./CHANGELOG.md)。页面标题旁的版本号会读市场索引，有新版本时直接提示，不用手动比对。
- 精选列表：已向 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR（条目文件 `data/plugins/526365412__dsh-credit-expiry.yml`，分类 `usage`），合入后 dshmarket 与站点一天内收录。
- npm：**尚未发布**（本机没有 npm 账号）。所以目录里暂时不能走 `npm` 源，安装用下面的 Release 包或整仓源码。

## 检查更新

页面标题右边显示当前版本；宿主侧有一个 `GET /credit-expiry/api/update` 端点，读本插件的市场索引，比对 `package.json` 里的版本，6 小时缓存一次，手动点「检查」会带 `?force=1` 跳过缓存。

```json
{ "current": "0.2.0", "latest": "0.2.0", "hasUpdate": false,
  "publishedAt": 1794831375000, "commit": "04d0ea6", "checkedAt": 1794833133922,
  "source": "https://raw.githubusercontent.com/...", "url": "https://github.com/526365412/dsh-credit-expiry/releases", "error": null }
```

- 索引源顺序是 raw.githubusercontent 在前、jsDelivr 在后：jsDelivr 推完要缓存一天，优先它会让刚更新过的机器看到旧版本。
- 强制重查会给索引 URL 追加 `?t=<时间戳>`：raw 也有分钟级缓存，不绕过的话刚发布的版本查不到。
- 两个都拿不到时返回 `latest: null` 和 `error`，界面只显示「无法检查更新」，不影响面板本身。升级还是照常走 Release 包或索引。

## 自建索引

仓库根目录的 `index.json` 是插件市场索引（format 1），把这一条加进「插件 → 发现 → 索引源」就能在自己的市场里看到本插件：

```
https://cdn.jsdelivr.net/gh/526365412/dsh-credit-expiry@main/index.json
```

备用地址（jsDelivr 不通时用）：`https://raw.githubusercontent.com/526365412/dsh-credit-expiry/main/index.json`。

- 索引由 `scripts/build-index.mjs` 生成，不要手改：它从 `package.json` 取版本号、从最近一次改动 `lib/` 或 `package.json` 的提交取 commit 与时间戳，把 `docs/icon.png` 内嵌成 `data:` 图标（<32 KiB），版本源写成 `git + 精确 commit`，装的时候不依赖 npm。
- 改了代码就重新生成并提交：`npm run build:index`；CI 或本地校验用 `npm run check:index`（索引与当前代码不一致时退出码 1）。
- 本机已经把它写进 `cordis.patch.yml` 的 `plugin-market.config.indexes`，和官方目录、awesome-dsh-plugin 并列。

## 安装

**从 Release 预构建包安装（推荐）**

```sh
dsh plugin --profile desktop add https://github.com/526365412/dsh-credit-expiry/releases/download/v0.2.0/dsh-credit-expiry-0.2.0.tgz
```

**从自建索引安装**

索引源加好后，在「插件 → 发现」里搜「积分到期」直接装，等价于：

```sh
dsh plugin --profile desktop add "git+https://github.com/526365412/dsh-credit-expiry.git#<commit>"
```

**从源码安装**

```sh
dsh plugin --profile desktop add github:526365412/dsh-credit-expiry
```

本插件没有构建步骤（`lib/` 就是产物），源码安装不会触发 pnpm 的构建脚本授权。

**本地开发**

1. 把本目录 junction 链接到 `<profile>/node_modules/dsh-credit-expiry`。
2. `<profile>/package.json` 的 `dependencies` 用 `link:` 指向本目录，`dsh.profile.bundles` 登记包名。
3. 宿主半改动需重启 DSH；只改客户端 bundle 按侧边栏刷新即可。

## 说明

到期时间直接用上游返回的毫秒时间戳，按自然日归并（同一天不同时刻到期的多个包算一个到期日），不在插件里推算。MiniMax 只有 `upcoming` 一个汇总额度，因此显示为单条。
