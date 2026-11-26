# 项目状态 · dsh-credit-expiry（积分到期面板）

> 最后更新：2026-11-26，版本 v0.16.3。
> 这是给「接手的我」看的交接文档。换新会话后说一句「读一下 dsh-credit-expiry 的 PROJECT_STATE.md」就能接上，不用重讲历史。

## 一句话

DSH 侧边栏里的一块积分看板插件。盯 WorkBuddy、Trae、MiniMax Code、Qoder 四个积分池的余额和最近到期日，按最近花法估算「哪些积分会用不完、值多少钱、先去用哪家」。豆包的套餐/赠送额度、Codex、魔搭魔粒以及 10 家开放平台 / 云厂商 API 余额也一并展示。

## 三个位置

- **代码仓库（本机）**：`D:\Harness\工作区\DSH积分插件`；`C:/Users/user/.dsh/local-plugins/dsh-credit-expiry` 是指向它的 junction
- **远端**：`https://github.com/526365412/dsh-credit-expiry.git`（GitHub Release 发预构建包 + npm 包 `dsh-credit-expiry`）
- **注意区分**：插件市场（`awesome-dsh-plugin` / `dsh-plugin-catalog`）从 npm 同步版本；npm 若未绑定 Trusted Publisher 或 `NPM_TOKEN` 停留在旧版时，市场也会同步停在旧版，自建索引 `index.json` 则直指 Git 提交。

## 现状（截至 v0.16.3）

- 分支 `main`，版本 `v0.16.3`（输入栏行内提示新增悬停/聚焦速览小窗；无边框对齐 DSH 工具栏 `28px` 扁平原生风格；输入栏并入 `conversation.input.right`、新功能独立开关面板、未接入平台带平滑动效折叠抽屉、积分账本超过 8 行可折叠、消纳时间线与 `foresee()` 同源 FIFO 分池/连续事件模拟、DSH 密钥同步开关与防删除复写、未装插件 404 降噪、账本 `raw.costCny` / `hy4free` / 未返积分与免费噪声过滤校准）。
- 已发布：0.6.0 → 0.13.0 → 0.14.0 → 0.15.0 → 0.15.1 → 0.16.0 → 0.16.1 → 0.16.2 → 0.16.3。
- 核心功能：到期预测、消耗速度、周期额度、豆包额度、Codex、魔搭魔粒、按平台 / 按到期日、积分账本、到期日历（含豆包赠送图层）、窗口化积分消耗图（7/14/30 天）、模型用量、积分会话、10 家 API / 云厂商余额与密钥双向同步、其他账号凭据；设置页支持区块开关、增强功能开关、平台开关与拖拽排序、中英语言、临期档位、界面密度、导出导入设置、IM 自动提醒。
- **0.9.0 界面分区**：区块分总览 / 订阅与额度 / 余额与到期 / 用量与消耗 / 账号与密钥页签，页签吸顶、当前分区存 localStorage（键 dsh-credit-expiry:tab，独立于 PREFS）；SECTION_META 每项带 group 字段；豆包块内分「订阅额度 · 到点补满」「赠送额度 · 到期作废」两组。守卫测试在 balance-order.test.mjs。
- **0.9.1 白屏修复**：`ThresholdPicker` 含 useState，绝不能当普通函数调用，必须 `h(ThresholdPicker, props)` 作为元素渲染——否则 hook 挂到 PanelView，切分区 hook 数突变崩白屏。CreditLedger / SessionList / ProviderList / ExpiryCalendar / DegradedBadge / SettingsEntry / PlatformOrderEditor / ExpiryTimeline / SubscriptionOverview / KeyManager 也都各自带 useState，一律走 `h(...)` 元素渲染。
- 测试：**102 项全绿**（10 个测试文件，package.json 显式清单）。
- `.github/workflows/ci.yml` 与 `.github/workflows/publish.yml` 已被 git 跟踪，CI 在 node 20/22 上跑 `npm test` + `check:index`。
- 详细逐版本记录看 `CHANGELOG.md`，安装说明看 `README.md`。

## 代码结构（改之前先看这里）

- `lib/index.js` — 宿主端。路由（含 `/data`、`/update`、`/keys`、`/notify`、`/export`）、数据聚合、`syncKeysWithDsh`、价格抓取、`/data` 里 `normalizeDoubao(status)` 把豆包额度归一化。**豆包不进计价分摊**：PROVIDER_POOL / CREDIT_PROVIDERS / poolCost / poolWeight / collectMultipliers 全部别动，硬塞会污染积分的钱数计算。
- `lib/client.js` — 客户端 UI（单文件）。关键符号：`collect()`（摊平各平台为 items）、`PLATFORM_ORDER`（算钱/消耗/订阅口径，四家）、`BALANCE_ORDER`（余额/账本/日历展示口径，含 db 五家）、`ICON`（品牌图标表）、`PlatformIcon`、`DoubaoQuota` 组件、`SECTION_META`、`LOCALE.en`。
- `test/*.mjs` — 10 个测试文件，package.json 里是**显式文件清单**（加新测试文件要手动加进 scripts.test）。`balance-order.test.mjs` 守豆包两条口径与 hook 面，`i18n.test.mjs` 守中英文词条完整，`ui-filters.test.mjs` 守统计口径 + 筛选组件渲染方式 + 宽窗口取数，`v014-regressions.test.mjs` 守 v0.14+ 回归。

## 关键口径与坑（血泪，别再踩）

1. **豆包四种窗口**：套餐积分（package，标准套餐的订阅余额，0.9.0 前被漏读）+ 5 小时 / 每周额度 = 到点补满；活动赠送（incentive）= 约一个月作废，进合计/账本/日历/临期提醒（展示口径 BALANCE_ORDER 含 db）。官方对 incentive 传 `instantKind:"expire"`。
2. **版本号改动必须 touch**：版本号字符串等长（如 0.7.1→0.7.2、0.8.1→0.8.2）时 git 的 stat 缓存会误判「没改」，`git status` 报干净导致漏提交。改完 package.json / README / CHANGELOG 后先 `touch` 再 `git add`，并核对 disk hash == index hash。
3. **index.json 不要手改**：用 `npm run build:index` 自动生成（version / commit / publishTimestamp）。手改会不自洽（version 与 package.json 对不上会直接红 index-json 测试）。
4. **图标表漏项会静默退化成圆点**：`ICON` 没有某平台时 `PlatformIcon` 走兜底画纯色点，不报错。新增平台必须登记品牌图标（当前 `ICON` 键：wb/tr/mm/qd/db）。
5. **i18n 守卫**：所有含中文的 `t()` 键必须有英文词条、不能有裸中文、不能有死词条。加中文文案记得补 `LOCALE.en`。
6. **本机加载方式**：本机装的是 local-plugins 软链，在 GUI 里点「安装 / 更新」会 `pnpm add` 失败。改完代码**直接刷新页面**即可生效，不用走安装。

## 发版流程（照抄，已多次验证）

```sh
# 在仓库根目录，作者身份固定
git -c user.name=526365412 -c user.email=526365412@users.noreply.github.com ...

# 1) 改代码 → 改 CHANGELOG / README / package.json（等长版本号先 touch 再 add）→ commit
# 2) 自动生成索引并提交
npm run build:index
# 3) 打 tag（指向索引提交）
git tag -f vX.Y.Z
# 4) 打包 + 推送 + 建 Release（gh 在 C:/Program Files/GitHub CLI/gh.exe）
npm pack --silent
git push origin main && git push origin vX.Y.Z
gh release create vX.Y.Z dsh-credit-expiry-X.Y.Z.tgz --title "vX.Y.Z" --notes "..."
# 5) 核实：raw.githubusercontent 的 index.json、Release 附件、/update?force=1 返回值
```

## 测试与校验

- `npm test` — 全套 84 项。
- `npm run check:index` — 索引一致性（应退 0）。
- 改动涉及豆包口径时，重点跑 `balance-order.test.mjs`（展示/算钱口径）与 `api.test.mjs`（豆包额度归一化）。

## 待办 / 未决

- **npm 线上仍是 0.3.1**：发 npm 要本人输 OTP、GitHub Actions 要 workflow 权限，都需用户本人做。不影响 GitHub Release 链接安装（推荐安装方式）。
- **jsDelivr CDN 可能滞后**：release 后一段时间 CDN 仍缓存旧 index.json（曾停在 0.7.2），属正常，raw.githubusercontent 为准。
- **豆包图标形状**：当前模型不支持图像输入，图标做得对不对需用户眼睛过一遍（预览图曾交付在 `D:/Harness/积分到期面板/豆包图标预览.png`）。
- **豆包主题色**：保留了珊瑚红 #F04438，没跟官方浅蓝走（理由：会跟 MiniMax 青、WorkBuddy 靛挤在蓝色区）；已问用户是否要改，待答复。

## 用户偏好

- 纯小白，**说人话**：先给结论和能做的事，术语要解释，别堆技术黑话。
- 交付物放 `D:/桌面`，按项目建文件夹分类，桌面根目录不堆散件；临时文件用 `.tmp` 前缀，完事清理。
- 关键决定补一句「记住这个」会存进 OpenViking 长期记忆。
