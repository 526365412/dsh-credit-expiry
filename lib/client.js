window.__ModuleLoader__.load({
  id: 'dsh-credit-expiry',
  factory: function (require) {
    'use strict';
    var React = require('react');
    var h = React.createElement;

    /* Ask for a wider slice than the panel shows so the session and model
       filters search a real window, not the first page of it. The host clamps
       both numbers. */
    var API = '/credit-expiry/api/data?prov=120&sess=80';
    var UPDATE_API = '/credit-expiry/api/update';
    var EXPORT_API = '/credit-expiry/api/export';
    var KEYS_API = '/credit-expiry/api/keys';
    var NOTIFY_API = '/credit-expiry/api/notify';
    var PANEL_ID = 'credit-expiry';
    var PANEL_ROOT_ID = 'cxe-panel-root';
    var REFRESH_MS = 120000;
    var BUCKET_LIMIT = 8;

    /* Design tokens. The first name is what the host theme actually defines;
       the literal is only a fallback for a theme that predates it. */
    var C = {
      text: 'var(--dsw-alias-label-primary,#1c1c1e)',
      dim: 'var(--dsw-alias-label-secondary,#5c5c60)',
      /* 三级灰在 10–11px 上只有 3.5:1，小字读不清；小字一律用二级灰，
         三级灰只留着给真正可省略的辅助信息（此时它已和二级灰同色）。 */
      faint: 'var(--dsw-alias-label-secondary,#5c5c60)',
      line: 'var(--dsw-alias-border-l2,rgba(0,0,0,0.09))',
      soft: 'var(--dsw-alias-bg-layer-2,rgba(0,0,0,0.04))',
      bg: 'var(--dsw-alias-bg-layer-1,#17181b)',
      hover: 'var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,0.06))',
      accent: 'var(--dsw-alias-brand-primary,#d97757)',
      red: 'var(--dsw-alias-state-error-primary,#e5484d)',
      orange: 'var(--dsw-alias-state-warn-primary,#f5a524)',
      green: 'var(--dsw-alias-state-success-primary,#2f9e5e)',
      blue: 'var(--dsw-alias-state-business-primary,#3b82f6)',
      yellow: '#d4a017'
    };

    /* 字号 / 间距 / 圆角三套刻度：新写的界面只从这三张表取数，别再逐个手填 px。 */
    var FS = { xxs: 10, xs: 11, sm: 12, base: 13, md: 15, lg: 20, xl: 30 };
    var SP = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 };
    var R = { sm: 6, md: 8, lg: 10, xl: 12, pill: 999 };

    /* Text comes from the call sites, so a missing key falls back to the
       Chinese literal itself rather than an empty string. Only the two languages
       this tool is actually used in are carried; anything else stays Chinese. */
    var LOCALE = { zh: null, en: {
       "其他": "Other",
       "紧": "Tight",
       "标准": "Standard",
       "宽": "Loose",
       "已过期": "Expired",
       "今天到期": "Expires today",
       " 天内": " days",
       " 天以上": " days+",
       "长期有效": "No expiry",
       "1 分钟": "1 min",
       "2 分钟": "2 min",
       "5 分钟": "5 min",
       "10 分钟": "10 min",
       "长期": "Long-term",
       "今天": "Today",
       " 天": " days",
       "积分包": "Credit pack",
       "积分账户": "Credit account",
       "MiniMax 积分 ": "MiniMax credits ",
       "MiniMax 积分": "MiniMax credits",
       "Qoder 积分": "Qoder credits",
       "0 · 15天": "0 · 15 days",
       "已过重置日": "Reset date passed",
       "今天重置": "Resets today",
       " 天后重置": " days until reset",
       "刷新": "Refresh",
       "免费模型": "Free models",
       "无公开价": "No public price",
       "智谱": "Zhipu",
       "目录（models.dev）": "Catalog (models.dev)",
       "金额按各模型官方 token 单价估算（含缓存命中价）。": "Amounts are estimated from each model's official per-token price, cache-hit price included.",
       "官网实时": "Live from vendor pages",
       "上次成功抓取": "Last successful fetch",
       "内置快照": "Bundled snapshot",
       "官方价目 · ": "Official price list · ",
       "缓存价目（": "Cached price list (",
       "内置价目（尚未联网抓取）": "Bundled price list (never fetched online)",
       " · 抓取于 ": " · fetched at ",
       " 分/元": " pts",
       " 积分按各平台自己的消耗数分摊到模型（": " credits are prorated to models using each platform's own usage counts (",
       " 未返回消耗数，该平台的积分分摊与金额换算不可用，只统计 token。": " returned no usage counts, so credit proration and money conversion are unavailable for it; only tokens are counted.",
       "官方价目": "Official price list",
       " 其余模型取自 ": " · other models from ",
       " 条，": " rows, ",
       "本次联网抓到": " fetched live this run",
       "上次抓取留存": " retained from the last fetch",
       "，美元价按 1 USD = ": ", USD prices converted at 1 USD = ",
       " CNY 换算": " CNY",
       "（内置汇率，未取到实时报价）": " (bundled rate; no live quote available)",
       "金额按各模型官方 token 单价估算（分输入、缓存命中、输出三档），": "Amounts are estimated from each model's official per-token price (input, cache hit and output tiers), ",
       "没有公开价的模型（": "models with no public price (",
       "）只计 token，不计金额。": ") count tokens only, not money.",
       "无公开价多见于平台内部模型别名（例如 Qoder 的 dfmodel / qmodel_latest）：调用真实存在，只是公开价目表查不到对应单价，不是识别错误。": "No public price is common for a platform's internal model aliases (e.g. Qoder's dfmodel / qmodel_latest): the calls really happened, only the public price list has no matching unit price - not a recognition error.",
       "WorkBuddy 其他账号": "Other WorkBuddy accounts",
       " 个 · 共 ": " accounts · ",
       " 积分": " credits",
       "未命名账号": "Unnamed account",
       "登录": "Sign-in",
       "访问令牌": "Access token",
       "刷新令牌": "Refresh token",
       "登录凭据快到期：": "Sign-in credentials expire soon: ",
       "。过期后这一栏会整片读取失败。": ". Once it expires this whole section fails to read.",
       " · 有新版本 v": " · new version v",
       "，去 Releases 看看": " available — check Releases",
       " · 已是最新": " · up to date",
       " · 无法检查更新": " · cannot check for updates",
       " · 检查中": " · checking",
       "重新检查更新": "Check again",
       "检查": "Check",
       "峰谷用量": "Peak / off-peak usage",
       "高峰 ": "Peak ",
       "% · 空闲 ": "% · off-peak ",
       "空闲 ": "Off-peak ",
       "高峰 = 北京时间工作日 ": "Peak = Beijing working days ",
       "（法定节假日除外的全天空闲），DeepSeek 高峰价是空闲价的 2 倍；智谱与 MiniMax 不分峰谷。": " (all-day off-peak on public holidays). DeepSeek peak costs 2x off-peak; Zhipu and MiniMax have no peak pricing.",
       "积分到期 · 点击查看完整面板": "Credits expiring · click to open the full panel",
       "积分到期": "Credits expiring",
       "读取失败": "Read failed",
       "读取中…": "Loading…",
       " 积分会在用掉前过期": " credits will expire before they are spent",
       "暂无临期积分": "Nothing expiring soon",
       "返回会话": "Back to session",
       "WorkBuddy、Trae、MiniMax 与 Qoder 的积分余额、到期节奏与消耗": "Credit balances, expiry schedule and consumption for WorkBuddy, Trae, MiniMax and Qoder",
       "更新于 ": "Updated ",
       "显示设置": "Display settings",
       "本次读取失败，显示上次成功的数据": "This read failed; showing the last successful data",
       " 未读到": " not read",
       "剩余积分合计": "Total remaining credits",
       " 积分 · ": " credits · ",
       "付费模型": "Paid models",
       " 天内没有到期积分": " days with no credit expiry",
       " 天内有 ": " days: ",
       " 个到期日，共 ": " expiry dates, ",
       "优先消耗": "Spending first",
       "还没有足够的历史来计算消耗速度（需要至少一天的用量记录）": "Not enough history to estimate the burn rate yet (needs at least one day of usage).",
       " 余额 ": " balance ",
       " · 每天花 ": " · spends ",
       " · 最近 7 天没用过，无法估算": " · no usage in the last 7 days, cannot estimate",
       " · 约 ": " · about ",
       " 天后用光": " days left",
       " · 每天 ": " · per day ",
       "无消耗记录": "No usage recorded",
       "90 天以上": "90+ days",
       "额度 ": "Quota ",
       " 到期": " expires",
       "积分随订阅到期作废": "Credits disappear when the subscription ends",
       "还没有配置 API 密钥。在设置里加一个，就能在这里看到对应的账户余额。": "No API keys yet. Add one in settings to see the matching account balance here.",
       "赠送 ": "Granted ",
       "充值 ": "Topped up ",
       "已用 ": "Used ",
       "不可用（余额为零或被冻结）": "Unavailable (zero or frozen)",
       "先填密钥": "Enter a key first",
       "保存失败": "Save failed",
       "已保存": "Saved",
       "删除": "Delete",
       "备注（可空）": "Label (optional)",
       "粘贴 API 密钥": "Paste an API key",
       "添加": "Add",
       "密钥写在本机 ": "Keys are stored locally at ",
       "storages/credit-expiry/keys.json（权限 600），不会被页面读回，也不会进仓库。": "storages/credit-expiry/keys.json (mode 600). The page never reads them back and they never enter the repo.",
       "已保存推送地址": "Webhook saved",
       "已清除推送地址": "Webhook cleared",
       "推送中…": "Sending…",
       "已推送到 ": "Sent to ",
       "推送失败": "Send failed",
       "企业微信": "WeCom",
       "钉钉": "DingTalk",
       "飞书": "Feishu",
       "已配置（重新填写可替换，留空并保存可清除）": "Configured (fill in again to replace, save empty to clear)",
       "粘贴群机器人 Webhook 地址（https://…）": "Paste the group bot webhook URL (https://…)",
       "保存": "Save",
       "推送一条": "Send one",
       "当前已配置：": "Currently configured: ",
       "自定义": "Custom",
       " 机器人": " bot",
       "支持企业微信 / 钉钉 / 飞书群机器人与 Slack Incoming Webhook，按域名自动识别格式。": "Supports WeCom, DingTalk and Feishu group bots plus Slack incoming webhooks; the format is picked by domain.",
       "按近 7 天的消耗速度，没有积分会烂在到期日上": "At the last 7 days' burn rate, nothing is wasted on its expiry date",
       "按当前速度，": "At the current rate, ",
       " 到期（": " expires (",
       "还剩 ": "Remaining ",
       "每天 ": "Daily ",
       " · 到期前只能花 ": " · can only be spent before ",
       "浪费 ": "Wasted ",
       "另有 ": "Another ",
       " 个积分包同样会在到期前用不完": " credit packs will also go unspent before expiry",
       "消耗速度取各平台自己的积分口径、近 7 天日均；同一平台内按余额比例分摊到各积分包。": "Burn rate uses each platform's own credit unit and its 7-day average; within a platform it is prorated to packs by balance share.",
       "建议先用 ": "Spend first: ",
       " 的「": " — “",
       "（约 ¥": " (about ¥",
       " 会作废）": " will expire)",
       "暂无积分包": "No credit packs",
       "平台 / 积分包": "Platform / pack",
       "剩余（积分）": "Remaining (credits)",
       "总量": "Total",
       "已用": "Used",
       "到期日": "Expires",
       "剩余天数": "Days left",
       " 年 ": "/",
       " 月": "",
       "本月到期 ": "Expiring this month: ",
       "本月无到期": "Nothing expires this month",
       "一": "Mon",
       "二": "Tue",
       "三": "Wed",
       "四": "Thu",
       "五": "Fri",
       "六": "Sat",
       "日": "Sun",
       " 积分到期": " credits expiring",
       " · 无到期": " · none expiring",
       "没有带有效期的积分": "No credits with an expiry date",
       " 项": " items",
       " 项 · ": " items · ",
       "积分": "Credits",
      "未读到额度": "no quota read",
       " 次 · ": " calls · ",
       " · 命中 ": " · cache hit ",
       "暂无积分消耗": "No credit usage yet",
       " 个模型未列出": " models not listed",
       "暂无积分会话": "No credit sessions yet",
       "会话": "Session",
       "有积分会在用掉前过期": "Credits will expire before being spent",
       " 积分按当前速度用不完 · ": " credits will go unspent at this rate · ",
       "到期提醒已开启": "Expiry alerts on",
       "系统通知被浏览器拒绝": "Browser notifications blocked",
       "此环境不支持系统通知": "Notifications unsupported here",
       "开启到期提醒": "Enable expiry alerts",
       "积分到期 · ": "Credits expiring · ",
       "合计": "Total",
       "合计 ": "Total ",
       " 积分 ≈¥": " credits ≈¥",
       " 到期 ": " expires ",
       "已复制": "Copied",
       "把整页摘要复制成文本": "Copy the whole page as text",
       "复制失败": "Copy failed",
       "复制摘要": "Copy summary",
       "把本次读到的数据下载成文件": "Download this read as a file",
       "临期档位": "Expiry thresholds",
       "到期预测": "Expiry forecast",
       "按当前消耗速度推算哪些积分会用不完": "Which credits will go unspent at the current burn rate",
       "消耗速度 / 可用天数": "Burn rate / days left",
       "每个平台的余额还够用几天": "How many days each platform's balance lasts",
       "周期额度与重置日": "Cycle quotas and reset dates",
       "按月发放、会刷新的额度及其重置时间": "Monthly quotas that refresh, and when they reset",
       "按平台": "By platform",
       "每个平台的余额、构成与最近到期": "Balance, composition and next expiry per platform",
       "按到期日": "By expiry date",
       "把同一天到期的积分并成一行": "Groups credits expiring the same day into one row",
       "积分账本": "Credit ledger",
       "每个积分包的剩余 / 总量 / 已用 / 到期": "Remaining / total / used / expiry for each credit pack",
       "到期日历": "Expiry calendar",
       "按月看每天有多少积分到期": "How many credits expire each day, by month",
       "日柱图、峰谷占比与模型用量": "Daily bars, peak share and model usage",
       "模型用量": "Model usage",
       "每个模型的 token、命中率与金额": "Tokens, cache-hit rate and money per model",
       "积分会话": "Credit sessions",
       "最近用过积分的会话": "Sessions that spent credits recently",
       "API 密钥余额": "API key balances",
       "用自己 API 密钥读到的现金余额（密钥只存在本机）": "Cash balances read with your own API keys (keys stay on this machine)",
       "其他账号与凭据": "Other accounts and credentials",
       "WorkBuddy 其他账号、登录凭据倒计时": "Other WorkBuddy accounts, credential countdown",
       "余额合计": "Total balance",
       "会用不完的积分": "Credits that will go unspent",
       "各平台的分项余额": "Per-platform balances",
       "最近的到期行": "Next expiring rows",
       "返回积分面板": "Back to the credits panel",
       "只影响这台机器上的这一套面板，改动立刻生效并存进浏览器本地。": "Affects only this panel on this machine; changes apply immediately and are stored in the browser.",
       "页面区块": "Page sections",
       " 个已显示": " shown",
       "侧栏卡片": "Sidebar card",
      "侧栏版式": "Sidebar layout",
      "三种版式用同一份数据，只是排法不同；下面每项都能单独关掉": "All three read the same model; every block below can be turned off",
      "焦点": "Focus",
      "清单": "List",
      "网格": "Grid",
      "近 7 天走势线": "7-day trend line",
      "底部「打开面板」入口": "Open-panel entry",
       "不打开页面时能看到的全部信息": "Everything you see without opening the page",
       "侧栏显示几行近期到期": "Expiring rows in the sidebar",
       "0 = 只看合计": "0 = total only",
       "刷新频率": "Refresh interval",
       "每次刷新要打一次上游": "Each refresh hits the upstream once",
       "面板开着时的轮询间隔": "Polling interval while the panel is open",
       "标签页在后台时不轮询；读取失败会按间隔翻倍退避，最长 10 分钟。": "No polling while the tab is in the background; failures back off by doubling, up to 10 minutes.",
       "密钥只存本机，不写仓库": "Keys stay on this machine, never in the repo",
       "IM 推送": "IM push",
       "把摘要推到群里": "Push the summary to a group chat",
       "决定多少天算「快到期」": "How many days counts as “expiring soon”",
       "颜色分档": "Color tiers",
       "紧 3/7/30 · 标准 7/30/90 · 宽 14/60/180 天": "Tight 3/7/30 · Standard 7/30/90 · Loose 14/60/180 days",
       "恢复默认": "Reset to defaults",
      "，": ", ",
      "。": ".",
      "；": "; ",
      "：": ": ",
      "）。": ").",
      "9:00-12:00、14:00-18:00": "9:00-12:00, 14:00-18:00",
      "）": ")",
      "（": " (",
      "「": "“",
      "」": "”",
      "、": ", ",
      "语言": "Language",
      "界面文案": "Interface text",
      "显示语言": "Display language",
      "切换后整页立即重绘，设置存在本机。": "The whole page repaints on switch; the choice is stored on this machine.",
       "看效果": "Preview",
       "设置存在浏览器的 localStorage 里（键 ": "Settings live in the browser's localStorage (key ",
       "），不上传、不写磁盘。换浏览器或清缓存后会回到默认。": "), never uploaded or written to disk. A different browser or a cleared cache returns to defaults.",
       "读取失败：": "Read failed: ",
       "（下面是上次成功读取的数据）": " (showing the last successful read)",
       "有平台没读上来：": "Some platforms failed: ",
       "。下面的合计不含它们，不等于它们已经花光。": ". The totals below exclude them — that is not the same as them being spent.",
       "消耗速度 · 还能用几天": "Burn rate · days left",
       "收起": "Collapse",
       "展开全部 ": "Show all ",
       " 个到期日": " expiry dates",
       " 个积分包": " credit packs",
       "上个月": "Prev month",
       "下个月": "Next month",
       "用量统计暂未加载：宿主半改动需要重启一次 DSH 才会生效。": "Usage stats not loaded yet: host-side changes need a DSH restart to take effect.",
       "共 ": "Total ",
       " 条": " rows",
       "现金余额，不会过期，和上面的积分分开算": "Cash balance, no expiry, counted separately from credits above",
       "积分余额与到期来自 WorkBuddy / Trae / MiniMax / Qoder 账号接口；消耗来自本机 cost-meter 账本，只统计这四个积分池。": "Balances and expiries come from the WorkBuddy / Trae / MiniMax / Qoder account APIs; usage comes from the local cost-meter ledger and only covers these four credit pools.",
       "余额靠本机装的对应平台连接插件读取：没装或没登录的那家不显示，不影响其他家。Codex 额度靠 codex-subscription 插件，魔搭魔粒靠本机 DSH 凭据里的 MODELSCOPE_API_KEY 实时读取、不落盘。": "Balances are read from the platform connector plugins installed on this machine: a platform without its plugin or login is simply hidden and does not affect the others. Codex quota needs the codex-subscription plugin; ModelScope magicubes are read live from the MODELSCOPE_API_KEY in this machine's DSH credentials and are never written to disk.",
       "Qoder 积分本身不带到期日，这里用的是套餐到期时间（套餐失效后余额一并消失）。": "Qoder credits carry no expiry date; this uses the plan's expiry (the balance disappears with the plan).",
        "把当前设置存成 JSON 文件": "Save the current settings as a JSON file",
        "导出设置": "Export settings",
        "从 JSON 文件恢复设置": "Restore settings from a JSON file",
        "导入设置": "Import settings",
        "豆包": "Doubao",
        "豆包额度 · 赠送会过期，订阅会刷新": "Doubao quota: bonus grants expire, subscription quota refreshes",
        "豆包额度": "Doubao quota",
        "赠送额度到期作废，订阅额度到点刷新；重置日由平台估算": "Bonus grants expire, subscription quota refreshes on schedule; reset dates are estimated by the platform",
        "从首次使用起算": "Counted from first use",
        " 小时后刷新": "h until refresh",
        " 天后刷新": " days until refresh",
        " 小时后过期": "h until expiry",
        " 天后过期": " days until expiry",
        "活动赠送": "Bonus grant",
        "已用完": "Used up",
        "豆包额度暂未读上来": "Doubao quota not loaded yet",
        "套餐积分": "Package credits",
        "订阅额度 · 到点补满": "Subscription quota - refills on schedule",
        "赠送额度 · 到期作废": "Bonus grants - expire if unused",
        "总览": "Overview",
        "余额与到期": "Balances & expiry",
        "用量与消耗": "Usage & burn",
        "账号与密钥": "Accounts & keys",
        "余额有多少、什么时候过期、先用哪家": "How much is left, when it expires, which to use first",
        "每个积分包的明细、按天和按月看到期": "Every credit pack in detail, expiry by day and by month",
        "花得多快、花在哪些模型和会话上": "How fast credits are spent, on which models and sessions",
        "其他账号、登录凭据与现金余额": "Other accounts, login credentials and cash balances",
        "暂无消耗数据": "No spend data yet",
        "指标": "Metric",
        "调用次数": "Calls",
        "图表": "Chart",
        "柱状图": "Bar",
        "折线图": "Line",
        "饼图": "Pie",
        "时间范围": "Period",
        "近 7 天": "Last 7 days",
        "近 14 天": "Last 14 days",
        "近 30 天": "Last 30 days",
        "侧栏显示平台": "Platforms in sidebar",
        "关掉的平台不出现在侧栏合计与图标行": "Hidden platforms are excluded from sidebar total and icons",
        "魔搭": "ModelScope",
        "额度": "Quota",
        "约 ": "about ",
        "没有读到 GPT / Codex 额度。需要装 codex-subscription 插件，并用 ChatGPT 账号登录 Codex 订阅后刷新。": "GPT / Codex quota not loaded. Install the codex-subscription plugin, sign in to Codex with your ChatGPT account, then refresh.",
        "暂无限速窗口数据": "No rate-limit window data yet",
        "积分余额": "Credit balance",
        "到期 ": "expires ",
        "没有读到魔搭魔粒余额。需要在 DSH 凭据里配置 MODELSCOPE_API_KEY（不是本面板设置页）。": "ModelScope magicube balance not loaded. Set MODELSCOPE_API_KEY in the DSH credentials store (not in this panel's settings).",
        "今日可用魔粒": "Magicubes available today",
        "魔粒每天重置，不是可以攒的资产。": "Magicubes reset daily - they are not a balance you can save.",
        "ChatGPT 订阅的限速窗口与积分": "ChatGPT subscription rate-limit windows and credits",
        "魔搭魔粒": "ModelScope magicubes",
        "今天还能用多少魔粒，每天重置": "How many magicubes are left today; resets daily",
        "GPT / Codex 额度": "GPT / Codex quota",
        "风险": "Risk",
        "节奏": "Pace",
        "要先处理": "Deal with first",
        "按近 7 天的消耗速度推算": "projected from the last 7 days' burn rate",
        "订阅与额度": "Subscriptions & quotas",
        "额度与订阅": "Quotas & subscriptions",
        "只看要处理的 · 明细在「订阅与额度」": "Only what needs action - details live in Subscriptions & quotas",
        "没有读到任何平台的额度信息": "No quota info loaded for any platform",
        " 个平台要处理，其余在「订阅与额度」里": " platform(s) need action; the rest live in Subscriptions & quotas",
        " 个平台的套餐与刷新日都还宽裕": " platforms are well inside their plan and reset dates",
        "高峰价是空闲价的 2 倍": "peak price is 2x the off-peak price",
        " 个模型": " models",
        " 家": " pools",
        "最多的一天 ": "busiest day ",
        " 天有到期": " days have expiries",
        "按月翻，看哪天到期最多": "page by month to find the heaviest expiry day",
        "底色深浅 = 当天金额，色相 = 离现在多远": "shade = amount that day, hue = how near",
        "今": "today",
        "显示": "Display",
        "数据": "Data",
        "集成": "Integrations",
        "其它": "Other",
        "全部开启": "turn all on",
        "全部关闭": "turn all off",
        "各平台的订阅套餐与到期 / 刷新一览，一眼看出哪个要处理": "Every platform's subscription plan and expiry/reset at a glance - see which one needs attention",
        "没有读取到订阅信息": "No subscription info loaded",
        "套餐：": "Plan: ",
        "订阅套餐": "Subscription plan",
        "每天重置": "Resets daily",
        "按月刷新": "Refills monthly",
        "未订阅": "Not subscribed",
        "快到期": "Expiring soon",
        "需刷新": "Reset soon",
        "额度构成：这些额度的余额怎么来的，和积分不是一回事": "How these quota balances are made up - not the same thing as credits",
        " 天后到期": " days until expiry",
        "其他模型": "other models",
        " · 含 ": " · includes ",
        " 个模型": " models",
        " · 数据覆盖 ": " · covers ",
        "（窗口内不足的天数没有数据）": " (days beyond the window carry no data)",
        "近 7 天消耗": "last 7 days spend",
        " 天后作废": " days until expiry",
      " 积分，已用 ": " credits, used ",
      "全部 ": "of ",
      " 个平台里最急": " pools, the soonest",
      "打开面板": "open panel",
      "7 天内": "within 7 days",
      "30 天内": "within 30 days",
      " 天": " days",
        "近 7 天用了 ": "last 7 days: ",
        "最近到期 ": "next expiry ",
        "全部平台": "all platforms",
        "全部状态": "all states",
        "30 天内到期": "expiring within 30 days",
        "即将作废": "about to lapse",
        "7 天内到期": "expiring within 7 days",
        "安全": "safe",
        "30 天以上或长期": "over 30 days or long-lived",
        "按到期": "by expiry",
        "按剩余": "by remaining",
        "按已用": "by used",
        "显示 ": "showing ",
        "没有匹配的积分包": "no matching credit pack",
        "只影响这张日历，侧栏余额不受影响": "affects this calendar only, not the sidebar balances",
        "按模型名筛选": "filter by model name",
        "归并家族": "merge families",
        "把同一家的模型合成一行": "collapse one vendor family into one row",
        "，只读到前 ": ", read only the first ",
        " 个": " items",
        "没有匹配的模型": "no matching model",
        " 个匹配未列出": " matching models not listed",
        "给这个会话打个标签（留空清除）": "label this session (leave empty to clear)",
        "按会话标题筛选": "filter by session title",
        "全部": "all",
        "不限标签": "any label",
        "没有匹配的会话": "no matching session",
        "＋标签": "+ label",
        "点一下给这个会话打标签，只存在本浏览器": "click to label this session; stored in this browser only",
        "标签只存在本浏览器，会话滚出最近一段就失效。": "Labels live in this browser and disappear once a session leaves the recent window.",
        "积分消耗": "Credit usage",
        "界面密度": "Interface density",
        "行距与留白，只影响这一页": "spacing and whitespace, this page only",
        "密度": "density",
        "紧凑：一屏多看几行；舒适：保持原来的留白": "Compact: more rows per screen. Comfortable: keep the current spacing.",
        "舒适": "comfortable",
        "紧凑": "compact",
        "指标、图表与时间窗都可切换": "metric, chart and window all switch here",
        "跳到": "jump to",
        "面板渲染出错": "Panel failed to render",
        "刷新页面可以再试一次；如果每次都这样，把下面这行发给我。": "Refresh the page to try again; if it keeps happening, send me the line below.",
        "平台都隐藏了，点上面的图例恢复": "all platforms hidden - click a legend chip to bring one back",
        "点一下显示 ": "click to show ",
        "点一下隐藏 ": "click to hide ",
        "收起数据口径与依赖说明": "hide the data notes",
        "数据口径与依赖说明": "how these numbers are measured",
        "按近 7 天日均速度推算余额归零需要几天，不是余额比例。": "days until the balance runs out at the last 7 days' daily rate, not a share of the balance",
        "模型": "model",
        "次": "calls",
        " 笔临期": " expiring",
        "近 7 天日均 · 横条按 90 天满格": "last 7 days' daily average · bar spans 90 days",
        "积分 · 折合": "credits / value",
        "时间": "time",
      } };
    /* Read before any module-level t() runs, so a stored choice is in effect
       for the constants defined above the preference store. */
    var LANG = (function () {
      try {
        var raw = window.localStorage.getItem('dsh-credit-expiry:prefs');
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.lang === 'en') return 'en';
        }
      } catch (e) { /* private mode, first run */ }
      return 'zh';
    })();
    function t(zh) {
      if (LANG !== 'en') return zh;
      var v = LOCALE.en[zh];
      return v === undefined ? zh : v;
    }

    /* Everything animated here is decoration: the numbers are readable with the
       motion disabled, and prefers-reduced-motion turns all of it off. A panel
       that jitters under someone's eyes while they read a deadline is worse
       than a static one. */
    var CSS = [
      '@keyframes cxeFadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}',
      '@keyframes cxeGrow{from{transform:scaleX(.001)}to{transform:scaleX(1)}}',
      '@keyframes cxePulse{0%,100%{opacity:1}50%{opacity:.5}}',
      '@keyframes cxeSpin{to{transform:rotate(360deg)}}',
      '.cxe-in{animation:cxeFadeUp 320ms cubic-bezier(.22,.61,.36,1) both}',
      '.cxe-track>div{transform-origin:left center;animation:cxeGrow 560ms cubic-bezier(.22,.61,.36,1) both}',
      '.cxe-card{transition:transform 160ms ease,box-shadow 160ms ease,border-color 160ms ease}',
      '.cxe-row{transition:background 110ms ease}',
      '.cxe-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.045))}',
      '.cxe-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.10)}',
      /* 日历格子比旧版大了一圈：整块放大 7% 会压到邻居，改成轻微上浮 + 投影。 */
      '.cxe-cell{transition:transform 120ms ease,box-shadow 120ms ease}',
      '.cxe-cell:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.10)}',
      '.cxe-spin{display:inline-block;animation:cxeSpin 900ms linear infinite}',
      '.cxe-pulse{animation:cxePulse 2.6s ease-in-out infinite}',
      /* Filter chips: pressed state is carried by aria-pressed, so a chip is one
         button and reads as one control to a screen reader. */
      '.cxe-chip{border:1px solid rgba(127,127,127,.24);background:transparent;border-radius:999px;padding:2px 9px;font-size:10px;line-height:14px;cursor:pointer;color:inherit;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cxe-chip:hover{background:rgba(127,127,127,.10)}',
      '.cxe-chip[aria-pressed="true"]{background:rgba(127,127,127,.16);font-weight:600}',
      /* Printing is a real output path for this panel (a monthly report), so the
         controls that only make sense on screen are dropped and the ink-heavy
         fills fall back to hairlines. */
      '@media print{.cxe-noprint{display:none!important}.cxe-in,.cxe-track>div,.cxe-pulse,.cxe-spin{animation:none!important}section{break-inside:avoid;background:#fff!important}}',
      '@media (prefers-reduced-motion:reduce){.cxe-in,.cxe-track>div,.cxe-pulse,.cxe-spin{animation:none!important}.cxe-card:hover,.cxe-cell:hover{transform:none;box-shadow:none}}'
    ].join('');

    /* Injected once per page mount rather than into document.head: a plugin
       should not leave global styles behind after it unloads. */
    function Styles() {
      return h('style', { dangerouslySetInnerHTML: { __html: CSS } });
    }

    /* Official brand marks, inlined so the panel never depends on a CDN and
       keeps working offline. 48x48 PNGs, 1.7-4 KB each. */
    var ICON = {
      wb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAADAFBMVEVMaXFjTfJpS/pnSvNMds1WWtJqS/tmYuxmS/ZJh8tqTP9pS/pqTPzRyvlpSvhUWNRPadBMdc5lSPJMe85nSfZmSvNnSfVoSfdSXdFRWs9lSfBVV9dYWtpsTP9sTf+4vu1sTP9Od85rTf9TZddObNFOas1UYNaupPNRW89RW87LyfRZU9xbUd9dSuFfTOdfTOdNd8uyt+lJgcmor+bi5ffLwfnAw+yqqutWWtDBtvd2Yejr5/zd1vpiSuloVelfT+NYV9tiR+tnSvZjTO9mSfR8jdr///9oS/ZpS/ppSvhrTP5mSvNmSvRPd9P19P5lSvJlS/BqTPthT+trTPzw7f7s6P5QdNPy7/77+/9kTO9jTe7w8fz19v3t7fzv7/38/P9OdtJjSOzx8/zz8f74+f7n5vtlTPJIjMtJicxgUulnS/Tz8/3u7P5Sbtbz9f1iR+pKg83+/v9RctRUa9leT+VRdNXs7Pzt7/xhSOjp6ftMgc9MfdDt6v5WZNvr6vzk4/teVOhKhs708v5PctHy8f5VaNtgSufo4/5dVeNQYtBOetJHj8pYXd5eUuVXYdxiSer2+P1Ob8/49v5QZtDm4f5fTOZbU99gSOfi3/tiTOxiUO1bWOJaWeBeTePq5f5kS+5PaM5cUeNZV95UaNdPddFYYN1Kfszu6v5Pa85RX9BXXNpgTuhWZNhTbdhUcddNcs5fSeXFu/nd1/ysvOpLgM5aXeDY0fxPb9Hk3v5Qa9Hq5v5iTOlvUfibjPTp6/tWedRRbtdTb9dXatp0Z+teS+NcTuBWYNhSW8+pmPmHcfW6vfF0ceSdlfHU0/jW3/RYg9O0pfl6mNyer+dzjdp5buvDwfJgcdtpWurd3Pm/svx3XPh+i+K8zO5nTu6NpeKNiexnktaSgfJrhtu1xOyMevHM1vKQevqEavyttutvVu6WgfO2rvSzsPJiXeS6tfPHzvKio+7LxfiftuZgYd5rYOne5PdnbuGKj+V3geR/otvQ1PWPnOiDnOBndNbI0/Btdt4FXNyDAAAA1nRSTlMAE25T/hr0Bhr+kFvN/SZgL4D1/WnO83nbxpCX9vruqNtkufTXoYMp+vDQcsyUu+6aj99K9+q4M3mQv/rq3vne0P32aP4r///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+jtbVYAAAAAlwSFlzAAA9hAAAPYQB1ayvdAAABUpJREFUSMeFlndYE3cYgE8UkKEIinvvbfce//hcpGkSqnASk0CAIDQhEBlKGEEIICJKoChQEAQOpBHZqwwpopThnrj3Hq3dtfP77hIUCfrmeXiSh/e9fLnL734hiBcZbmM9c/rUKVOmTp9pbTOceAVDzGw/64et2ZCX6MOtLVYNwMJ6sLexNDOhr1p157bFOEtT/kjbL0xxp6rhXLPtyIH+UIsVpmiua2hIr2y2GPqib8Mx6a/obEhPT990boXTmP7+GCfTnGf8TY2dTk5m/ebhDMIx1HMbG3O7OJznpho5dhD/fAPouY2urpFVzZyxfZ/c0tGkLZdzOvHwoO/e7X+Ow3E0nt1xcrmcC3xuAJ9z5UgVTOMaGbnb38XFpWv58nGG6+uArtGRMzWb3c416qtXe9fJl49lr/lEAZcrEDgL1vYBLwCuoLIRp0F9dWwsv4XLnch83xzgn87AWmcDa/GZQHCvBX328LF8fprLsWYH/CaasZbQWSgUrgGEiLNz17F01NFHnZ+WJpM13sfL5yjME+at6c+lljo4N5Hs0ZnDo+/m4fE2fOS8PIP+dR/X6lw18GFdXNyZ4Q06+OvWzSNs8rKy1mRlrXxG+xO1RoPDu7PD+4+orKzzRp0kyfeJiVlZrP6lgUPRas16f9RF3t58/oiblzyBS9eq0CcXEksZHc2NyNlKjWa9RIJ6nCKWX3UzJSXFMxAenp4taRB8RHzcdLb91Kn2Xxh9Y/thjUYicXd3F8XFKRTqQyubIEgJBDw9A7v4JPkhsexBb2ZmZnR05uHTDw9d6cXDgw+2wvvB2T17mpoSwtgCuE+S3sQnmYzv4+OjVsPw4ItEItD5T05t3bp1D5KQkJARlhEWFhZYSboR26tAj2b0fWBL3EUiL4VC3HslMRGCkJCQ7QkYYBEYdo/vRix7bNQ1fbpC8uOj7OzsRGjyQ7ABKioygM444tMWZpp9OPwG0L0UAYru32pra3NyMMlnkp3YVCRkVDSNIJY+yvTB4Q06+E//iCoqKko2Jj29/NOJO4EDFcAHxJL8h2o1qzOH9/krPj4+KmrbtqLk5OSc7IIcHzj7j/MBSA5ULCHsdvSo2VPj5RUQIO4+Exy8f78hweZnvL4ePTuAg5AMJcx3FHQbpgkQi0/sBYKDg5l3gQaqXiyeFhQUYHLQnCAWF/RImMOLxbrqtrayMuXeNowKC0vjS6NKoy5gQP6u12OyGNbDIr2+G4cX63S/lgWFhoYGBUGk/A4aJiv8AQN11DZMFuESnaz/T4S6TnYZdIqisAlSAm34R3ndDYsLhaUd+snMZjFJ33EXfJnMq5WieTQVSoX+feJ6kBaqIAr7agxOKqGYxN5mJnec0eGKukVRtFTK49FgeByHGJAmJSUdPUKSFylKWTjLnL0xze04wyzAGxRN86S0lIcz7GuV8kCOiIgIDw8/fjUiiUcp5xpvleP3Mwu2WisFeFJeAM7wk9GOAVSq8Ajp7L6NaNQsXN/kDS1NY0IzQ+uOoq6KifFDYlTho0c9u33byXDBHtHS8JDSdOsGLC5G1NSorPz8fBE/K9WM5zeIaWi4tWrLtQBNX8aX667WqCDw9d0C+PrZ99+CpnmAcqI+tb6+PjVVW34Eiz/ZYAuD/Yub3OtiktxQ9i1QAslJ6MVHi5kCZ7KaMXAbffMtkrz7FbKrpKTk+K1/Tw4bNrq4GBIrqzdGmdzY39HJ/tkMYANRank5kxSrXrMc5LfAuwtPfwNgs7kvGTbH/CW/Nua9N+F7gKl2QZM62978VT9ozO0mTRi/YP78BeMnzLEbaP8PbZs7ZcnTSNgAAAAASUVORK5CYII=',
      tr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAMFBMVEUKCw0y8Iwjml0ZYT0PKB0jmlwMGRUt03wNGRUrxXQefUwefkwqxXQlqGUmqWUURC13+a/8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAeUlEQVRIx+3USQ6AIAxA0RZBJof739YAboyQlgQSTfpXXfQtRBRAkga3EL0AEv0FHLra3gSqfoBqPFjhMZBA23jvb4YDtEWMZR/R0CDtZ5H2s2CBAOA8D2QR0pCE4T10KIPzpvNY3awXNwfkz7Tnen8UnKqd/Iil0V3ptgPv4rhglQAAAABJRU5ErkJggg==',
      mm: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAADAFBMVEX///8Arv8Acv8Ae/8As//8/v8AsP/+//8ArP/9/v8AgP/9//8Adv8Agv8AeP8Aff/8/f8Amv8AmP902/8Asf8BuP8Atv8Auv8B4P8ApP8Bhf/7//8AjP8Atf8Aof8Aqv8Alf8Ao/8Aif8Ak/8Ad/8AvP8AkP8AdP8Agf8Apv8Ahv8Ah/8Anf8Ap/8Anv8AtP8AqP8AfP8MwP+P5/8Am/8A4v9l1v/+/v8Akf8Ac/8AlP8/yf+c7f943v+f7/+I5P+W6v+k9/8Ajf8Uwv8Bvf9c0/9Dy/8Cv/9GzP/5/v9t2f+4+v+2+/+F4/+y+v/W+/+B4f+o+P967/8n4/9T6P9E5f8AiP8Ajv8Aov8Be/8hxP9T0P9Lzv8uxP9+4f+0+P/2/f9X0v+s9v+q8/8lxv+Y7P8Bw/+M5v+K8P8A3f+Z9P8Byf+s+f+L9P8/5v9z8P8axP9e6v/u+v/V9P973v8umf8Oif80xv9JzP82yP9i1P9Qzv+k8f9r2f+T6f+A3//k8v9+3v+r6f+U8/+87f9e1P/x/f+w9v+D8P/q/f9u3P/e+/8G4v+f9f+A8f9p7v8A0P9Z7P9u6/9Q4f+E8/+c9v+Q9P/R+v/i9//R8v/m+P+dz/8Jh/+/9/+O4P9T7f9g1P9esv+i5v+07f/N+P+v+f+g8/+79/+78f8z5/+b7/+C7v+F5v965P8o5/+h9/+R8P8dlP9K6f9x4/8U4/9j7P9R2f8e5P803v9Q6/9k4P8e4f9F3P8W3v9h5/884v8P3/8I3v993P932P8Ytv9hz/8etv8asf/X7P+Y4//J5P+Ewf9Kpf/I5f8Wjf/b7f9Zr/8CiP/U6v8oxf/A+v8Uvf8HxP9j1f+13f+U7f+m8/+n9P8zzP8h4/+N6/+G6f8Wyv9f2f995/8A2v8/0/946v8p0f8P0f90wv8V1/811/+W9f8Civ/T7f+p2v8Is/9jw/941f9Jt/+Z3P9Iuv8Kpv+05/990f+Q0v8xt//Q9P85wf+c3//Y9v9Hv/+j5f9+QMpEAAAACXBIWXMAAAsTAAALEwEAmpwYAAAE40lEQVRIx9VVd1STVxx9kB3Il/ARssggEFYYYQQIWzZh76EgW4aCgIjiAmWLIIIMcdRtXXXVWffsbq3de0+6W7trf1/gQBLLaf2rp/ecnPMl5953733vy/sh9D8BjUGA9i/JFA5j8pEz9TQz/DjEupyWx194rp74TuHMvLKOyUCMJ596+ljjli2Nzy7esbkFJH/vwqD4QQIKKty8ONcRI3kyAWwSqfH5Z8CUw2AYh4PlKVrkh15djJnnstm58GE6sUQiFlu0owV+B4aZAR+NXfvtl2++/FTEZuZiGKbASCRPNpMlUt6+zTr21c/f/fDTGNLbNAb6tZYqk+P4uIuIjSkcAQoFkUukdBE7ZGcH4K7ym5vQdCoKalCprt9ytwlXOnkqHP1NQWGOYSQmy2U8W4Pjrj/eort9C7Rphz9879X/qbYRK51I5v6mAH9HBYnNFGWJNTa4Wir8/u6NRcigNwX9LgQHFxbJ3FQHfxA4iWyz7XALd6Hw5pghHfij192keLYtRNI5mDpinkyWUqyxw12lzjLZDcQxElyl0nMsNOMiJgYdoIQCGijBwMbCXe4mM/l6k4EFDXWU8qhurkQmNmYOwHT8cAfYIKnQg841uabXmTDYNS9SRReqA8RKFpvkSYL8LBdxNjSGBmBA5uZr9Q+Cgg7Pn8fnyuRqu/AsEYvpBHRbHV/tLneW0alkHl8/E7wYg/3zYwiFRYCDeDwry1YM9ABYXpoDgUy4KivJGr1M4HWmv1/nIXTFbew0DhpNAKRxlUqFzh4yEEisJNsMBJT0Dz77BBQqupvUXY3juIUa2HKhsxvBp3J5VrzVBgKz9AtnPv/43ZcjeVy6h7M8J0cOZGege8gIA3DgNRtGqrlw6fz5D9+c7cWXkKkmdAKySRAOZJ7kCf19paC6y5mDg6dO5QWWRkTyrXhkMpdLNTGhTylUqjZDwdErmRkXz517r2h5bNOdCC8+n8eTkLlgJQMvQvDSqP5Rm6GRy5cyLg6cOLHWN2rO0sD82V72hA9hMpko1ujVQJmPZZwc+Oj9w8ETkiWzvSL5PAgGIEus+PydBq8GskYlVzLrBtIOvnNobnCcb9Ty2MD8iBg+uMD+8O1jvGILEQ3dZ7E+ravi7fJEkCwryosGk5hIe3v7SK/a/CW7jP4P0CI5vaZuYV/F0ddWeSfOtVy5fU5eYFNpbURE7Z2m2OhtxnxCcDodLCpaqw6UTUigS15sdGD00uVFRTtpRhctDXWnVz5as2HhxuGq3r0hQbO8Q1MaQLOsPap9+zLfuFfuGlaA0hWVAp+3jp9Mq/6iN+yN11eElBGa5tXBlhO4Wm+ggGvtIYFAsG7/2fV9w0NhqcXFJSUrwGeVd3loaGJKc0ODpeGlQQh8BAIfXajqodQFewoKOotLVgQFBYFTeWjK6jijW8YaVfusE/j4pB/fsLAz7MiCpIT4+PiC4q0Ph0z0sbSsNz6H7kcERKjTdSNoZDhVp0jYp0W7D5TNKk8Mbl9jVJrY1v2CykrB2W6EejYOhYEiIelFMxrqCTkUvHblGsr98wQVdh7s2mcN6bQVfVVHUvckpSYjUBQuamsb1d34xkfnN1mfhpLTulp7w8K2anXWU+Pp/mkIoOnMeva2VhXv1k5P1H8apIjW0aFFtAeY07SZYsyseCD6f4u/ALgmS0ixUxJxAAAAAElFTkSuQmCC',
      qd: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAADAFBMVEVMaXH///8h1GL9/f3///+9x73+/v7////U2dlDiGLv//////////8p2Vsp21v9/f0cOhwp3l3///8j22QADwAp21wp21sKIB305+c3sjc7ajsq2Vsq21v////r6+uBjYRna2cf2VMs213///8QHRCrzrjc6+COtJf1+vZ5lYK5ubmdnZ/s7OyZtqLw9vLa2tskrUh1dXUmylYq2Vzm++0r4V4ozldmj3A6X0b8/vwehjwaWy4q2lsnxlQhgj4p0Fgny1Yluk8bdDggmEIbYzF/f3/19fVmf2vKysrS49jv8/G/1MUp2lxaWlq+vr65ubmmpqjs7OzCwsUksEwgi0G9vb0ktU4ozlbk5OS6urqhoaEjn0fJycknwlN6enodUCvS0tLS1dPU5tjO3NEoylbAwMHJycny8vLL2s/BwcHPz88o5F3X19fg4OD7+/tOyHAxoFEjrkvf398lu1C8vLwt4mDKysrZ2dkdcjf5+fm8vLyrq67m5ubT09NaWmLv7+/W1tbk5OSwx7jc3NxG5nMq1lvE2MnM6dMx22ImwVOu8cEz3GMq2lwkokhz54vW2dj6+fko2lqnn6fo6OjX19dMblb1/ffI3c7L2c/x9vSyxrc13GTw//XB3MhNhWOvy7ce3lXm7uityLSe8rbN59QX2E3p9Owx2mHY5duftaTl8ugomUoOrzwnxFSL0IsnvVIgkEAr4F4nzVYbczclvlIlsEwjqUk4tFsksU1a3H5V/1WGmoYkrEsp11smwVIkpUgnt1AdfDgikEQluE8koUckrkwnylYp3VwjoUYq21z///8q2Vsq2lsjoEcr5mAr4F4r5WD8/Pwr2127u7z+//8jokct62L+/v8j2lcs52Er3l0s2177+/v8/Pz8/vwt6WL9//0r5V8s6WEn2lor418p3Fz9/f33/Pkt4GBE33Ab2FGT7awp01nz8/Pp6en5+fld8Ye8vL22traO7Kkc3VPy//jj7eZf44Sm9Ly+9M7J9tZP4Xjg+ud++KAf5Fcx6WXWox8oAAAAyXRSTlMA/QL9/gT9/AIBA/oB/vv+A/yGBwn85wYEBAL+/fn6MSb9/QUONLc1/Wdwb+dn/PJCEvPy/fv9DBT8Q0T44hr39tcoRi4k9jK1svKy6CJDmnnebmFdabxe5pxKXcXQMCPW37Lc0eim2N1kYP3WuvrtYY6ix0X+Or48kpVPu6sfoqP7e5T+9rLs+6H95+hVC5D16UO5vDX7g3zps/39Zxee/Pdn/LD73/7foNx+tPcL+F/9+lKO9oOer/YDJu6Ts5R1Xh62/t+N/v4wx3xjAAAACXBIWXMAAAPoAAAD6AG1e1JrAAADqklEQVRIx42Wd5QTVRTG7yQzeQkbJxvJmk1ZtkjvHZZeFMQGiCBVivSmgAioCCjVQlHsFRQpUqR3FBQ8c3che5awm2SXBNiwVFk6goK+SQIhMy/E7+Tkr/t735377p07ABHp9SCMGFOBR1l82cBaFhD0EF96sI4chjyStOLS0uI0jseXqiVDOX38+PTRyBNiKsSwRTHh/JUrhYxZSoUaF3iiw/vk1hI8NagKGFku5eC5Mk5biLFyEw6rzk4Ho2BXnV+9mBxFtdw6grW/+FiJCND7zyQTMlVKCF7/tAloBMO9eCM80xW1GEfu7GwOP/+sHhg00QI9gSRO+DG//P/JV9fmvF0PbLZI/LNlXCEznNe58dStczfOfDl35sWXXwFNxGRAnIS0HDa8csZzNtNTUuLJHDVxwmQIebxWxjMNtLhwwXtXPflFRfmynCmB1nVDxFTUMeP5Oh/CotNZ0j2JwVnNQANNayKrpEn4UROY/74rNwpIDm/LigBvIMfMZ7EVjOUfiQEkMfArwOusmmrxTQutnxJwBqnFFAZgwjpv0XgVIDl97WGSuqg8jn2VNoxBDYjeX+ASqtpOh0NpA8vA00qgYDccVgEmrJkBdmA5pAT2MACCnWnHA2Uea+xzxgA5eUfUgAkvvCgb0Ft93mfOTQzosC+EptIGLwREKTFAsDstEZUGenhTEgM8dng8lJEd+td3ORIDHPa00CmUM+qWpzBgAkdxiIVWlP6s/bwOBnBZARAcL98aNejjUhqEgGmKXkrCh+FR+ZGTB6sMKHAQ3mEDNhjnVRlIOYcOQg0mYIO6LRS3fBfImIGFSiDVBs3bBFUJhQGYHtvfMrAWmq/Le0iKA6RX4E0KAJqtyWOcHwYEqI5ppljgpwZB1vkRBz30wiTCR8f5h9X/NmLHhwEDJHd5EsldxI9/3clySA8A5Pd9x6dqI0fcYeDdzCLpwQAIRqjSqSpP5CXkx5ue/ERAaPVVquzniBaP4T9xDaIARQSwVhvupi7o/zuuxX0A3YwCWGqtQD6bO3e26P8AYLDpwbJ0FfINl5coLZy5kW79PWadGuhOtn79I36/LCs2XvSZU8Lv7/2KDSwj36xccvs7MdqqDtEcaNDIaxadzhYFBxhbXg8Z324/sV4M3V6OaHYV5M9r9UFbX8D1R0HrdozvCGOqEXZu3RA4flKSTgYDrvrbNtIZT977W5vGbduzP1XsdKjbbdl1XpLOb970c1M77NBoaAe12lcRDP8BJOPGOxBSuPoAAAAASUVORK5CYII=',
      db: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAABamlDQ1BJQ0MgUHJvZmlsZQAAeJx1kL1Lw1AUxU+rUtA6iA4dHDKJQ9TSCnZxaCsURTBUBatTmn4JbXwkKVJxE1cp+B9YwVlwsIhUcHFwEEQHEd2cOim4aHjel1TaIt7H5f04nHO5XMAbUBkr9gIo6ZaRTMSktdS65HuDh55TqmayqKIsCv79u+vz0fXeT4hZTbt2ENlPXJfOLpd2ngJTf/1d1Z/Jmhr939RBjRkW4JGJlW2LCd4lHjFoKeKq4LzLx4LTLp87npVknPiWWNIKaoa4SSynO/R8B5eKZa21g9jen9VXl8Uc6lHMYRMmGIpQUYEEBeF//NOOP44tcldgUC6PAizKREkRE7LE89ChYRIycQhB6pC4c+t+D637yW1t7xWYbXDOL9raQgM4naGT1dvaeAQYGgBu6kw1VEfqofbmcsD7CTCYAobvKLNh5sIhd3t/DOh74fxjDPAdAnaV868jzu0ahZ+BK/0HFylqvLiAv9gAAADAUExURZyWmpVrYiYgIGxXVMnj/8ji/8yIeMra/9umm+DV2CEhIbGGe2xFPCMjIyUlJbrP5LLu+1o0LX9//818a3h8hHiCjsG6xKCww3///wD//4F+gL+//z1AQm94g39/f6qqqjs/Qcrl/gAAAEk2MTAnJffXze/Fuue5rf////PNwhoZGEItKMbZ7VNHRda0rFNBPcnj/86YitXx/9WmlycaF/vi2VdUV8nj/qm4yjMhHbfG1snj/mtmaHd0d8nm/6qq/717YIgAAABAdFJOU///+P+jWP8c//8g//+kbv4J/wL//////wIB/wT/vgID/P0A//7///8B//7//v///3L////9///M/v//Mf//DwMqqF6yAAADvUlEQVR42nWW2WKjOgyGZUMSsrRpO53OcrbBmDVASmEgJJC+/1sdeQNCp7ppY+tDvyQjA2xi0V+MXVcLu2lctMa2F5crrkZTH5i448bl1XYn9ubarzNkBHDxaqML2v4EAKfUMCu5OQce2MOreuyp97iwDEwgjPI+ByJ2UWL2PTfW9vD1LKM0lyGGBt7ZQj++9rQdEPF4rcMsDCGBaMWMnC7zbglunZUstopGgL2+KT0w+nsiE8Ra7yRlvbIBGPSkYCnX4/GoI3gHJM5a1bsC3tnFHeoj3bPMKJJ/2k5tXwQB7On7tTEBpKCjlUm3FgEVSIlymyt2EAGTgAmQHaV6si1zopKnulQiDYjYyjUBaqXfE+5l/BsNjgeRvGnhKvqBgDk9ZzhKwOOH3Tbw0d33fwcWx7R1Eq7NIpgE6HQ1D9Yy8BXg+7El9J210wUBk4FOGQXsSB4Lfwn4gdV6rdaEzQBTIvfcHxXwSEoM4Gv/2A93nD9rwL6C6YGrm8arw46Q0tcWB4FfcG6ScC+weDOAOnbtI/oTa6v8S/wfQlLV5o1agO3epMAPZBkGcego/YRsEdlyA7j2CPQK8IRDHhg9wsrCGoAGhpw7mTNvOaWJVwSxCBCEgPkEodWPgHsDcG9X17yivROLALlVJZlHQvJtmAsjYBlFlFIPcglAltGuJzl5+Qw4eAQySq21yhkLQa08yCFcfwQ6DRQFIbnKOY4tygGV5UGQGmCW9CMpnMCPdZP9sCjCMMyx0OknVcJzjbuxrGko6ir8MUD8hz5MAJlAGMjCIoBL6QCYo6Eb9ygbrVJWYcIc1ut0PBqX204f8M0UmkLHWTphICIQmIznC1ztt9lZKkoMETvLL18c4Q/VBGiuwwuU/lSAIMRREuJRUE7a6jSOf3yBIqMJ8OnekVdVtds66vDhUbKqqh0Bd8XGIbCH3vLa43PX1WRZSPlgtQk+YATEEPgRrYbf6fmb2ExflmhFAc91XWd1dp4EwCEQmck92npZLDHnl9kyZvCEky+KhjlgzCnKsiiW+Wy5uX5/uh3GRllRYonKwpkBehhPxr32d8SBQ6IUV+PeNHkc95MLRUzkr+CEokbYiBKSitb6nptcKOOVtYea0yzXL4O/hkQYPc2vLBFDqIK/2yThCYXcX6/X6M8xAufJr1Trub12G9yX122V8LrrO4siTbmI8c9qfu2KzB/uq+GKllIETgVxz9h/Hz8dHhjb3PGPRu82f/x0wMV/EbmfMXf3G8Y++ZpRtkHmjspHU/TezPf/B1UjMXjXExc7AAAAAElFTkSuQmCC'
    
    };

    /* Platform identity is deliberately NOT theme-driven: indigo is always
       CodeBuddy/WorkBuddy, emerald is always Trae, cyan is always MiniMax,
       lime is always Qoder, in every skin. `color` paints bars and dots; `ink` is the darker variant
       that stays legible as small text on the light tint pill.
       Trae and Qoder are both green by brand, so Trae takes the cool emerald
       and Qoder the warm lime - far enough apart to tell at 11px. */
    var PLATFORM = {
      wb: { id: 'wb', label: 'WorkBuddy', short: 'WB', color: '#6C4DFF', ink: '#5B3EE8', tint: 'rgba(108,77,255,0.14)' },
      tr: { id: 'tr', label: 'Trae', short: 'Trae', color: '#12B76A', ink: '#0B8A55', tint: 'rgba(18,183,106,0.14)' },
      mm: { id: 'mm', label: 'MiniMax', short: 'MM', color: '#00A8F0', ink: '#0A7DB4', tint: 'rgba(0,168,240,0.14)' },
      qd: { id: 'qd', label: 'Qoder', short: 'Qoder', color: '#84CC16', ink: '#4D7C0F', tint: 'rgba(132,204,22,0.16)' },
      /* Doubao sells two different things. Subscription windows refill, so
         they are not expiring balances and never enter the money math. Bonus
         grants expire within about a month, so those DO count in the remaining
         total, the ledger and the calendar, through BALANCE_ORDER below. */
      db: { id: 'db', label: t('豆包'), short: 'DB', color: '#F04438', ink: '#C4322A', tint: 'rgba(240,68,56,0.14)' },
      cx: { id: 'cx', label: 'GPT / Codex', short: 'GPT', color: '#10A37F', ink: '#0C7A5F', tint: 'rgba(16,163,127,0.14)' },
      ms: { id: 'ms', label: t('魔搭'), short: 'MS', color: '#1D6FE0', ink: '#1557B0', tint: 'rgba(29,111,224,0.14)' }
    };
    var PLATFORM_ORDER = ['wb', 'tr', 'mm', 'qd'];

    /* Display grouping for expiring balances: the four priced pools plus the
       Doubao bonus grants, which expire and therefore belong in the remaining
       total, the ledger, the calendar and the sidebar row. Anything that turns
       credits into money - burn rate, forecast, missing-platform notes, the
       cost split - must keep using PLATFORM_ORDER: Doubao has no measured
       spend history, so it cannot produce a rate. */
    var BALANCE_ORDER = ['wb', 'tr', 'mm', 'qd', 'db'];

    /* Only the credit pools. Cash providers (DeepSeek direct, CLI proxies,
       ModelScope) are out of scope: they never touch an expiring balance. */
    var PROVIDER = {
      'workbuddy': PLATFORM.wb,
      'trae': PLATFORM.tr,
      'minimaxcode': PLATFORM.mm,
      'qoder': PLATFORM.qd
    };

    /* The ledger speaks provider ids ('trae'), the palette speaks pool ids
       ('tr'). One normaliser keeps both call sites honest. */
    function platformIdOf(id) {
      return PROVIDER[id] ? PROVIDER[id].id : id;
    }

    function providerMeta(id) {
      return PROVIDER[id] || { label: id || t('其他'), color: C.accent, ink: C.accent };
    }

    /* The real brand mark, not a coloured dot: three pools in one column are
       otherwise indistinguishable at 12px. */
    /* Codex and ModelScope have no PNG in the vendored ICON table; this panel
       draws their quota blocks, so it carries two small inline SVG marks. */
    var ICON_CX = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjMTBBMzdGIiBkPSJNMjIuMjgxOSA5LjgyMTFhNS45ODQ3IDUuOTg0NyAwIDAgMC0uNTE1Ny00LjkxMDggNi4wNDYyIDYuMDQ2MiAwIDAgMC02LjUwOTgtMi45QTYuMDY1MSA2LjA2NTEgMCAwIDAgNC45ODA3IDQuMTgxOGE1Ljk4NDcgNS45ODQ3IDAgMCAwLTMuOTk3NyAyLjkgNi4wNDYyIDYuMDQ2MiAwIDAgMCAuNzQyNyA3LjA5NjYgNS45OCA1Ljk4IDAgMCAwIC41MTEgNC45MTA3IDYuMDUxIDYuMDUxIDAgMCAwIDYuNTE0NiAyLjkwMDFBNS45ODQ3IDUuOTg0NyAwIDAgMCAxMy4yNTk5IDI0YTYuMDU1NyA2LjA1NTcgMCAwIDAgNS43NzE4LTQuMjA1OCA1Ljk4OTQgNS45ODk0IDAgMCAwIDMuOTk3Ny0yLjkwMDEgNi4wNTU3IDYuMDU1NyAwIDAgMC0uNzQ3NS03LjA3Mjl6bS05LjAyMiAxMi42MDgxYTQuNDc1NSA0LjQ3NTUgMCAwIDEtMi44NzY0LTEuMDQwOGwuMTQxOS0uMDgwNCA0Ljc3ODMtMi43NTgyYS43OTQ4Ljc5NDggMCAwIDAgLjM5MjctLjY4MTN2LTYuNzM2OWwyLjAyIDEuMTY4NmEuMDcxLjA3MSAwIDAgMSAuMDM4LjA1MnY1LjU4MjZhNC41MDQgNC41MDQgMCAwIDEtNC40OTQ1IDQuNDk0NHptLTkuNjYwNy00LjEyNTRhNC40NzA4IDQuNDcwOCAwIDAgMS0uNTM0Ni0zLjAxMzdsLjE0Mi4wODUyIDQuNzgzIDIuNzU4MmEuNzcxMi43NzEyIDAgMCAwIC43ODA2IDBsNS44NDI4LTMuMzY4NXYyLjMzMjRhLjA4MDQuMDgwNCAwIDAgMS0uMDMzMi4wNjE1TDkuNzQgMTkuOTUwMmE0LjQ5OTIgNC40OTkyIDAgMCAxLTYuMTQwOC0xLjY0NjR6TTIuMzQwOCA3Ljg5NTZhNC40ODUgNC40ODUgMCAwIDEgMi4zNjU1LTEuOTcyOFYxMS42YS43NjY0Ljc2NjQgMCAwIDAgLjM4NzkuNjc2NWw1LjgxNDQgMy4zNTQzLTIuMDIwMSAxLjE2ODVhLjA3NTcuMDc1NyAwIDAgMS0uMDcxIDBsLTQuODMwMy0yLjc4NjVBNC41MDQgNC41MDQgMCAwIDEgMi4zNDA4IDcuODcyem0xNi41OTYzIDMuODU1OEwxMy4xMDM4IDguMzY0IDE1LjExOTIgNy4yYS4wNzU3LjA3NTcgMCAwIDEgLjA3MSAwbDQuODMwMyAyLjc5MTNhNC40OTQ0IDQuNDk0NCAwIDAgMS0uNjc2NSA4LjEwNDJ2LTUuNjc3MmEuNzkuNzkgMCAwIDAtLjQwNy0uNjY3em0yLjAxMDctMy4wMjMxbC0uMTQyLS4wODUyLTQuNzczNS0yLjc4MThhLjc3NTkuNzc1OSAwIDAgMC0uNzg1NCAwTDkuNDA5IDkuMjI5N1Y2Ljg5NzRhLjA2NjIuMDY2MiAwIDAgMSAuMDI4NC0uMDYxNWw0LjgzMDMtMi43ODY2YTQuNDk5MiA0LjQ5OTIgMCAwIDEgNi42ODAyIDQuNjZ6TTguMzA2NSAxMi44NjNsLTIuMDItMS4xNjM4YS4wODA0LjA4MDQgMCAwIDEtLjAzOC0uMDU2N1Y2LjA3NDJhNC40OTkyIDQuNDk5MiAwIDAgMSA3LjM3NTctMy40NTM3bC0uMTQyLjA4MDVMOC43MDQgNS40NTlhLjc5NDguNzk0OCAwIDAgMC0uMzkyNy42ODEzem0xLjA5NzYtMi4zNjU0bDIuNjAyLTEuNDk5OCAyLjYwNjkgMS40OTk4djIuOTk5NGwtMi41OTc0IDEuNDk5Ny0yLjYwNjctMS40OTk3WiIvPjwvc3ZnPg==';
    var ICON_MS = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4Ij48cmVjdCB4PSIyIiB5PSIyIiB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHJ4PSIxMiIgZmlsbD0iIzFENkZFMCIvPjxwYXRoIGQ9Ik0yNCA5IEwzNi41IDE2LjUgTDM2LjUgMzEuNSBMMjQgMzkgTDExLjUgMzEuNSBMMTEuNSAxNi41IFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSI1IiBmaWxsPSIjZmZmIi8+PC9zdmc+';

    function PlatformIcon(props) {
      var pid = platformIdOf(props.id);
      var meta = PLATFORM[pid];
      var src = ICON[pid] || (pid === 'cx' ? ICON_CX : pid === 'ms' ? ICON_MS : null);
      var size = props.size || 14;
      var gap = props.gap === undefined ? 6 : props.gap;
      if (!meta || !src) return Dot({ color: meta ? meta.color : C.faint, size: size, gap: gap });
      return h('img', {
        src: src,
        alt: meta.label,
        title: meta.label,
        style: {
          width: size,
          height: size,
          borderRadius: Math.max(3, Math.round(size / 3)),
          objectFit: 'contain',
          flex: 'none',
          display: 'inline-block',
          marginRight: gap
        }
      });
    }

    /* The colour scale is a judgement about what "soon" means, and that is a
       per-person setting: someone burning 100/day cares about 7 days, someone
       on a slow plan cares about 60. Presets beat a number input here - three
       choices fit on one line and each one has a reason. */
    function makeThresholdPresets() {
      return [
        { id: 'tight', label: t('紧'), l7: 3, l30: 7, l90: 30 },
        { id: 'std', label: t('标准'), l7: 7, l30: 30, l90: 90 },
        { id: 'loose', label: t('宽'), l7: 14, l30: 60, l90: 180 }
      ];
    }
    var THRESHOLD_PRESETS = makeThresholdPresets();
    var THRESHOLD_KEY = 'dsh-credit-expiry:threshold';

    function readThreshold() {
      var id = null;
      try { id = window.localStorage.getItem(THRESHOLD_KEY); } catch (e) { id = null; }
      for (var i = 0; i < THRESHOLD_PRESETS.length; i++) {
        if (THRESHOLD_PRESETS[i].id === id) return THRESHOLD_PRESETS[i];
      }
      return THRESHOLD_PRESETS[1];
    }

    var ACTIVE = readThreshold();

    function levelsOf(active) {
      return [
        { id: 'expired', label: t('已过期'), color: '#8B8B8B' },
        { id: 'today', label: t('今天到期'), color: '#E5484D' },
        { id: 'l7', label: active.l7 + t(' 天内'), color: '#E5484D' },
        { id: 'l30', label: active.l30 + t(' 天内'), color: '#F97316' },
        { id: 'l90', label: active.l90 + t(' 天内'), color: '#FACC15' },
        { id: 'later', label: active.l90 + t(' 天以上'), color: '#94A3B8' },
        { id: 'never', label: t('长期有效'), color: C.faint }
      ];
    }

    var LEVELS = levelsOf(ACTIVE);

    /* The expiry scale is module state, and the sidebar row is mounted while
       the page is not: a change made on the page has to reach the row too, or
       the row keeps yesterday's colours until its next poll. */
    var SCALE_SUBS = [];

    function scaleEmit() {
      SCALE_SUBS.slice().forEach(function (fn) {
        fn();
      });
    }

    /* ---------- display preferences ---------- */

    /* Which parts of this panel someone actually uses is a personal question:
       a reader watching one pool does not need a calendar, and an auditor does
       not want the sidebar row to say anything but a number. Both surfaces read
       the same preferences, and both repaint when they change. */
    var SETTINGS_ID = 'credit-expiry-settings';
    var PREFS_KEY = 'dsh-credit-expiry:prefs';
    function makeRefreshChoices() {
      return [
        { ms: 60000, label: t('1 分钟') },
        { ms: 120000, label: t('2 分钟') },
        { ms: 300000, label: t('5 分钟') },
        { ms: 600000, label: t('10 分钟') }
      ];
    }
    var REFRESH_CHOICES = makeRefreshChoices();

    var DEFAULT_PREFS = {
      sections: {
        forecast: true, burndown: true, subscription: true, platforms: true,
        buckets: true, ledger: true, calendar: true, daily: true, providers: true,
        sessions: true, accounts: true, keys: true, doubao: true, codex: true, modelscope: true
      },
      /* layout picks one of three sidebars over the same model: 'focus' the
         soonest pack as a card, 'list' one row per pool, 'grid' a 2×2 board. */
      mini: {
        total: true, waste: true, platforms: true, soon: true, modelscope: true,
        rows: 2, layout: 'focus', spark: true, open: true
      },
      platforms: { wb: true, tr: true, mm: true, qd: true, db: true },
      /* Calendar layers: which platforms paint into the expiry grid. Deliberately
         separate from `platforms` above - that one is "does the sidebar row show
         this platform", a different question with a different answer. */
      cal: { wb: true, tr: true, mm: true, qd: true, db: true },
      /* 'comfort' keeps the 0.11.0 spacing; 'compact' trades air for rows. */
      density: 'comfort',
      refreshMs: 120000,
      lang: 'zh'
    };

    /* A stored preference is a claim about a shape this build may no longer have:
       fill missing keys from the defaults instead of trusting the blob. */
    function clonePrefs(source) {
      var out = { sections: {}, mini: {}, platforms: {}, cal: {}, density: DEFAULT_PREFS.density, refreshMs: DEFAULT_PREFS.refreshMs, lang: DEFAULT_PREFS.lang };
      Object.keys(DEFAULT_PREFS.sections).forEach(function (k) {
        out.sections[k] = source && source.sections && typeof source.sections[k] === 'boolean'
          ? source.sections[k]
          : DEFAULT_PREFS.sections[k];
      });
      Object.keys(DEFAULT_PREFS.mini).forEach(function (k) {
        var fallback = DEFAULT_PREFS.mini[k];
        var value = source && source.mini ? source.mini[k] : undefined;
        if (k === 'layout') {
          out.mini[k] = (value === 'focus' || value === 'list' || value === 'grid') ? value : fallback;
        } else if (typeof fallback === 'boolean') out.mini[k] = typeof value === 'boolean' ? value : fallback;
        else out.mini[k] = (typeof value === 'number' && isFinite(value)) ? value : fallback;
      });
      Object.keys(DEFAULT_PREFS.platforms).forEach(function (k) {
        out.platforms[k] = source && source.platforms && typeof source.platforms[k] === 'boolean'
          ? source.platforms[k] : DEFAULT_PREFS.platforms[k];
      });
      Object.keys(DEFAULT_PREFS.cal).forEach(function (k) {
        out.cal[k] = source && source.cal && typeof source.cal[k] === 'boolean'
          ? source.cal[k] : DEFAULT_PREFS.cal[k];
      });
      out.density = source && source.density === 'compact' ? 'compact' : 'comfort';
      var ms = source ? Number(source.refreshMs) : NaN;
      var known = false;
      REFRESH_CHOICES.forEach(function (c) { if (c.ms === ms) known = true; });
      out.refreshMs = known ? ms : DEFAULT_PREFS.refreshMs;
      out.lang = source && source.lang === 'en' ? 'en' : 'zh';
      return out;
    }

    function readPrefs() {
      var raw = null;
      try { raw = window.localStorage.getItem(PREFS_KEY); } catch (e) { raw = null; }
      var parsed = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
      return clonePrefs(parsed);
    }

    var PREFS = readPrefs();
    var PREFS_SUBS = [];

    function prefsEmit() {
      PREFS_SUBS.slice().forEach(function (fn) { fn(); });
    }

    function savePrefs(next) {
      PREFS = clonePrefs(next);
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(PREFS)); } catch (e) { /* private mode */ }
      prefsEmit();
    }

    function showSection(id) {
      return PREFS.sections[id] !== false;
    }

    /* Settings live in this browser's localStorage only. Clearing cache or
       switching machine silently resets everything, so give the reader a way
       to carry the choices across: a plain JSON file they own, no account. */
    function exportPrefs() {
      try {
        var blob = new Blob([JSON.stringify(PREFS, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'credit-expiry-settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } catch (e) { /* private mode / disabled downloads */ }
    }

    function importPrefs(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(String(reader.result));
          savePrefs(clonePrefs(parsed));
          if (parsed && parsed.lang) setLang(parsed.lang === 'en' ? 'en' : 'zh');
        } catch (e) { /* malformed file: leave settings untouched */ }
      };
      reader.readAsText(file);
    }

    function setLang(next) {
      PREFS.lang = next === 'en' ? 'en' : 'zh';
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(PREFS)); } catch (e) { /* private mode */ }
      LANG = PREFS.lang;
      rebuildLocalized();
      prefsEmit();
    }

    /* t() reads LANG at call time, but six label tables were computed once at
       module load while the UI was still in its startup language. Rebuilding
       them here makes a switch repaint every label, not only inline t() JSX.
       Every factory contains only t() calls already present in LOCALE.en. */
    function rebuildLocalized() {
      THRESHOLD_PRESETS = makeThresholdPresets();
      LEVELS = levelsOf(ACTIVE);
      REFRESH_CHOICES = makeRefreshChoices();
      VENDOR_LABEL = makeVendorLabel();
      CATALOG_NOTE = makeCatalogNote();
      SECTION_META = makeSectionMeta();
      MINI_META = makeMiniMeta();
    }

    /* The store ticks faster than any allowed interval and decides per tick
       whether a refresh is due, so changing the preference needs no timer
       restart and an aggressive setting cannot outrun the backoff clock. */
    function usePrefs() {
      var pair = React.useState(0);
      var bump = pair[1];
      React.useEffect(function () {
        var fn = function () { bump(function (n) { return n + 1; }); };
        PREFS_SUBS.push(fn);
        return function () {
          var i = PREFS_SUBS.indexOf(fn);
          if (i >= 0) PREFS_SUBS.splice(i, 1);
        };
      }, []);
      return PREFS;
    }

    /* ---------- helpers ---------- */

    /* Expiry is a calendar question, not a stopwatch one: a pack that dies at
       23:59 tonight and one that dies at 00:01 tomorrow are both "today" to a
       human, but ceil() rendered the first as "1 天" and the second as "0 天".
       Round on midnight instead, so the label matches the calendar. */
    var SANITY_MS = 365 * 86400000;

    function startOfDay(ms) {
      var d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    function daysLeft(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return null;
      /* A date outside [-1y, +3y] is a parsing accident, not a deadline:
         "14,600 天" is worse than no date at all. */
      var now = Date.now();
      if (ms < now - SANITY_MS || ms > now + SANITY_MS * 3) return null;
      return Math.round((startOfDay(ms) - startOfDay(now)) / 86400000);
    }

    function levelOf(exp) {
      var d = daysLeft(exp);
      if (d === null) return 'never';
      if (d < 0) return 'expired';
      if (d === 0) return 'today';
      if (d <= ACTIVE.l7) return 'l7';
      if (d <= ACTIVE.l30) return 'l30';
      if (d <= ACTIVE.l90) return 'l90';
      return 'later';
    }

    /* "0 天" is wrong twice: it reads as expired when the pack is live until
       midnight, and it hides that there are hours left to spend it. */
    function countdownLabel(days) {
      if (days === null) return t('长期');
      if (days < 0) return t('已过期');
      if (days === 0) return t('今天');
      return days + t(' 天');
    }

    /* How much of today is still ahead, as a fraction of a day. A pack that dies
       tonight can still be spent for the rest of today, not for zero days. */
    function todayLeftFraction() {
      var now = new Date();
      var minutes = now.getHours() * 60 + now.getMinutes();
      var left = (1440 - minutes) / 1440;
      return left > 0 ? left : 0;
    }

    function levelColor(id) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i].color;
      return C.faint;
    }

    function fmtDate(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return t('长期');
      var d = new Date(ms);
      return (d.getMonth() + 1) + '/' + d.getDate();
    }

    function fmtFull(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return t('长期有效');
      var d = new Date(ms);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    /* 积分永远取整：「每天 76.29」和「每天 61」并排时读者会以为两处口径不同，
       而积分本来就是整数。金额一律走 fmtPrecise（恒两位小数），两者不再混用。 */
    function fmtAmount(n) {
      if (typeof n !== 'number' || !isFinite(n)) return '0';
      var rounded = Math.round(n);
      var head = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (rounded < 0 ? '-' : '') + head;
    }

    function fmtPrecise(n) {
      if (typeof n !== 'number' || !isFinite(n)) return '0.00';
      var parts = n.toFixed(2).split('.');
      return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
    }

    function fmtCompact(n) {
      if (typeof n !== 'number' || !isFinite(n)) return '0';
      if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
      if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
      if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
      return fmtAmount(n);
    }

    function fmtClock(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return '--:--';
      var d = new Date(ms);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    /* A platform whose payload is missing is NOT a platform with zero credits:
       one failed upstream would otherwise make the sidebar state, confidently,
       that nothing is expiring anywhere. */
    function missingPlatforms(data) {
      var out = [];
      if (!data) return out;
      PLATFORM_ORDER.forEach(function (id) {
        if (!data[id]) out.push(id);
      });
      return out;
    }

    /* Flatten both platforms into one comparable list of credit buckets. */
    function collect(data) {
      var items = [];
      if (data && data.wb && Array.isArray(data.wb.packages)) {
        data.wb.packages.forEach(function (p) {
          items.push({
            platform: 'wb', name: p.name || t('积分包'), remain: p.remain || 0, size: p.size || 0,
            exp: p.expiresAtMs, reset: p.resetAtMs || null
          });
        });
      }
      if (data && data.tr && Array.isArray(data.tr.accounts)) {
        data.tr.accounts.forEach(function (a) {
          items.push({ platform: 'tr', name: a.desc || t('积分账户'), remain: a.remain || 0, size: a.size || 0, exp: a.expiresAtMs });
        });
      }
      if (data && data.mm) {
        var mm = data.mm;
        var lots = Array.isArray(mm.lots) ? mm.lots : [];
        if (lots.length) {
          lots.forEach(function (lot, i) {
            items.push({
              platform: 'mm',
              name: lots.length > 1 ? t('MiniMax 积分 ') + (i + 1) : t('MiniMax 积分'),
              remain: lot.amount || 0,
              size: lot.amount || 0,
              exp: lot.expiresAtMs
            });
          });
        } else if (mm.total > 0) {
          /* No lot list at all: one balance, one known expiry date. */
          items.push({ platform: 'mm', name: t('MiniMax 积分'), remain: mm.total, size: mm.total, exp: mm.expiresAtMs });
        }
      }
      if (data && data.qd && Array.isArray(data.qd.packages)) {
        data.qd.packages.forEach(function (p) {
          items.push({ platform: 'qd', name: p.name || t('Qoder 积分'), remain: p.remain || 0, size: p.size || 0, exp: p.expiresAtMs });
        });
      }
      /* 豆包的「套餐积分」和「活动赠送」都是能花的积分，两者都并进余额合计与侧栏。
         套餐积分随订阅周期刷新，赠送积分到期作废；这里给它们一个到期日用于临期判断，
         但「5 小时」「每周」是限速窗口不是积分余额，仍然排除。 */
      if (data && data.db && Array.isArray(data.db.windows)) {
        data.db.windows.forEach(function (w) {
          if (w && (w.kind === 'incentive' || w.kind === 'package')) {
            items.push({
              platform: 'db', name: w.label || t('活动赠送'), remain: w.remain || 0,
              size: w.size || 0, exp: typeof w.resetsAtMs === 'number' ? w.resetsAtMs : null
            });
          }
        });
      }
      /* A drained pack is not an expiring balance: Trae keeps the account row
         after the credits are spent, and a t('0 · 15天') line reads as if there
         were something left to use. Drop them before anything groups or counts. */
      return items.filter(function (item) { return item.remain > 0; });
    }

    function sumOf(items, key) {
      var total = 0;
      items.forEach(function (item) { total += item[key] || 0; });
      return total;
    }

    /* Group by calendar day, not by exact timestamp: five packages expiring on
       the same date at different hours are one bucket with one countdown. */
    function dayKey(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return 'never';
      var d = new Date(ms);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function bucketize(items) {
      var map = {};
      items.forEach(function (item) {
        var key = dayKey(item.exp);
        if (!map[key]) {
          var exp = key === 'never' ? null : new Date(key + 'T23:59:59').getTime();
          map[key] = { key: key, exp: exp, total: 0, count: 0, byPool: {}, names: [] };
        }
        var bucket = map[key];
        bucket.total += item.remain || 0;
        bucket.count += 1;
        bucket.byPool[item.platform] = (bucket.byPool[item.platform] || 0) + (item.remain || 0);
        if (item.name && bucket.names.indexOf(item.name) < 0) bucket.names.push(item.name);
      });
      var list = Object.keys(map).map(function (k) { return map[k]; });
      list.sort(function (a, b) {
        if (a.exp === null && b.exp === null) return 0;
        if (a.exp === null) return 1;
        if (b.exp === null) return -1;
        return a.exp - b.exp;
      });
      return list;
    }

    /* Which pools contribute to this bucket, in a stable order. */
    function bucketPools(bucket) {
      return BALANCE_ORDER.filter(function (id) { return (bucket.byPool[id] || 0) > 0; });
    }

    /* ---------- burn rate ---------- */

    /* Credits a pool has been spending per day, measured from the platform's
       own credit totals. null when the host has no week of history yet - an
       unknown rate must never render as "0 per day". */
    function burnOf(usage, pool) {
      if (!usage || !usage.burn) return null;
      var v = usage.burn[pool];
      /* A measured zero is information - 'this pool is never used' is exactly
         how a free grant expires untouched - so only a missing number is null. */
      return typeof v === 'number' && isFinite(v) && v >= 0 ? v : null;
    }

    /* Days until `remain` is gone at `burnPerDay`. A single pack shares its
       pool's measured rate in proportion to its balance: the pool figure is
       observed, only the split inside the pool is an assumption. */
    function exhaustIn(remain, burnPerDay) {
      if (!(remain > 0) || !(burnPerDay > 0)) return null;
      return remain / burnPerDay;
    }

    /* Credits back to money, using the rate this pool was actually measured at
       (platform credits per yuan). null when the pool has no priced call yet. */
    function cnyOf(usage, pool, credits) {
      var info = usage && usage.pools ? usage.pools[pool] : null;
      if (!info || !(info.rate > 0)) return null;
      return credits / info.rate;
    }

    /**
     * The number no balance widget shows, and the reason this page exists:
     * how much of today's balance will evaporate before it can be spent.
     *
     * A pack is doomed when its expiry arrives sooner than its own burn would
     * drain it; whatever is left at that moment is wasted. Everything else -
     * "expires in 12 days", "burning 40/day" - is already visible elsewhere.
     */
    function foresee(items, usage) {
      var poolRemain = {};
      items.forEach(function (item) {
        poolRemain[item.platform] = (poolRemain[item.platform] || 0) + (item.remain || 0);
      });
      var rows = [];
      items.forEach(function (item) {
        var days = daysLeft(item.exp);
        if (days === null) return;
        /* Already gone is not 'about to be wasted' - it is gone, and counting it
           here would inflate the one number the reader is meant to act on. */
        if (days < 0) return;
        var poolBurn = burnOf(usage, item.platform);
        var share = poolBurn !== null && poolRemain[item.platform] > 0
          ? poolBurn * (item.remain / poolRemain[item.platform])
          : null;
        var exhaust = exhaustIn(item.remain, share);
        /* Days are calendar days, so today counts as the rest of today rather
           than as nothing: a pack dying at midnight still has hours to spend. */
        var left = days === 0 ? todayLeftFraction() : days;
        /* No measured spend at all means 'unused', which is the worst case for
           an expiring grant, not a safe one. */
        var willWaste = share !== null
          ? (exhaust === null ? item.remain > 0 : exhaust > left)
          : false;
        rows.push({
          item: item,
          days: days,
          burn: share,
          exhaust: exhaust,
          willWaste: willWaste,
          wasted: willWaste ? Math.max(0, item.remain - (share || 0) * left) : 0
        });
      });
      rows.sort(function (a, b) {
        if (b.wasted !== a.wasted) return b.wasted - a.wasted;
        return a.days - b.days;
      });
      return rows;
    }

    /**
     * Burn-down: every pool spends from a balance that does not refill, so the
     * honest question is not "how much is left" but "how many days of ordinary
     * use is that". The line is drawn from today's balance at the measured
     * 7-day burn rate, and it stops at zero - the point where the pool is
     * exhausted - rather than pretending credits regenerate.
     */
    function burndown(usage) {
      if (!usage || !usage.burn) return null;
      var rate = 0;
      var parts = [];
      PLATFORM_ORDER.forEach(function (id) {
        var b = burnOf(usage, id);
        if (b !== null && b > 0) { rate += b; parts.push({ id: id, burn: b }); }
      });
      if (!(rate > 0)) return null;
      return { rate: rate, parts: parts };
    }

    /* A cycle countdown in the sidebar's terms: days, because "12 天后重置" is a
       decision and "1796054400000" is not. */
    function resetLabel(ms) {
      var days = daysLeft(ms);
      if (days === null) return null;
      if (days < 0) return t('已过重置日');
      if (days === 0) return t('今天重置');
      return days + t(' 天后重置');
    }

    function byPlatform(items) {
      return BALANCE_ORDER.map(function (id) {
        var mine = items.filter(function (item) { return item.platform === id; });
        var byLevel = {};
        mine.forEach(function (item) {
          var lv = levelOf(item.exp);
          byLevel[lv] = (byLevel[lv] || 0) + (item.remain || 0);
        });
        return { id: id, items: mine, total: sumOf(mine, 'remain'), byLevel: byLevel, buckets: bucketize(mine) };
      });
    }

    /* ---------- data ---------- */

    /* One payload for every surface. The sidebar row and the full page mount
       together, and with a hook-local fetch each of them polls the host on its
       own timer: four upstream calls every two minutes become eight, and the
       page reopening after the row already fetched just starts a third copy.
       One store, one in-flight request, one backoff clock. */
    var store = {
      state: { data: null, error: null, loading: true },
      subs: [],
      busy: false,
      fails: 0,
      nextAt: 0,
      at: 0,
    };

    function storeEmit(next) {
      store.state = next;
      store.subs.slice().forEach(function (fn) {
        fn(next);
      });
    }

    function storeSubscribe(fn) {
      store.subs.push(fn);
      return function () {
        var i = store.subs.indexOf(fn);
        if (i >= 0) store.subs.splice(i, 1);
      };
    }

    function loadShared(force) {
      if (store.busy) return;
      if (store.nextAt && Date.now() < store.nextAt && !force) return;
      /* The poll interval is a preference, so the timer only ticks: whether
         this tick is due is decided here, against the interval in force now. */
      if (!force && store.at && Date.now() - store.at < PREFS.refreshMs) return;
      store.busy = true;
      if (!store.state.loading) {
        storeEmit({ data: store.state.data, error: store.state.error, loading: true });
      }
      fetch(API, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          store.busy = false;
          store.fails = 0;
          store.nextAt = 0;
          store.at = Date.now();
          storeEmit({ data: data, error: null, loading: false });
        })
        .catch(function (err) {
          store.busy = false;
          store.fails += 1;
          /* Back off instead of retrying a dead host every two minutes: one
             interval, then two, then four, capped at ten minutes. */
          store.at = Date.now();
          var wait = PREFS.refreshMs * Math.pow(2, Math.min(store.fails - 1, 3));
          store.nextAt = Date.now() + Math.min(wait, 600000);
          /* Keep the last good payload on screen: a two-second hiccup must not
             blank the numbers, and the stale stamp is what tells the reader
             how old they are. */
          storeEmit({
            data: store.state.data,
            error: String((err && err.message) || err),
            loading: false,
          });
        });
    }

    /* A click means the reader does not believe the numbers: it has to skip the
       backoff, or a failed poll would swallow the only retry they can ask for. */
    function refreshNow() {
      store.nextAt = 0;
      loadShared(true);
    }

    function useData() {
      var pair = React.useState(store.state);
      var setState = pair[1];

      React.useEffect(function () {
        var off = storeSubscribe(setState);
        setState(store.state);
        loadShared();
        var timer = setInterval(function () { loadShared(false); }, 15000);
        return function () {
          off();
          clearInterval(timer);
        };
      }, []);

      return [pair[0], refreshNow];
    }

    /**
     * Version beacon. The host caches the published index for six hours, so this
     * is one cheap same-origin call per page mount, never a GitHub request from
     * the browser. A failure only costs the version line, never the panel.
     */
    function useUpdate() {
      var pair = React.useState(null);
      var info = pair[0];
      var setInfo = pair[1];
      var busyPair = React.useState(false);
      var busy = busyPair[0];
      var setBusy = busyPair[1];
      var alive = React.useRef(true);

      var load = React.useCallback(function (force) {
        setBusy(true);
        fetch(UPDATE_API + (force ? '?force=1' : ''), { headers: { accept: 'application/json' }, credentials: 'same-origin' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (data) {
            if (!alive.current) return;
            setInfo(data);
            setBusy(false);
          })
          .catch(function () {
            if (!alive.current) return;
            setBusy(false);
          });
      }, []);

      React.useEffect(function () {
        alive.current = true;
        load(false);
        return function () { alive.current = false; };
      }, []);

      return [info, busy, load];
    }

    /* ---------- shared bits ---------- */

    function Dot(props) {
      return h('span', {
        style: {
          display: 'inline-block',
          width: props.size || 6,
          height: props.size || 6,
          borderRadius: '50%',
          background: props.color,
          flex: 'none',
          marginRight: props.gap === undefined ? 6 : props.gap
        }
      });
    }

    function Track(props) {
      var parts = (props.parts || []).filter(function (p) { return p.value > 0; });
      var total = 0;
      parts.forEach(function (p) { total += p.value; });
      if (!total) return h('div', { style: { height: props.height || 6, borderRadius: 3, background: C.soft } });
      return h('div', {
        className: 'cxe-track',
        style: {
          display: 'flex',
          height: props.height || 6,
          borderRadius: 3,
          overflow: 'hidden',
          background: C.soft,
          gap: 1
        }
      }, parts.map(function (p, i) {
        return h('div', {
          key: p.key || String(i),
          title: p.title || '',
          /* The stagger reads as the bar filling from the platform with the most
             credits, which is also the reading order below it. */
          style: { width: (p.value / total * 100) + '%', background: p.color, flex: 'none', animationDelay: (i * 70) + 'ms' }
        });
      }));
    }

    function RefreshButton(props) {
      return h('button', {
        type: 'button',
        onClick: props.onClick,
        title: t('刷新'),
        style: {
          border: '1px solid ' + C.line,
          background: 'transparent',
          color: C.dim,
          borderRadius: 6,
          width: 26,
          height: 26,
          cursor: 'pointer',
          fontSize: 13,
          lineHeight: 1,
          flex: 'none'
        }
      }, h('span', { className: props.spinning ? 'cxe-spin' : '' }, props.spinning ? '↻' : '↻'));
    }

    /* Every block borrows its own platform tint, so the page reads as a set
       of softly coloured cards instead of one white sheet. Generic blocks
       use WorkBuddy purple as the neutral accent. */
    /* 只有真正属于某个平台的区块才上对应平台色；其余是跨平台通用区块，
       一律用中性淡灰底，避免整页发紫影响阅读（设置页没有 id，也走淡灰）。 */
    var SECTION_PLATFORM = {
      doubao: 'db', codex: 'cx', modelscope: 'ms'
    };

    function Section(props) {
      /* A block hidden in the settings page must not cost a render, and its
         header button would otherwise stay clickable while invisible. */
      if (props.id && !showSection(props.id)) return null;
      var pid = SECTION_PLATFORM[props.id || props.tone] || null;
      var meta = pid ? PLATFORM[pid] : null;
      /* 卡片一律是“白纸 + 细边”，页面本身是灰的，靠底色差分层，
         而不是每块都套一层灰底——那样整页看着像没排版。 */
      var background = C.bg;
      var border = C.line;
      var showIcon = props.icon === true && !!meta;
      return h('section', {
        /* An in-page anchor for the long usage tab; scrollMarginTop keeps the
           sticky tab bar from covering the title after a jump. */
        id: props.anchor ? 'cxe-sec-' + props.anchor : undefined,
        style: {
          /* Spacing comes from the density switch on the panel root; the
             fallbacks are the 0.11.0 values so a missing variable changes nothing. */
          marginTop: 'var(--cxe-gap, 20px)',
          padding: 'var(--cxe-pad, 16px 18px)',
          scrollMarginTop: 64,
          background: background,
          border: '1px solid ' + border,
          borderRadius: 12
        }
      },
        /* A one-word zone label above the card title: the overview is three
           blocks, and without this the three cards look like the old stack. */
        props.eyebrow
          ? h('div', { style: { fontSize: 10, fontWeight: 600, color: C.faint, letterSpacing: 0.8, marginBottom: 5 } }, props.eyebrow)
          : null,
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: 0.1 } },
            showIcon ? PlatformIcon({ id: pid, size: 14, gap: 2 }) : null,
            props.title
          ),
          props.extra || null
        ),
        props.children
      );
    }

    /* ---------- shared atoms ---------- */

    /* A one-line chip used by every filter bar below. Hookless on purpose: it is
       called from inside components that already own their state. */
    function Chip(props) {
      return h('button', {
        type: 'button',
        className: 'cxe-chip',
        'aria-pressed': props.on ? 'true' : 'false',
        title: props.title || '',
        onClick: props.onClick
      }, props.label);
    }

    /* Model families for the merge view. An explicit list rather than a generic
       prefix split: platform aliases and cache suffixes do not follow one naming
       convention, and a wrong guess would silently move someone's spend into the
       wrong family. Anything unrecognised stays as its own "other" row. */
    var MODEL_FAMILIES = [
      { id: 'claude', label: 'Claude', test: /claude|anthropic/i },
      { id: 'gpt', label: 'GPT', test: /^(gpt|o[134]|chatgpt|codex)/i },
      { id: 'gemini', label: 'Gemini', test: /gemini|gemma/i },
      { id: 'deepseek', label: 'DeepSeek', test: /deepseek/i },
      { id: 'qwen', label: 'Qwen', test: /qwen|qwq/i },
      { id: 'glm', label: 'GLM', test: /glm|chatglm|zhipu/i },
      { id: 'kimi', label: 'Kimi', test: /kimi|moonshot/i },
      { id: 'minimax', label: 'MiniMax', test: /minimax|abab/i },
      { id: 'doubao', label: 'Doubao', test: /doubao|seed|skylark/i },
      { id: 'llama', label: 'Llama', test: /llama/i },
      { id: 'mistral', label: 'Mistral', test: /mistral|mixtral/i },
      { id: 'grok', label: 'Grok', test: /grok/i }
    ];

    function familyOf(model) {
      var name = String(model || '');
      for (var i = 0; i < MODEL_FAMILIES.length; i += 1) {
        if (MODEL_FAMILIES[i].test.test(name)) return MODEL_FAMILIES[i];
      }
      return { id: 'other', label: t('其他模型') };
    }

    /* Fold per-model rows into one row per family for the merge view. The pool
       shown is the one that spent the most inside the family, so the row keeps a
       real platform icon instead of a synthetic one. */
    function mergeProviders(list) {
      var map = {};
      var order = [];
      list.forEach(function (p) {
        var fam = familyOf(p.model);
        var row = map[fam.id];
        if (!row) {
          row = map[fam.id] = {
            key: 'fam:' + fam.id,
            provider: p.provider,
            family: fam.label,
            model: fam.label,
            calls: 0, tokens: 0, credits: 0, costCny: 0,
            inputTokens: 0, cacheReadTokens: 0,
            free: true, priced: true, models: 0, top: 0
          };
          order.push(row);
        }
        row.calls += p.calls || 0;
        row.tokens += p.tokens || 0;
        row.credits += p.credits || 0;
        row.costCny += p.costCny || 0;
        row.inputTokens += p.inputTokens || 0;
        row.cacheReadTokens += p.cacheReadTokens || 0;
        row.free = row.free && !!p.free;
        row.priced = row.priced && !!p.priced;
        if ((p.credits || 0) > row.top) { row.top = p.credits || 0; row.provider = p.provider; }
        row.models += 1;
      });
      order.forEach(function (row) {
        row.model = row.family + t(' · 含 ') + row.models + t(' 个模型');
      });
      order.sort(function (a, b) { return (b.credits || 0) - (a.credits || 0); });
      return order;
    }

    /* Session tags are a browser-side annotation, not data: the host never learns
       about them, and a session that scrolls out of the window takes its tag with
       it. The section says so instead of pretending the tag is permanent. */
    var TAGS_KEY = 'dsh-credit-expiry:tags';

    function readTags() {
      try {
        var raw = window.localStorage.getItem(TAGS_KEY);
        var parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (e) { return {}; }
    }

    function writeTags(map) {
      try { window.localStorage.setItem(TAGS_KEY, JSON.stringify(map)); } catch (e) { /* private mode */ }
    }

    /* A pure sparkline: no axes, no tooltip, legible at 34x12 in the sidebar.
       A short history simply draws fewer points rather than a fake decline. */
    function Sparkline(props) {
      var values = (props.values || []).map(function (v) { return Number(v) || 0; });
      if (values.length < 2) return null;
      /* Callers that draw several rows side by side pass one shared max: with a
         per-row scale a 500-credit day looks steeper than a 3,020-credit day. */
      var shared = Number(props.max) || 0;
      var max = shared > 0 ? shared : 1;
      if (!(shared > 0)) values.forEach(function (v) { if (v > max) max = v; });
      var w = props.width || 34;
      var hh = props.height || 12;
      var step = w / (values.length - 1);
      var pts = values.map(function (v, i) {
        return [i * step, hh - (v / max) * (hh - 3) - 1.5];
      });
      var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      /* stretch: fill the caller's row. The viewBox keeps the geometry honest and
         a non-scaling stroke keeps the line one hairline at any width. */
      return h('svg', {
        viewBox: '0 0 ' + w + ' ' + hh,
        width: props.stretch ? '100%' : w,
        height: hh,
        preserveAspectRatio: 'none',
        style: { display: 'block', overflow: 'visible', width: props.stretch ? '100%' : w },
        'aria-hidden': 'true'
      },
        h('path', {
          /* var() 只在 CSS 里展开，写成 SVG 属性浏览器直接忽略（线就消失了），
             所以颜色走 style。 */
          d: line, style: { stroke: props.color || C.dim, fill: 'none' }, strokeWidth: 1.4,
          strokeLinejoin: 'round', strokeLinecap: 'round',
          vectorEffect: 'non-scaling-stroke'
        })
      );
    }

    /* One shared "search + filter" strip so the two lists cannot drift apart in
       behaviour: same chip order, same truncation note, same layout. */
    function FilterStrip(props) {
      return h('div', {
        className: 'cxe-noprint',
        style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }
      },
        props.onQuery ? h('input', {
          type: 'search',
          value: props.query,
          placeholder: props.placeholder,
          'aria-label': props.placeholder,
          onChange: function (e) { props.onQuery(e.target.value); },
          style: {
            flex: '1 1 150px', minWidth: 120, boxSizing: 'border-box',
            padding: '4px 8px', fontSize: 11, borderRadius: 6,
            border: '1px solid ' + C.line, background: 'transparent', color: C.text, outline: 'none'
          }
        }) : null,
        props.children || null
      );
    }

    function MoneyNote(props) {
      var note = { fontSize: 11, color: C.dim, whiteSpace: 'nowrap' };
      if (props.free) {
        return h('span', { style: note }, t('免费模型'));
      }
      if (props.unpriced) {
        return h('span', { style: note }, t('无公开价'));
      }
      var cost = props.costCny;
      /* 0 和「算不出来」不是一回事，但两者都显示成 ≈¥0.00 会让人以为真的不花钱；
         小于一分的成本统一写成明确的下限。 */
      if (typeof cost !== 'number' || !isFinite(cost) || !(cost > 0)) {
        return h('span', { style: note }, '—');
      }
      if (cost < 0.01) {
        return h('span', { style: note }, '<¥0.01');
      }
      return h('span', { style: { fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } }, '≈¥' + fmtPrecise(cost));
    }

    function makeVendorLabel() { return { deepseek: 'DeepSeek', zhipu: t('智谱'), minimax: 'MiniMax' }; }
    function makeCatalogNote() { return t('目录（models.dev）'); }
    var VENDOR_LABEL = makeVendorLabel();
    var CATALOG_NOTE = makeCatalogNote();

    /**
     * Where the money figure came from. Nothing here is a magic constant any
     * more: each call pays its vendor's own list price, split by token kind
     * (fresh input / cache hit / output), and DeepSeek charges twice as much
     * inside its peak windows, so the split is part of the answer.
     */
    function PricingNote(props) {
      var usage = props.usage;
      if (!usage || !usage.pricing) return t('金额按各模型官方 token 单价估算（含缓存命中价）。');
      var pricing = usage.pricing;
      var vendors = (pricing.vendors || []).map(function (v) { return VENDOR_LABEL[v] || v; });
      /* Every vendor names its own origin: 'official, all three live' while one
         page failed and fell back to a cached number is exactly the quiet lie
         the money column must not tell. */
      var originOf = pricing.vendorSource || null;
      var ORIGIN_TEXT = { live: t('官网实时'), cache: t('上次成功抓取'), bundled: t('内置快照') };
      var stamped = originOf
        ? Object.keys(originOf).map(function (v) { return (VENDOR_LABEL[v] || v) + ' ' + (ORIGIN_TEXT[originOf[v]] || originOf[v]); }).join(' / ')
        : vendors.join(' / ');
      var source = pricing.live
        ? t('官方价目 · ') + stamped
        : (pricing.fetchedAt ? t('缓存价目（') + stamped + t('）') : t('内置价目（尚未联网抓取）'));
      var when = pricing.fetchedAt ? t(' · 抓取于 ') + fmtFull(pricing.fetchedAt) : '';
      var pools = usage.pools || {};
      var rates = [];
      PLATFORM_ORDER.forEach(function (id) {
        if (!(id in pools)) return;
        var pool = pools[id];
        if (!pool || !(pool.rate > 0) || pool.estimated) return;
        rates.push(PLATFORM[id].short + ' ' + (pool.rate).toFixed(2) + t(' 分/元'));
      });
      var estimated = PLATFORM_ORDER.filter(function (id) {
        var pool = pools[id];
        return pool && pool.estimated;
      }).map(function (id) { return PLATFORM[id].short; });
      var rateText = rates.length
        ? t(' 积分按各平台自己的消耗数分摊到模型（') + rates.join(t('，')) + t('）。')
        : ' ';
      if (estimated.length) {
        rateText += estimated.join(t('、')) + t(' 未返回消耗数，该平台的积分分摊与金额换算不可用，只统计 token。');
      }
      var catalog = pricing.catalog || null;
      var fx = pricing.fx || null;
      /* The three vendor pages only cover three vendors; every other model in
         the ledger is priced from the models.dev catalogue, so the note has to
         say so - t('官方价目') alone would overstate what was read. */
      var catalogText = '';
      if (catalog && catalog.rows > 0) {
        catalogText = t(' 其余模型取自 ') + CATALOG_NOTE + t('（') + fmtAmount(catalog.rows) + t(' 条，')
          + (catalog.live ? t('本次联网抓到') : t('上次抓取留存')) + t('）');
        if (fx && fx.rate > 0) {
          catalogText += t('，美元价按 1 USD = ') + fx.rate.toFixed(3) + t(' CNY 换算')
            + (fx.live ? '' : t('（内置汇率，未取到实时报价）'));
        }
        catalogText += t('。');
      }
      var parts = [t('金额按各模型官方 token 单价估算（分输入、缓存命中、输出三档），') + source + when + t('。') + rateText + catalogText];
      if (pricing.missing && pricing.missing.length) {
        parts.push(t('没有公开价的模型（') + pricing.missing.join(t('、')) + t('）只计 token，不计金额。'));
        parts.push(t('无公开价多见于平台内部模型别名（例如 Qoder 的 dfmodel / qmodel_latest）：调用真实存在，只是公开价目表查不到对应单价，不是识别错误。'));
      }
      return parts.join('');
    }

    /**
     * The other WorkBuddy accounts. Their credits expire on the same cliff as the
     * selected one but are invisible everywhere else, so a pool that is silently
     * draining is exactly the sort of loss this page is supposed to prevent.
     */
    function AccountPool(props) {
      var data = props.data;
      var accounts = data && data.wb && Array.isArray(data.wb.accounts) ? data.wb.accounts : [];
      if (!accounts.length) return null;
      var total = 0;
      accounts.forEach(function (a) { total += a.credits || 0; });
      return Section({
        title: t('WorkBuddy 其他账号'),
        extra: h('span', { style: { fontSize: 10, color: C.faint } }, accounts.length + t(' 个 · 共 ') + fmtAmount(total) + t(' 积分')),
        children: h('div', { style: { display: 'grid', gap: 6 } }, accounts.map(function (a, i) {
          var days = daysLeft(a.expiresAtMs);
          return h('div', {
            key: (a.name || '') + i,
            style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid ' + C.line, borderRadius: R.sm }
          },
            h('span', { style: { flex: 1, minWidth: 0, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.name || t('未命名账号')),
            h('span', { style: { fontSize: 11, color: C.faint } }, a.expiresAtMs ? fmtDate(a.expiresAtMs) : '—'),
            h('span', { style: { width: 46, textAlign: 'right', fontSize: 11, color: days === null ? C.faint : levelColor(levelOf(a.expiresAtMs)) } },
              days === null ? '' : countdownLabel(days)),
            h('span', { style: { width: 74, textAlign: 'right', fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(a.credits))
          );
        }))
      });
    }

    /**
     * Logins expire too. When they do, every pool in this page fails at once and
     * looks like an outage; naming the date turns that into a known deadline.
     */
    function CredentialLine(props) {
      var data = props.data;
      var rows = [];
      if (data && data.wb && data.wb.tokenExpiresAtMs) rows.push({ id: 'wb', exp: data.wb.tokenExpiresAtMs, note: t('登录') });
      if (data && data.tr && data.tr.tokenExpiresAtMs) rows.push({ id: 'tr', exp: data.tr.tokenExpiresAtMs, note: t('访问令牌') });
      if (data && data.tr && data.tr.refreshExpiresAtMs) rows.push({ id: 'tr', exp: data.tr.refreshExpiresAtMs, note: t('刷新令牌') });
      if (!rows.length) return null;
      var soon = rows.filter(function (r) { var d = daysLeft(r.exp); return d !== null && d <= ACTIVE.l30; });
      if (!soon.length) return null;
      return h('div', {
        style: {
          marginTop: 16, padding: '9px 12px', borderRadius: 8, fontSize: 11,
          color: C.orange, border: '1px solid ' + C.line, background: 'rgba(249,115,22,0.08)'
        }
      }, t('登录凭据快到期：') + soon.map(function (r) {
        return PLATFORM[r.id].label + ' ' + r.note + ' ' + fmtDate(r.exp) + t('（') + countdownLabel(daysLeft(r.exp)) + t('）');
      }).join(t('；')) + t('。过期后这一栏会整片读取失败。'));
    }

    /**
     * One line about the installed build: its version, and whether a newer one
     * is published. Silent when the index is unreachable - a version check that
     * cannot reach the network must not invent an error banner.
     */
    function VersionLine(props) {
      var info = props.info;
      var busy = props.busy;
      var onRecheck = props.onRecheck;
      var current = info && info.current ? info.current : null;
      var hasUpdate = !!(info && info.hasUpdate && info.latest);
      var label = current ? 'v' + current : 'v—';
      var tail = null;
      if (hasUpdate) {
        tail = h('span', { style: { color: C.green } }, t(' · 有新版本 v') + info.latest + t('，去 Releases 看看'));
      } else if (info && info.latest) {
        tail = h('span', { style: { color: C.faint } }, t(' · 已是最新'));
      } else if (info && info.error) {
        tail = h('span', { style: { color: C.faint } }, t(' · 无法检查更新'));
      } else if (busy) {
        tail = h('span', { style: { color: C.faint } }, t(' · 检查中'));
      }
      return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.faint } },
        h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, label),
        tail,
        onRecheck ? h('button', {
          type: 'button',
          onClick: onRecheck,
          disabled: busy,
          title: t('重新检查更新'),
          style: {
            border: '1px solid ' + C.line,
            background: 'transparent',
            color: busy ? C.faint : C.dim,
            borderRadius: 4,
            padding: '0 5px',
            fontSize: 10,
            lineHeight: '15px',
            cursor: busy ? 'default' : 'pointer',
            margin: 0
          }
        }, busy ? '…' : t('检查')) : null
      );
    }

    /**
     * Peak and idle are not a curiosity: DeepSeek bills peak tokens at exactly
     * twice the idle rate, so the same token count costs double inside the
     * windows. Showing the split explains why the money column moves on days
     * with identical volume.
     */
    /* Usage analytics: one component owns its controls so switching chart type,
       metric, grouping or window never changes a parent's hook count. */
    function StatsView(props) {
      var usage = props.usage;
      var metricPair = React.useState('credits');
      var metric = metricPair[0], setMetric = metricPair[1];
      var typePair = React.useState('bar');
      var type = typePair[0], setType = typePair[1];
      var daysPair = React.useState(14);
      var days = daysPair[0], setDays = daysPair[1];
      /* Which platforms the reader switched off in the shared legend. Hidden ids
         are dropped from all three chart types, so a small pool can be read
         beside a big one instead of vanishing under it. */
      var hidePair = React.useState({});
      var hiddenMap = hidePair[0], setHiddenMap = hidePair[1];
      function isHidden(id) {
        return !!(hiddenMap && hiddenMap[id]);
      }
      function toggleHidden(id) {
        var next = {};
        Object.keys(hiddenMap || {}).forEach(function (k) { next[k] = hiddenMap[k]; });
        next[id] = !next[id];
        setHiddenMap(next);
      }
      var all = usage && Array.isArray(usage.daily) ? usage.daily : [];
      var rows = all.slice(-days);
      function valueOf(r) {
        return metric === 'credits' ? (r.credits || 0) : metric === 'tokens' ? (r.tokens || 0) : (r.calls || 0);
      }
      function fmtV(n) {
        return metric === 'credits' ? fmtAmount(n) : metric === 'tokens' ? fmtCompact(n) : String(Math.round(n));
      }
      var totalRows = 0;
      rows.forEach(function (r) { totalRows += valueOf(r); });
      var max = 1;
      rows.forEach(function (r) { if (valueOf(r) > max) max = valueOf(r); });
      function barStack(r) {
        var ids = PLATFORM_ORDER.filter(function (id) { return metricOf(r, id) > 0 && !isHidden(id); });
        if (ids.length) return ids;
        var someHidden = PLATFORM_ORDER.some(function (id) { return metricOf(r, id) > 0 && isHidden(id); });
        if (someHidden) return [];
        return valueOf(r) > 0 ? ['__all'] : [];
      }
      function xLabels() {
        return h('div', { style: { display: 'flex', gap: 3, marginTop: 4 } }, rows.map(function (r, i) {
          var show = rows.length <= 10 || i % 2 === 0;
          return h('div', { key: r.date, style: { flex: 1, textAlign: 'center', fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' } }, show ? r.date.slice(5) : '');
        }));
      }
      function yAxis() {
        return h('div', { style: { width: 42, flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', height: 110, paddingRight: 6, fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
          h('span', null, fmtV(max)),
          h('span', null, fmtV(max / 2)),
          h('span', null, '0')
        );
      }
      function renderBar() {
        return h('div', null,
          h('div', { style: { display: 'flex', height: 110 } },
          yAxis(),
          h('div', {
            style: {
              flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, height: 110,
              borderBottom: '1px solid ' + C.line,
              /* 一条极淡的 50% 参考线，柱子高度才有量感可依 */
              backgroundImage: 'linear-gradient(to top, ' + C.line + ' 1px, transparent 1px)',
              backgroundSize: '100% 55px',
              backgroundPosition: '0 0'
            }
          },
            rows.map(function (r) {
              var px = Math.max(2, Math.round(valueOf(r) / max * 104));
              var stack = barStack(r);
              var bp = r.byPool || {};
              return h('div', {
                key: r.date,
                title: r.date + ' · ' + fmtV(valueOf(r)),
                style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }
              },
                h('div', { style: { width: '100%', height: px, display: 'flex', flexDirection: 'column-reverse', borderRadius: '3px 3px 0 0', overflow: 'hidden' } },
                  stack.length ? null : h('div', { style: { height: '100%', background: C.line } }),
                  stack.map(function (id) {
                    var part = id === '__all' ? valueOf(r) : metricOf(r, id);
                    return h('div', {
                      key: id,
                      title: (id === '__all' ? t('合计') : PLATFORM[id].label) + ' ' + fmtV(part),
                      style: { width: '100%', height: (part / (valueOf(r) || 1) * 100) + '%', background: id === '__all' ? PLATFORM.wb.color : PLATFORM[id].color }
                    });
                  })
                )
              );
            })
          )
          ),
          xLabels()
        );
      }
      /* 一条平台一条折线，颜色和该平台一致；渐变用同色但压到很淡，
         不再所有线都是紫色。credits/token/次数三种指标都按平台拆。 */
      function metricOf(r, pid) {
        var tokens = pid ? ((r.byPoolTokens || {})[pid] || 0) : 0;
        var calls = pid ? ((r.byPoolCalls || {})[pid] || 0) : 0;
        if (metric === 'credits') return pid ? ((r.byPool || {})[pid] || 0) : (r.credits || 0);
        if (metric === 'tokens') return pid ? tokens : (r.tokens || 0);
        return pid ? calls : (r.calls || 0);
      }
      function renderLine() {
        var W = 600, H = 110, pad = 6;
        var ids = PLATFORM_ORDER.filter(function (id) {
          return !isHidden(id) && rows.some(function (r) { return metricOf(r, id) > 0; });
        });
        if (!ids.length) {
          if (PLATFORM_ORDER.some(function (id) { return isHidden(id); })) {
            return h('div', { style: { fontSize: 11, color: C.faint, padding: '10px 0' } }, t('平台都隐藏了，点上面的图例恢复'));
          }
          ids = ['__all'];
        }
        var series = ids.map(function (id) {
          var pts = rows.map(function (r, i) {
            var x = rows.length > 1 ? pad + i * (W - 2 * pad) / (rows.length - 1) : W / 2;
            var y = H - pad - (metricOf(r, id === '__all' ? null : id) / max) * (H - 2 * pad);
            return [x, y];
          });
          var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
          var area = line + ' L' + (pts.length ? pts[pts.length - 1][0].toFixed(1) : '0') + ' ' + (H - pad) + ' L' + (pts.length ? pts[0][0].toFixed(1) : '0') + ' ' + (H - pad) + ' Z';
          return { id: id, color: id === '__all' ? PLATFORM.wb.color : PLATFORM[id].color, pts: pts, line: line, area: area };
        });
        return h('div', null,
          h('div', { style: { display: 'flex', height: 110 } },
            yAxis(),
            h('svg', {
              viewBox: '0 0 ' + W + ' ' + H,
              style: {
                flex: 1, width: '100%', height: 110,
                borderBottom: '1px solid ' + C.line
              }
            },
              h('defs', null, series.map(function (s) {
                var gid = 'usage-area-grad-' + s.id;
                return h('linearGradient', { key: s.id, id: gid, x1: '0', y1: '0', x2: '0', y2: '1' },
                  h('stop', { offset: '0%', stopColor: s.color, stopOpacity: 0.26 }),
                  h('stop', { offset: '100%', stopColor: s.color, stopOpacity: 0 })
                );
              })),
              series.map(function (s) {
                return h('g', { key: s.id },
                  h('path', { d: s.area, fill: 'url(#usage-area-grad-' + s.id + ')', stroke: 'none' }),
                  h('path', { d: s.line, fill: 'none', stroke: s.color, strokeWidth: 2, strokeLinejoin: 'round' }),
                  s.pts.map(function (p, i) {
                    var day = rows[i] || {};
                    return h('circle', {
                      key: i, cx: p[0], cy: p[1], r: 2.2, fill: s.color
                    },
                      h('title', null, (day.date || '') + ' · ' + (PLATFORM[s.id] ? PLATFORM[s.id].label : t('合计'))
                        + ' ' + fmtV(s.id === '__all' ? valueOf(day) : metricOf(day, s.id))));
                  })
                );
              })
            )
          ),
          xLabels()
        );
      }
      function renderPie() {
        /* The same window the bars and the line use. Reading the whole ledger
           here made the three charts disagree on one selection. */
        var pools = {};
        rows.forEach(function (r) {
          PLATFORM_ORDER.forEach(function (pid) {
            var v = metricOf(r, pid);
            if (v > 0 && !isHidden(pid)) pools[pid] = (pools[pid] || 0) + v;
          });
        });
        var parts = Object.keys(pools).map(function (id) { return { id: id, v: pools[id] }; }).filter(function (x) { return x.v > 0; });
        parts.sort(function (a, b) { return b.v - a.v; });
        var sum = parts.reduce(function (s, x) { return s + x.v; }, 0);
        if (!sum) return h('div', { style: { fontSize: 11, color: C.faint } }, t('暂无消耗数据'));
        var R = 46, cx = 60, cy = 60, a0 = -Math.PI / 2;
        var slices = parts.map(function (x) {
          var a1 = a0 + (x.v / sum) * Math.PI * 2;
          var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
          var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
          var large = (a1 - a0) > Math.PI ? 1 : 0;
          var d = 'M ' + cx + ' ' + cy + ' L ' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A ' + R + ' ' + R + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z';
          var color = PLATFORM[x.id] ? PLATFORM[x.id].color : PLATFORM.wb.color;
          a0 = a1;
          return h('path', { key: x.id, d: d, style: { fill: color, stroke: C.bg }, strokeWidth: 1 },
            h('title', null, (PLATFORM[x.id] ? PLATFORM[x.id].label : x.id) + ' · ' + fmtV(x.v)
              + ' · ' + Math.round(x.v / (sum || 1) * 100) + '%'));
        });
        return h('div', { style: { display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' } },
          h('svg', { viewBox: '0 0 120 120', style: { width: 120, height: 120 } }, slices),
          h('div', { style: { display: 'grid', gap: 5, fontSize: 10 } }, parts.map(function (x) {
            var meta = PLATFORM[x.id];
            return h('div', { key: x.id, style: { display: 'flex', alignItems: 'center', gap: 6 } },
              Dot({ color: meta ? meta.color : PLATFORM.wb.color, size: 6 }),
              h('span', { style: { color: C.dim, minWidth: 70 } }, meta ? meta.label : x.id),
              h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.text } }, fmtV(x.v), ' · ', Math.round(x.v / sum * 100) + '%')
            );
          }))
        );
      }
      /* One legend, shared by the bars, the line and the pie: colour means
         platform, and clicking a chip takes that platform out of the chart. */
      function legendRow() {
        var ids = PLATFORM_ORDER.filter(function (id) {
          return rows.some(function (r) { return metricOf(r, id) > 0; });
        });
        if (!ids.length) return null;
        return h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 } },
          ids.map(function (id) {
            var meta = PLATFORM[id];
            var off = isHidden(id);
            return h('button', {
              key: id,
              type: 'button',
              title: (off ? t('点一下显示 ') : t('点一下隐藏 ')) + meta.label,
              onClick: function () { toggleHidden(id); },
              style: {
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px',
                borderRadius: 999, cursor: 'pointer', fontSize: 11,
                border: '1px solid ' + (off ? C.line : 'transparent'),
                background: off ? 'transparent' : meta.tint,
                color: off ? C.faint : C.dim,
                textDecoration: off ? 'line-through' : 'none'
              }
            }, Dot({ color: meta.color, size: 7, gap: 0 }), meta.label);
          })
        );
      }
      return h('div', null,
        h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 } },
          h('span', { style: { fontSize: 10, color: C.faint } }, t('指标')),
          h(ChoiceRow, { value: metric, options: [{ value: 'credits', label: t('积分') }, { value: 'tokens', label: 'token' }, { value: 'calls', label: t('调用次数') }], onPick: setMetric }),
          h('span', { style: { fontSize: 10, color: C.faint } }, t('图表')),
          h(ChoiceRow, { value: type, options: [{ value: 'bar', label: t('柱状图') }, { value: 'line', label: t('折线图') }, { value: 'pie', label: t('饼图') }], onPick: setType }),
          h('span', { style: { fontSize: 10, color: C.faint } }, t('时间范围')),
          h(ChoiceRow, { value: days, options: [{ value: 7, label: t('近 7 天') }, { value: 14, label: t('近 14 天') }, { value: 30, label: t('近 30 天') }], onPick: setDays })
        ),
        legendRow(),
        !rows.length ? h('div', { style: { fontSize: 11, color: C.faint } }, t('暂无消耗数据')) :
          type === 'line' ? renderLine() : type === 'pie' ? renderPie() : renderBar(),
        h('div', { style: { marginTop: 6, fontSize: 10, color: C.faint } },
          t('合计 ') + fmtV(totalRows) + t(' · 数据覆盖 ') + all.length + t(' 天')
            + (all.length < days ? t('（窗口内不足的天数没有数据）') : ''))
      );
    }

    function PeakSplit(props) {
      var peak = props.peak || {};
      var peakTokens = peak.peakTokens || 0;
      var idleTokens = peak.idleTokens || 0;
      var sum = peakTokens + idleTokens;
      if (!sum) return null;
      var peakPct = Math.round(peakTokens / sum * 100);
      var windows = (peak.windows || []).map(function (w) { return w[0] + ':00-' + w[1] + ':00'; }).join(t('、'));
      /* Inside its own card the wrapper border would double up with the
         section's own edge, so bare mode keeps the diagram and drops the box. */
      var bare = props.bare === true;
      return h('div', { style: bare ? { minWidth: 0 } : { marginTop: 12, padding: '12px 14px', border: '1px solid ' + C.line, borderRadius: 10 } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 } },
          bare ? null : h('span', { style: { fontSize: 11, color: C.dim } }, t('峰谷用量')),
          h('span', { style: { fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
            t('高峰 ') + peakPct + t('% · 空闲 ') + (100 - peakPct) + '%')
        ),
        h('div', { style: { display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: C.soft } },
          h('div', { style: { width: peakPct + '%', background: C.orange } }),
          h('div', { style: { width: (100 - peakPct) + '%', background: C.green } })
        ),
        h('div', { style: { display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: C.dim, flexWrap: 'wrap' } },
          h('span', { style: { display: 'flex', alignItems: 'center' } }, Dot({ color: C.orange, size: 5 }), t('高峰 ') + fmtCompact(peakTokens) + ' tok'),
          h('span', { style: { display: 'flex', alignItems: 'center' } }, Dot({ color: C.green, size: 5 }), t('空闲 ') + fmtCompact(idleTokens) + ' tok')
        ),
        h('div', { style: { marginTop: 6, fontSize: 10, color: C.faint, lineHeight: '15px' } },
          t('高峰 = 北京时间工作日 ') + (windows || t('9:00-12:00、14:00-18:00')) + t('（法定节假日除外的全天空闲），DeepSeek 高峰价是空闲价的 2 倍；智谱与 MiniMax 不分峰谷。'))
      );
    }

    /* ---------- left sidebar row (compact) ---------- */

    function QuotaWindowRow(props) {
      var w = props.w || {};
      var pct = Math.max(0, Math.min(100, Number(w.remainingPercent) || 0));
      var days = daysLeft(w.resetsAtMs);
      return h('div', { key: props.key, style: { padding: '6px 0', borderBottom: '1px solid ' + C.line } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.text } },
          h('span', null, w.label || t('额度')),
          h('span', { style: { color: C.faint, fontVariantNumeric: 'tabular-nums' } }, Math.round(pct) + '%')
        ),
        h('div', { style: { height: 5, borderRadius: 3, background: C.soft, marginTop: 5, overflow: 'hidden' } },
          h('div', { style: { height: '100%', width: pct + '%', background: C.accent, borderRadius: 3, transition: 'width 240ms ease' } })
        ),
        days !== null ? h('div', { style: { fontSize: 10, color: C.faint, marginTop: 3 } }, t('约 ') + days + t(' 天后刷新')) : null
      );
    }

    function CodexQuota(props) {
      var cx = props.cx;
      if (!cx || cx.status !== 'ok') {
        return h('div', { style: { fontSize: 11, color: C.faint, lineHeight: '17px' } },
          t('没有读到 GPT / Codex 额度。需要装 codex-subscription 插件，并用 ChatGPT 账号登录 Codex 订阅后刷新。'));
      }
      var wins = Array.isArray(cx.windows) ? cx.windows : [];
      return h('div', null,
        h('div', { style: { fontSize: 11, color: C.dim, marginBottom: 6 } },
          cx.plan ? t('套餐：') + cx.plan : t('订阅额度 · 到点补满')),
        wins.length
          ? wins.map(function (w, i) { return QuotaWindowRow({ key: i, w: w }); })
          : h('div', { style: { fontSize: 11, color: C.faint } }, t('暂无限速窗口数据')),
        (cx.creditsBalance !== null && cx.creditsBalance !== undefined)
          ? h('div', { style: { marginTop: 8, paddingTop: 8, borderTop: '1px solid ' + C.line, display: 'flex', justifyContent: 'space-between', fontSize: 11 } },
            h('span', { style: { color: C.dim } }, t('积分余额')),
            h('span', { style: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' } },
              '$ '.concat(fmtPrecise(cx.creditsBalance)) + (cx.creditsExpiresAtMs ? ' · ' + t('到期 ') + fmtDate(cx.creditsExpiresAtMs) : '')))
          : null
      );
    }

    function ModelScopeQuota(props) {
      var ms = props.ms;
      if (!ms || ms.status !== 'ok') {
        return h('div', { style: { fontSize: 11, color: C.faint, lineHeight: '17px' } },
          t('没有读到魔搭魔粒余额。需要在 DSH 凭据里配置 MODELSCOPE_API_KEY（不是本面板设置页）。'));
      }
      var bal = ms.balance;
      var pct = (ms.maxBudget && bal !== null && bal !== undefined) ? Math.max(0, Math.min(100, bal / ms.maxBudget * 100)) : null;
      return h('div', null,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } },
          h('span', { style: { fontSize: 11, color: C.dim } }, t('今日可用魔粒')),
          h('span', { style: { fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }, bal === null ? '—' : fmtAmount(bal))),
        pct !== null
          ? h('div', { style: { height: 5, borderRadius: 3, background: C.soft, marginTop: 6, overflow: 'hidden' } },
            h('div', { style: { height: '100%', width: pct + '%', background: C.orange, borderRadius: 3, transition: 'width 240ms ease' } }))
          : null,
        h('div', { style: { fontSize: 10, color: C.faint, marginTop: 5 } }, t('魔粒每天重置，不是可以攒的资产。'))
      );
    }

    /* ---------- sidebar pieces (three layouts, one model) ---------- */

    /* Per-pool seven-day series. usage.daily carries byPool keyed by platform id;
       a pool the host never reported simply has no line, so we fall back to a
       flat zero series and let Sparkline return null. */
    function miniPoolHist(usage, id) {
      if (!usage || !Array.isArray(usage.daily)) return [];
      return usage.daily.slice(-7).map(function (d) {
        var v = d && d.byPool ? d.byPool[id] : 0;
        return Number(v) || 0;
      });
    }

    /* 焦点版：其余平台压成三列窄行，只回答“还有多少”。 */
    function MiniPoolsCompact(props) {
      var rows = props.rows || [];
      if (!rows.length) return null;
      return h('div', { style: { display: 'grid', gap: 3, marginBottom: 5 } }, rows.map(function (r) {
        var meta = PLATFORM[r.id] || null;
        return h('div', {
          key: r.id,
          style: { display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto', gap: 6, alignItems: 'center', fontSize: 10 }
        },
          h('span', { style: { width: 7, height: 7, borderRadius: '50%', background: meta ? meta.color : C.line } }),
          h('span', { style: { color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, meta ? meta.label : r.id),
          h('span', { style: { fontVariantNumeric: 'tabular-nums', color: r.value > 0 ? C.text : C.faint } }, r.value > 0 ? fmtAmount(r.value) : '—')
        );
      }));
    }

    /* 清单版：一平台一行，右侧带该平台自己的七天细线（有就用，没有就只留数字）。 */
    function MiniPoolsList(props) {
      var rows = props.rows || [];
      if (!rows.length) return null;
      return h('div', { style: { display: 'grid', gap: 1, marginBottom: 6 } }, rows.map(function (r) {
        var meta = PLATFORM[r.id] || null;
        var line = props.spark === false ? null : Sparkline({
          values: miniPoolHist(props.usage, r.id), max: 0,
          color: meta ? meta.color : C.accent, width: 46, height: 12
        });
        return h('div', {
          key: r.id,
          style: { display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto auto', gap: 6, alignItems: 'center', fontSize: 11, padding: '2px 0' }
        },
          h('span', { style: { width: 7, height: 7, borderRadius: '50%', background: meta ? meta.color : C.line } }),
          h('span', { style: { color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, meta ? meta.label : r.id),
          line || h('span'),
          h('span', { style: { fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.value > 0 ? C.text : C.faint } }, r.value > 0 ? fmtAmount(r.value) : '—')
        );
      }));
    }

    /* 网格版：两列小卡，只看余额；点按整块仍走 open()。 */
    function MiniPoolsGrid(props) {
      var rows = props.rows || [];
      if (!rows.length) return null;
      return h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 } }, rows.map(function (r) {
        var meta = PLATFORM[r.id] || null;
        return h('div', {
          key: r.id,
          style: {
            border: '1px solid ' + (meta ? meta.tint : C.line),
            background: meta ? meta.tint.replace(/([\d.]+)\)$/, function (m, a) { return Math.min(1, parseFloat(a) * 0.45).toFixed(3) + ')'; }) : C.soft,
            borderRadius: 7, padding: '5px 6px 6px', minWidth: 0
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: meta ? meta.ink : C.dim, marginBottom: 2 } },
            Dot({ color: meta ? meta.color : C.dim, size: 5, gap: 0 }),
            h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, meta ? meta.label : r.id)),
          h('div', { style: { fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: '17px' } }, r.value > 0 ? fmtAmount(r.value) : '—')
        );
      }));
    }

    function MiniEntry() {
      var pair = useData();
      var prefs = usePrefs();
      var forceScale = React.useState(0)[1];
      /* Repaint when the threshold preset changes anywhere else in the app. */
      React.useEffect(function () {
        var bump = function () { forceScale(function (n) { return n + 1; }); };
        SCALE_SUBS.push(bump);
        return function () {
          var i = SCALE_SUBS.indexOf(bump);
          if (i >= 0) SCALE_SUBS.splice(i, 1);
        };
      }, []);
      var state = pair[0];
      var load = pair[1];
      var data = state.data;
      var items = collect(data);
      var buckets = bucketize(items.filter(function (i) { return i.remain > 0; }));
      /* How much the row says is the reader's call: a sidebar this narrow is
         prime real estate, and someone watching one pool does not want four
         columns of it. */
      var mini = prefs.mini;
      var soon = mini.soon === false ? [] : buckets.filter(function (b) { return b.exp !== null; }).slice(0, mini.rows);
      var total = sumOf(items, 'remain');
      var usage = data && data.usage ? data.usage : null;
      /* The sidebar row is the only surface seen without opening the page, so
         the one number that needs acting on belongs here too. */
      var doomed = usage ? foresee(items, usage).filter(function (r) { return r.willWaste && r.wasted > 0; }) : [];
      var waste = 0;
      doomed.forEach(function (r) { waste += r.wasted; });

      var open = function () {
        var layout = null;
        try { layout = ctxRef && ctxRef.get ? ctxRef.get('layout') : null; } catch (e) { layout = null; }
        if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(PANEL_ID);
      };

      /* The sidebar row is the only surface read without opening the page, so it
         carries one conclusion instead of four columns: the pack expiring first
         becomes a card, the other pools collapse to one line, and a seven-day
         line answers "is this burning faster than last week". */
      var focus = mini.soon === false ? null : (soon.length ? soon[0] : null);
      var focusPool = focus ? (bucketPools(focus)[0] || null) : null;
      var focusMeta = focusPool ? PLATFORM[focusPool] : null;
      var focusValue = focus ? (focusPool ? (focus.byPool[focusPool] || 0) : focus.total) : 0;
      /* The card shows how much of this pack is already gone, so it needs the
         pack sizes behind the bucket, not just the remaining sum. */
      var focusSize = 0;
      if (focus) {
        items.forEach(function (i) {
          if (i.platform === focusPool && dayKey(i.exp) === focus.key) focusSize += Number(i.size) || 0;
        });
      }
      var focusUsed = Math.max(0, focusSize - focusValue);
      var focusDays = focus ? daysLeft(focus.exp) : null;
      var hist = (usage && Array.isArray(usage.daily) ? usage.daily.slice(-7) : []).map(function (d) {
        return Number(d.credits) || 0;
      });
      var spent = 0;
      hist.forEach(function (v) { spent += v; });
      var layout = mini.layout || 'focus';
      var poolRows = BALANCE_ORDER.filter(function (id) {
        return prefs.platforms[id] !== false;
      }).map(function (id) {
        return { id: id, value: sumOf(items.filter(function (i) { return i.platform === id; }), 'remain') };
      }).filter(function (r) { return r.value > 0; });
      /* The focus layout already carries the soonest pool inside its card, so its
         lower list drops that one row instead of repeating it. */
      var ledRows = poolRows.filter(function (r) { return r.id !== focusPool; });

      return h('div', {
        onClick: open,
        role: 'button',
        tabIndex: 0,
        'aria-label': t('积分到期 · 点击查看完整面板'),
        onKeyDown: function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            if (e.preventDefault) e.preventDefault();
            open();
          }
        },
        title: t('积分到期 · 点击查看完整面板'),
        style: {
          padding: '8px 10px 9px',
          borderRadius: 8,
          cursor: 'pointer',
          color: C.text,
          background: 'transparent',
          border: '1px solid ' + C.line
        },
        onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
        onMouseLeave: function (e) { e.currentTarget.style.background = 'transparent'; }
      },
        h('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }
        },
          h('span', { style: { fontSize: 11, color: C.dim, letterSpacing: 0.2 } }, t('积分到期')),
          mini.total === false ? null : h('span', { style: { fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(total))
        ),
        state.error ? h('div', { style: { fontSize: 11, color: C.red } }, t('读取失败')) : null,
        state.loading && !data ? h('div', { style: { fontSize: 11, color: C.faint } }, t('读取中…')) : null,
        waste > 0 && mini.waste !== false
          ? h('div', {
            style: { fontSize: 10, color: C.red, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }
          }, Dot({ color: C.red, size: 4 }), fmtAmount(waste) + t(' 积分会在用掉前过期'))
          : null,
        layout === 'focus' && focus ? h('div', {
          style: {
            background: focusMeta ? focusMeta.tint.replace(/([\d.]+)\)$/, function (m, a) { return Math.min(1, parseFloat(a) * 0.5).toFixed(3) + ')'; }) : C.soft,
            border: '1px solid ' + (focusMeta ? focusMeta.tint.replace(/([\d.]+)\)$/, function (m, a) { return Math.min(1, parseFloat(a) * 1.5).toFixed(3) + ')'; }) : C.line),
            borderRadius: 8,
            padding: '7px 8px 6px',
            marginBottom: 7
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
            h('span', {
              style: {
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px 1px 5px', borderRadius: 999,
                fontSize: 9, fontWeight: 600, lineHeight: '14px', whiteSpace: 'nowrap',
                color: focusMeta ? focusMeta.ink : C.dim,
                background: focusMeta ? focusMeta.tint : C.soft
              }
            }, Dot({ color: focusMeta ? focusMeta.color : C.dim, size: 5, gap: 0 }), focusMeta ? focusMeta.label : ''),
            focusDays === null ? null : h('span', {
              style: {
                fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: '16px',
                color: focusDays <= ACTIVE.l7 ? C.red : levelColor(levelOf(focus.exp))
              }
            }, String(focusDays), h('span', { style: { fontSize: 9, fontWeight: 600, marginLeft: 2 } }, t(' 天后作废')))
          ),
          h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 } },
            h('span', { style: { fontSize: 20, lineHeight: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(focusValue)),
            h('span', { style: { fontSize: 9, color: C.dim } },
              focusSize > 0 ? t(' 积分，已用 ') + fmtAmount(focusUsed) : t(' 积分'))
          ),
          focusSize > 0 ? h('div', {
            style: { marginTop: 5, height: 4, borderRadius: 2, background: C.line, overflow: 'hidden' }
          }, h('div', {
            style: {
              width: Math.max(2, Math.min(100, (focusValue / focusSize) * 100)) + '%',
              height: '100%', borderRadius: 2,
              background: focusMeta ? focusMeta.color : C.accent
            }
          })) : null,
          h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 4, fontSize: 9, color: C.faint } },
            h('span', {
              title: focus.names.join(' / '),
              style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
            }, fmtDate(focus.exp) + (focus.names.length ? ' · ' + focus.names[0] : '')),
            ledRows.length
              ? h('span', { style: { whiteSpace: 'nowrap' } }, t('全部 ') + (ledRows.length + 1) + t(' 个平台里最急'))
              : null
          )
        ) : null,
        /* 魔搭只报一个可用量，和平台行同一套栅格：没有图标，名字在左、数字在右。 */
        prefs.mini.modelscope === false ? null : (data && data.ms && data.ms.status === 'ok'
          ? h('div', {
            style: {
              display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto',
              gap: 6, alignItems: 'center', fontSize: 10, marginBottom: 3
            }
          },
            h('span'),
            h('span', { style: { color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t('今日可用魔粒')),
            h('span', { style: { color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(data.ms.balance)))
          : null),
        mini.platforms === false ? null : (layout === 'focus'
          ? MiniPoolsCompact({ rows: ledRows })
          : layout === 'grid'
            ? MiniPoolsGrid({ rows: poolRows })
            : MiniPoolsList({ rows: poolRows, usage: usage, spark: mini.spark })),
        /* The trend line is the point of this row, so it gets the full width under
           the label instead of a 66px thumbnail beside it. */
        h('div', {
          title: t('近 7 天消耗'),
          style: { marginTop: 6, paddingTop: 6, borderTop: '1px solid ' + C.line }
        },
          h('div', {
            style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }
          },
            h('span', { style: { fontSize: 10, color: C.faint, whiteSpace: 'nowrap' } },
              t('近 7 天用了 '),
              h('span', { style: { color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(spent))),
            mini.open === false ? null : h('span', { style: { fontSize: 10, color: C.dim, whiteSpace: 'nowrap' } }, t('打开面板'), ' \u203A')),
          h('div', { style: { marginTop: 4 } },
            mini.spark === false ? null : Sparkline({ values: hist, max: 0, color: C.accent, width: 268, height: 24, stretch: true }))
        ),
        !state.loading && !state.error && soon.length === 0 && mini.soon !== false
          ? h('div', { style: { fontSize: 11, color: C.faint } }, t('暂无临期积分'))
          : null
      );
    }

    /* ---------- full page ---------- */

    /* 免责声明原来每个页签底部都压着五行 10px 灰字，把页面收尾的注意力全吃掉了。
       正文收进一个可展开的说明，页脚只留一行入口，打印时整块不出现。 */
    function DepsNote(props) {
      var pair = React.useState(false);
      var open = pair[0];
      var setOpen = pair[1];
      return h('div', { className: 'cxe-noprint', style: { marginTop: 22 } },
        h('button', {
          type: 'button',
          onClick: function () { setOpen(!open); },
          style: {
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            fontSize: 11, color: C.dim, textDecoration: 'underline'
          }
        }, open ? t('收起数据口径与依赖说明') : t('数据口径与依赖说明')),
        open ? h('div', {
          style: {
            marginTop: 8, padding: '10px 12px', border: '1px solid ' + C.line,
            borderRadius: 8, fontSize: 11, color: C.dim, lineHeight: '18px'
          }
        },
          h('div', null, t('积分余额与到期来自 WorkBuddy / Trae / MiniMax / Qoder 账号接口；消耗来自本机 cost-meter 账本，只统计这四个积分池。')),
          h('div', { style: { marginTop: 6 } }, t('余额靠本机装的对应平台连接插件读取：没装或没登录的那家不显示，不影响其他家。Codex 额度靠 codex-subscription 插件，魔搭魔粒靠本机 DSH 凭据里的 MODELSCOPE_API_KEY 实时读取、不落盘。')),
          h('div', { style: { marginTop: 6 } }, h(PricingNote, { usage: props.usage })),
          h('div', { style: { marginTop: 6 } }, t('Qoder 积分本身不带到期日，这里用的是套餐到期时间（套餐失效后余额一并消失）。'))
        ) : null
      );
    }

    function PageHead(props) {
      return h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingBottom: 14,
          borderBottom: '1px solid ' + C.line
        }
      },
        h('button', {
          type: 'button',
          onClick: props.onBack,
          title: t('返回会话'),
          style: {
            border: '1px solid ' + C.line,
            background: 'transparent',
            color: C.dim,
            borderRadius: 6,
            width: 26,
            height: 26,
            padding: 0,
            margin: 0,
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            flex: 'none'
          }
        }, '‹'),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } },
            h('div', { style: { fontSize: 20, fontWeight: 650, color: C.text, letterSpacing: -0.2, lineHeight: '24px' } }, t('积分到期')),
            VersionLine({ info: props.version, busy: props.versionBusy, onRecheck: props.onRecheck })
          ),
          h('div', { style: { fontSize: 11, color: C.faint, marginTop: 2 } }, t('WorkBuddy、Trae、MiniMax 与 Qoder 的积分余额、到期节奏与消耗'))
        ),
        props.updatedAt ? h('span', { style: { fontSize: 11, color: C.dim, flex: 'none' } }, t('更新于 ') + fmtClock(props.updatedAt)) : null,
        props.actions ? props.actions : null,
        h('button', {
          type: 'button',
          onClick: props.onSettings,
          title: t('显示设置'),
          style: {
            border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
            borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
            fontSize: 13, lineHeight: 1, flex: 'none', padding: 0
          }
        }, '⚙'),
        RefreshButton({ onClick: props.onRefresh, spinning: props.spinning })
      );
    }

    /**
     * A pool whose payload is missing or stale is not a pool at zero. The row
     * says so once, at the top, instead of letting four confidently wrong
     * numbers stand: a degraded read is the one state a balance panel must never
     * render as if nothing happened.
     */
    function DegradedBadge(props) {
      var data = props.data;
      var state = props.state;
      var notes = [];
      if (state && state.error && data) notes.push(t('本次读取失败，显示上次成功的数据'));
      if (state && state.error && !data) notes.push(t('读取失败'));
      var missing = missingPlatforms(data);
      if (missing.length) notes.push(missing.map(function (id) { return PLATFORM[id].label; }).join(t('、')) + t(' 未读到'));
      if (!notes.length) return null;
      return h('div', {
        className: 'cxe-in',
        style: {
          marginTop: 12, padding: '6px 10px', borderRadius: 7, fontSize: 10,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: C.orange, border: '1px solid ' + C.line, background: 'rgba(245,165,36,0.10)'
        }
      },
        h('span', { className: 'cxe-pulse' }, '●'),
        notes.join(' · ')
      );
    }

    function Hero(props) {
      var items = props.items;
      var total = sumOf(items, 'remain');
      /* The hero carries the two facts nobody should have to hunt for: the total
         and what it is made of. Whether that total will actually get spent is the
         forecast card's judgement - printing it here too made the two cards
         contradict each other on screen. */
      var next = items.filter(function (i) { return i.exp !== null && i.exp !== undefined && i.remain > 0; })
        .sort(function (a, b) { return a.exp - b.exp; })[0];
      var parts = BALANCE_ORDER.map(function (id) {
        var meta = PLATFORM[id];
        var value = sumOf(items.filter(function (i) { return i.platform === id; }), 'remain');
        return { key: id, value: value, color: meta.color, title: meta.label + ' ' + fmtAmount(value) };
      }).filter(function (p) { return p.value > 0; });
      return h('div', {
        className: 'cxe-in',
        style: {
          marginTop: 18,
          padding: '16px 18px',
          borderRadius: 12,
          border: '1px solid ' + C.line,
          background: C.soft
        }
      },
        h('div', { style: { fontSize: 11, color: C.dim } }, t('剩余积分合计')),
        h('div', {
          style: {
            fontSize: 30,
            fontWeight: 600,
            lineHeight: '38px',
            color: C.text,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: -0.5
          }
        }, fmtAmount(total)),
        h('div', { style: { marginTop: 12 } }, Track({ parts: parts, height: 8 })),
        h('div', { style: { display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' } },
          parts.map(function (p) {
            return h('span', { key: p.key, style: { display: 'flex', alignItems: 'center', fontSize: 11, color: C.dim } },
              PlatformIcon({ id: p.key, size: 13, gap: 6 }),
              PLATFORM[p.key].label + ' ' + fmtAmount(p.value)
            );
          })
        ),
        next
          ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 11, color: C.dim } },
            t('最近到期 '),
            PlatformIcon({ id: next.platform, size: 11, gap: 3 }),
            fmtDate(next.exp) + ' · ' + fmtAmount(next.remain))
          : null,
        PocketSplit({ usage: props.usage })
      );
    }

    /**
     * Two pockets, not one. Free models spend a quota that costs nothing when it
     * runs dry; paid models spend money. A single total hides which one is
     * emptying, so the split is stated on the number instead of a footnote -
     * and it is simply absent when the ledger has no free-model traffic at all.
     */
    function PocketSplit(props) {
      var usage = props.usage;
      var totals = usage && usage.totals ? usage.totals : null;
      if (!totals) return null;
      var freeCredits = totals.freeCredits || 0;
      var paidCredits = totals.paidCredits || 0;
      if (!(freeCredits > 0) && !(paidCredits > 0)) return null;
      var freeTokens = totals.freeTokens || 0;
      var paidTokens = totals.paidTokens || 0;
      var line = function (key, label, credits, tokens, color) {
        return h('span', {
          key: key,
          title: label + t('：') + fmtAmount(credits) + t(' 积分 · ') + fmtCompact(tokens) + ' tokens',
          style: { display: 'flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }
        },
          Dot({ color: color, size: 5 }),
          h('span', { style: { color: C.faint } }, label),
          h('span', { style: { color: C.dim } }, fmtAmount(credits)),
          h('span', { style: { color: C.faint, fontSize: 10 } }, fmtCompact(tokens) + ' tok')
        );
      };
      return h('div', {
        style: {
          display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8,
          paddingTop: 8, borderTop: '1px solid ' + C.line, fontSize: 11
        }
      },
        line('paid', t('付费模型'), paidCredits, paidTokens, C.accent),
        line('free', t('免费模型'), freeCredits, freeTokens, C.green)
      );
    }

    function Alert(props) {
      /* Outside a card this is a standalone strip; inside the 风险 card the box
         already frames it, so it drops its own border and reads as that card's
         one-line summary instead of a card inside a card. */
      var bare = props.bare === true;
      var buckets = props.buckets.filter(function (b) { return b.exp !== null; });
      var soon = buckets.filter(function (b) { var d = daysLeft(b.exp); return d !== null && d >= 0 && d <= ACTIVE.l30; });
      var amount = 0;
      soon.forEach(function (b) { amount += b.total; });
      var style = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 };
      if (!bare) {
        style.marginTop = 14;
        style.padding = '9px 12px';
        style.borderRadius = 8;
        style.border = '1px solid ' + C.line;
      }
      if (!soon.length) {
        style.color = C.dim;
        return h('div', { style: style },
          Dot({ color: C.green, size: 6 }),
          ACTIVE.l30 + t(' 天内没有到期积分')
        );
      }
      style.color = C.text;
      if (!bare) style.background = 'rgba(229,72,77,0.08)';
      return h('div', { style: style },
        Dot({ color: C.red, size: 6 }),
        h('span', { style: { flex: 1 } }, ACTIVE.l30 + t(' 天内有 ') + soon.length + t(' 个到期日，共 ') + fmtAmount(amount) + t(' 积分')),
        h('span', { style: { fontSize: 11, color: C.faint } }, t('优先消耗'))
      );
    }

    /**
     * Burn-down: the same balances, read as runway instead of stock. Each row is
     * one pool, the bar is how much of its remaining balance one week of the
     * measured rate would eat, and the number on the right is the day the pool
     * hits zero. A pool with no measured spend says so - 'never used' is not
     * 'lasts forever'.
     */
    function Burndown(props) {
      var items = props.items || [];
      var usage = props.usage;
      var info = burndown(usage);
      if (!info) {
        return h('div', {
          style: {
            fontSize: 12, color: C.dim, padding: '9px 12px', borderRadius: 8,
            border: '1px solid ' + C.line, display: 'flex', alignItems: 'center', gap: 8
          }
        },
          Dot({ color: C.faint, size: 6 }),
          t('还没有足够的历史来计算消耗速度（需要至少一天的用量记录）')
        );
      }
      var remainOf = {};
      items.forEach(function (i) { remainOf[i.platform] = (remainOf[i.platform] || 0) + (i.remain || 0); });
      var rows = [];
      PLATFORM_ORDER.forEach(function (id) {
        var burn = burnOf(usage, id);
        var remain = remainOf[id] || 0;
        if (!remain && !(burn > 0)) return;
        rows.push({ id: id, burn: burn || 0, remain: remain, days: exhaustIn(remain, burn || 0) });
      });
      /* Shortest runway first: the pool that runs out soonest is the one that
         needs a decision, and a table sorted by balance would bury it. */
      rows.sort(function (a, b) {
        if (a.days === null && b.days === null) return b.remain - a.remain;
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return a.days - b.days;
      });
      /* A fixed horizon, not the largest row: one rarely-used pool projecting
         900 days would otherwise squash every real one into a stub. Ninety days
         is the window where 'how long will this last' still changes a decision. */
      var HORIZON = 90;
      return h('div', { style: { display: 'grid', gap: 9 } },
        rows.map(function (r) {
          var meta = PLATFORM[r.id];
          var width = r.days === null ? 0 : Math.max(2, Math.round(Math.min(1, r.days / HORIZON) * 100));
          var tone = r.days === null ? C.faint : (r.days <= 7 ? C.red : (r.days <= 30 ? C.orange : C.green));
          return h('div', {
            key: r.id,
            title: meta.label + t(' 余额 ') + fmtAmount(r.remain) + t(' · 每天花 ') + fmtAmount(r.burn)
              + (r.days === null ? t(' · 最近 7 天没用过，无法估算') : t(' · 约 ') + Math.ceil(r.days) + t(' 天后用光'))
          },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 } },
              PlatformIcon({ id: r.id, size: 12, gap: 4 }),
              h('span', { style: { fontSize: 11, color: C.dim, flex: 1, minWidth: 0 } },
                meta.label + t(' · 每天 ') + fmtAmount(r.burn)),
              h('span', { style: { fontSize: 11, color: tone, fontVariantNumeric: 'tabular-nums' } },
                r.days === null ? t('无消耗记录') : (Math.ceil(r.days) >= HORIZON ? t('90 天以上') : (Math.ceil(r.days) + t(' 天'))))
            ),
            h('div', {
              style: { height: 6, borderRadius: 3, background: C.soft, overflow: 'hidden', position: 'relative' }
            },
              /* Transform, not width: a width transition has nothing to animate
                 on mount, so the bar would just pop in. scaleX from 0 does the
                 grow, and the origin keeps it anchored at the left edge. */
              h('div', {
                style: {
                  width: width + '%', height: '100%', borderRadius: 3,
                  transformOrigin: 'left center',
                  background: r.days === null ? C.line : meta.color,
                  animation: 'cxeGrow 420ms cubic-bezier(.22,.61,.36,1) both'
                }
              })
            ),
            /* Reference ticks at the 7- and 30-day marks: the same thresholds
               the row colour already uses, so a short bar can be read as a
               number without counting pixels. They sit on a 4px strip under
               the track, not inside it - over the fill a hairline disappears,
               and inside the track it would be clipped by overflow. */
            h('div', { style: { position: 'relative', height: 4, marginTop: 1 } },
              [7, 30].map(function (d) {
                return h('div', {
                  key: 'tick' + d,
                  title: d + t(' 天'),
                  style: {
                    position: 'absolute', top: 0, left: 'calc(' + (d / HORIZON * 100) + '% - 1px)',
                    width: 1, height: 4, background: C.line, pointerEvents: 'none'
                  }
                });
              })
            )
          );
        }),
        h('div', { style: { fontSize: 11, color: C.dim, lineHeight: '16px', marginTop: 2 } },
          t('按近 7 天日均速度推算余额归零需要几天，不是余额比例。'))
      );
    }

    /**
     * Recurring grants, in their own card because they are the opposite of an
     * expiring balance: the allowance refills, so the useful pair is
     * "how much of the cycle is left" plus "when it comes back".
     */
    function Subscription(props) {
      var data = props.data || {};
      var wanted = props.platformId || null;
      var pools = [];
      PLATFORM_ORDER.forEach(function (id) {
        if (wanted && id !== wanted) return;
        var pool = data[id];
        if (pool && pool.subscription) pools.push({ id: id, sub: pool.subscription });
      });
      if (!pools.length) return null;
      return h('div', { style: { display: 'grid', gap: 8 } },
        pools.map(function (entry, i) {
          var sub = entry.sub;
          var meta = PLATFORM[entry.id];
          var pct = sub.size > 0 ? Math.max(0, Math.min(100, Math.round((sub.remain / sub.size) * 100))) : null;
          var reset = resetLabel(sub.resetAtMs);
          var cliff = sub.expiresAtMs ? daysLeft(sub.expiresAtMs) : null;
          return h('div', {
            key: 'sub' + i,
            style: { border: '1px solid ' + C.line, borderRadius: 8, padding: '9px 11px' }
          },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
              h('span', { style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.text, flex: 1, minWidth: 0 } },
                PlatformIcon({ id: entry.id, size: 12, gap: 2 }),
                meta ? meta.label : entry.id,
                h('span', { style: { color: C.faint, fontWeight: 400 } }, sub.label)),
              sub.size > 0
                ? h('span', { style: { fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } },
                  fmtAmount(sub.remain) + ' / ' + fmtAmount(sub.size))
                : h('span', { style: { fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } },
                  fmtAmount(sub.remain))
            ),
            pct === null ? null : h('div', {
              style: { marginTop: 6, height: 5, borderRadius: 3, background: C.soft, overflow: 'hidden' }
            },
              h('div', {
                style: {
                  width: pct + '%', height: '100%', borderRadius: 3,
                  background: sub.cycle === 'plan' ? C.orange : C.accent
                }
              })
            ),
            h('div', { style: { marginTop: 5, fontSize: 10, color: C.faint, display: 'flex', gap: 10, flexWrap: 'wrap' } },
              reset ? h('span', null, reset) : null,
              cliff !== null
                ? h('span', { style: { color: levelColor(levelOf(sub.expiresAtMs)) } },
                  t('额度 ') + fmtDate(sub.expiresAtMs) + t(' 到期'))
                : null,
              sub.cycle === 'plan' ? h('span', null, t('积分随订阅到期作废')) : null
            )
          );
        })
      );
    }


    /**
     * Doubao hands out quota in time windows (5-hour, weekly, event grants).
     * Unlike the credit packs above these REFILL, so "wasted credits" and
     * "days until exhausted" do not apply. Kept in its own card on purpose:
     * mixing it into credit totals would claim an expiring balance that does
     * not exist and would pollute every burn-rate average.
     */
    function DoubaoQuota(props) {
      var db = props.db;
      if (!db || db.status !== 'ok') {
        return h('div', { style: { fontSize: 11, color: C.faint } },
          (db && db.error) ? db.error : t('豆包额度暂未读上来'));
      }
      var windows = db.windows || [];
      if (!windows.length) {
        return h('div', { style: { fontSize: 11, color: C.faint } }, t('豆包额度暂未读上来'));
      }
      var head = h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 } },
        h('span', { style: { fontSize: 12, color: C.text, fontWeight: 600 } }, db.plan || t('豆包额度')),
        db.exhausted ? h('span', { style: { fontSize: 10, color: C.red } }, t('已用完')) : null
      );
      /* Subscription windows (package / fiveHour / weekly) refill on schedule;
         bonus grants expire for good. One undifferentiated list hid which is
         which, so they render as two labelled groups. */
      var subs = windows.filter(function (w) { return w.kind !== 'incentive'; });
      var bonuses = windows.filter(function (w) { return w.kind === 'incentive'; });
      function windowRow(w, i) {
        var used = Math.max(0, Math.min(100, w.usedPercent || 0));
        var isBonus = w.kind === 'incentive';
        var reset = null;
        if (typeof w.resetsInMs === 'number' && isFinite(w.resetsInMs) && w.resetsInMs > 0) {
          var hrs = w.resetsInMs / 3600000;
          /* A bonus grant counts down to the moment it disappears for good; a
             subscription window counts down to the moment it fills up again.
             Calling an expiring grant a refreshing one is simply wrong. */
          reset = hrs >= 24
            ? Math.ceil(hrs / 24) + (isBonus ? t(' 天后过期') : t(' 天后刷新'))
            : Math.ceil(hrs) + (isBonus ? t(' 小时后过期') : t(' 小时后刷新'));
        }
        var label = isBonus ? (w.label || t('活动赠送')) : (w.label || (w.kind === 'package' ? t('套餐积分') : t('豆包额度')));
        return h('div', { key: 'db' + i, style: { marginBottom: 10 } },
          h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11 } },
            h('span', { style: { color: C.text, flex: 1, minWidth: 0 } }, label),
            h('span', { style: { color: C.text, fontVariantNumeric: 'tabular-nums' } },
              fmtAmount(w.remain) + ' / ' + fmtAmount(w.size))
          ),
          h('div', { style: { marginTop: 5, height: 5, borderRadius: 3, background: C.soft, overflow: 'hidden' } },
            h('div', { style: {
              width: (100 - used) + '%', height: '100%', borderRadius: 3,
              background: PLATFORM.db.color
            } })
          ),
          h('div', { style: { marginTop: 4, fontSize: 10, color: C.faint, display: 'flex', gap: 10, flexWrap: 'wrap' } },
            reset ? h('span', null, reset) : null,
            w.startsOnUse ? h('span', null, t('从首次使用起算')) : null
          )
        );
      }
      function group(title, list) {
        if (!list.length) return null;
        return h('div', { style: { marginBottom: 12 } },
          h('div', { style: { fontSize: 10, color: C.dim, fontWeight: 600, marginBottom: 8 } }, title),
          list.map(windowRow)
        );
      }
      return h('div', null,
        head,
        h('div', { style: { fontSize: 10, color: C.faint, marginBottom: 10 } },
          t('赠送额度到期作废，订阅额度到点刷新；重置日由平台估算')),
        group(t('订阅额度 · 到点补满'), subs),
        group(t('赠送额度 · 到期作废'), bonuses)
      );
    }

    /* ---------- cash balances behind API keys ---------- */

    function postJson(url, body) {
      return fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (response) {
        return response.json().then(function (payload) {
          return { ok: response.ok, body: payload || {} };
        }, function () {
          return { ok: response.ok, body: {} };
        });
      });
    }

    function fmtMoney(amount, currency) {
      if (typeof amount !== 'number' || !isFinite(amount)) return '—';
      var symbol = currency === 'USD' ? '$' : '¥';
      var abs = Math.abs(amount);
      return (amount < 0 ? '-' : '') + symbol + fmtPrecise(abs);
    }

    /**
     * Cash balances are not credits: they do not expire and they are not spent
     * from a grant. Mixing them into the credit total would answer a different
     * question than the panel asks, so they get their own block and their own
     * unit.
     */
    function KeyBalances(props) {
      var keys = props.keys || [];
      if (!keys.length) {
        return h('div', {
          style: {
            fontSize: 12, color: C.dim, padding: '9px 12px', borderRadius: 8,
            border: '1px dashed ' + C.line
          }
        }, t('还没有配置 API 密钥。在设置里加一个，就能在这里看到对应的账户余额。'));
      }
      return h('div', { style: { display: 'grid', gap: 8 } },
        keys.map(function (k) {
          var b = k.balance;
          return h('div', {
            key: k.id,
            style: { border: '1px solid ' + C.line, borderRadius: 8, padding: '9px 11px' }
          },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
              h('span', { style: { fontSize: 12, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                k.label),
              h('span', { style: { fontSize: 13, fontWeight: 600, color: b && b.available === false ? C.orange : C.text, fontVariantNumeric: 'tabular-nums' } },
                b ? fmtMoney(b.amount, b.currency || k.currency) : '—')
            ),
            h('div', { style: { marginTop: 4, fontSize: 10, color: k.error ? C.orange : C.faint, display: 'flex', gap: 10, flexWrap: 'wrap' } },
              h('span', null, k.vendorLabel + ' · ' + k.masked),
              b && b.granted > 0 ? h('span', null, t('赠送 ') + fmtMoney(b.granted, b.currency)) : null,
              b && b.topped > 0 ? h('span', null, t('充值 ') + fmtMoney(b.topped, b.currency)) : null,
              b && b.used > 0 ? h('span', null, t('已用 ') + fmtMoney(b.used, b.currency)) : null,
              b && b.available === false ? h('span', { style: { color: C.orange } }, t('不可用（余额为零或被冻结）')) : null,
              k.error ? h('span', { style: { color: C.orange } }, k.error) : null
            )
          );
        })
      );
    }

    /**
     * Adding a key is a write to this machine's home directory, so it happens
     * once from the settings page and the key is never rendered back: the page
     * only ever receives the masked form.
     */
    function KeyManager() {
      var listPair = React.useState(null);
      var list = listPair[0];
      var setList = listPair[1];
      var vendorPair = React.useState('deepseek');
      var vendor = vendorPair[0];
      var setVendor = vendorPair[1];
      var keyPair = React.useState('');
      var keyText = keyPair[0];
      var setKeyText = keyPair[1];
      var labelPair = React.useState('');
      var label = labelPair[0];
      var setLabel = labelPair[1];
      var msgPair = React.useState(null);
      var msg = msgPair[0];
      var setMsg = msgPair[1];

      var loadList = function () {
        fetch(KEYS_API, { headers: { accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (payload) { setList(payload || {}); }, function () { setList({ accounts: [], vendors: [] }); });
      };
      React.useEffect(function () { loadList(); }, []);

      var accounts = (list && list.accounts) || [];
      var vendors = (list && list.vendors) || [
        { id: 'deepseek', label: 'DeepSeek' },
        { id: 'moonshot', label: 'Moonshot / Kimi' },
        { id: 'openrouter', label: 'OpenRouter' }
      ];

      var submit = function () {
        if (!keyText.trim()) { setMsg({ tone: C.orange, text: t('先填密钥') }); return; }
        postJson(KEYS_API, { action: 'add', account: { vendor: vendor, key: keyText.trim(), label: label.trim() || undefined } })
          .then(function (res) {
            if (!res.ok) { setMsg({ tone: C.orange, text: res.body.error || t('保存失败') }); return; }
            setMsg({ tone: C.green, text: t('已保存') });
            setKeyText('');
            setLabel('');
            setList({ accounts: res.body.accounts || [], vendors: vendors });
          }, function (e) { setMsg({ tone: C.orange, text: String(e && e.message || e) }); });
      };

      var remove = function (id) {
        postJson(KEYS_API, { action: 'remove', id: id }).then(function (res) {
          setList({ accounts: (res.body && res.body.accounts) || [], vendors: vendors });
        }, function () {});
      };

      var input = function (props) {
        return h('input', Object.assign({
          style: {
            border: '1px solid ' + C.line, background: 'transparent', color: C.text,
            borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none',
            boxSizing: 'border-box', minWidth: 0
          }
        }, props));
      };

      return h('div', null,
        accounts.length
          ? h('div', { style: { display: 'grid', gap: 6, marginBottom: 12 } }, accounts.map(function (a) {
            return h('div', {
              key: a.id,
              style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.dim }
            },
              h('span', { style: { flex: 1, minWidth: 0 } }, a.label + ' · ' + a.vendorLabel + ' · ' + a.masked),
              h('button', {
                type: 'button',
                onClick: function () { remove(a.id); },
                style: {
                  border: '1px solid ' + C.line, background: 'transparent', color: C.faint,
                  borderRadius: 5, padding: '2px 8px', fontSize: 10, cursor: 'pointer'
                }
              }, t('删除'))
            );
          }))
          : null,
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
          h('select', {
            value: vendor,
            onChange: function (e) { setVendor(e.target.value); },
            style: {
              border: '1px solid ' + C.line, background: 'transparent', color: C.text,
              borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none'
            }
          }, vendors.map(function (v) { return h('option', { key: v.id, value: v.id }, v.label); })),
          input({ value: label, placeholder: t('备注（可空）'), onChange: function (e) { setLabel(e.target.value); } }),
          input({
            value: keyText, placeholder: t('粘贴 API 密钥'), type: 'password',
            onChange: function (e) { setKeyText(e.target.value); }
          }),
          h('button', {
            type: 'button',
            onClick: submit,
            style: {
              border: '1px solid ' + C.accent, background: 'transparent', color: C.accent,
              borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer'
            }
          }, t('添加'))
        ),
        msg ? h('div', { style: { marginTop: 6, fontSize: 10, color: msg.tone } }, msg.text) : null,
        h('div', { style: { marginTop: 6, fontSize: 10, color: C.faint, lineHeight: '15px' } },
          t('密钥写在本机 ') + t('storages/credit-expiry/keys.json（权限 600），不会被页面读回，也不会进仓库。'))
      );
    }

    /**
     * IM push: the same summary the copy button produces, delivered to a group
     * webhook. The URL is treated as a credential - stored 0600, never echoed.
     */
    function NotifyConfig(props) {
      var statePair = React.useState(props.notify || null);
      var state = statePair[0];
      var setState = statePair[1];
      var urlPair = React.useState('');
      var url = urlPair[0];
      var setUrl = urlPair[1];
      var msgPair = React.useState(null);
      var msg = msgPair[0];
      var setMsg = msgPair[1];

      var save = function (value) {
        postJson(NOTIFY_API, { action: 'config', url: value }).then(function (res) {
          if (!res.ok) { setMsg({ tone: C.orange, text: res.body.error || t('保存失败') }); return; }
          setState(res.body.notify || null);
          setUrl('');
          setMsg({ tone: C.green, text: value ? t('已保存推送地址') : t('已清除推送地址') });
        }, function (e) { setMsg({ tone: C.orange, text: String(e && e.message || e) }); });
      };

      var send = function () {
        setMsg({ tone: C.faint, text: t('推送中…') });
        postJson(NOTIFY_API, { text: props.buildText() }).then(function (res) {
          setMsg(res.ok
            ? { tone: C.green, text: t('已推送到 ') + String(res.body.kind || '') }
            : { tone: C.orange, text: res.body.error || t('推送失败') });
        }, function (e) { setMsg({ tone: C.orange, text: String(e && e.message || e) }); });
      };

      var kindLabel = { wecom: t('企业微信'), dingtalk: t('钉钉'), feishu: t('飞书'), slack: 'Slack' };

      return h('div', null,
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
          h('input', {
            value: url,
            placeholder: state && state.hasUrl ? t('已配置（重新填写可替换，留空并保存可清除）') : t('粘贴群机器人 Webhook 地址（https://…）'),
            onChange: function (e) { setUrl(e.target.value); },
            style: {
              flex: 1, minWidth: 200, border: '1px solid ' + C.line, background: 'transparent',
              color: C.text, borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', boxSizing: 'border-box'
            }
          }),
          h('button', {
            type: 'button',
            onClick: function () { save(url.trim()); },
            style: {
              border: '1px solid ' + C.accent, background: 'transparent', color: C.accent,
              borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer'
            }
          }, t('保存')),
          state && state.hasUrl
            ? h('button', {
              type: 'button',
              onClick: send,
              style: {
                border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
                borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer'
              }
            }, t('推送一条'))
            : null
        ),
        h('div', { style: { marginTop: 5, fontSize: 10, color: C.faint, lineHeight: '15px' } },
          state && state.hasUrl
            ? t('当前已配置：') + (kindLabel[state.kind] || state.kind || t('自定义')) + t(' 机器人')
            : t('支持企业微信 / 钉钉 / 飞书群机器人与 Slack Incoming Webhook，按域名自动识别格式。')
        ),
        msg ? h('div', { style: { marginTop: 5, fontSize: 10, color: msg.tone } }, msg.text) : null
      );
    }

    /**
     * The decision, not the data: "本周有 X 积分会在花掉之前到期". Every other
     * credit widget lists dates and leaves the arithmetic to the reader; the
     * only rows that matter are the ones whose burn cannot outrun the cliff.
     */
    function Foresight(props) {
      var rows = props.rows || [];
      var usage = props.usage;
      /* Inside the 风险 card the border and spacing come from the card. */
      var bare = props.bare === true;
      var doomed = rows.filter(function (r) { return r.willWaste && r.wasted > 0; });
      if (!doomed.length) {
        var hasRate = PLATFORM_ORDER.some(function (id) { return burnOf(usage, id) !== null; });
        if (!hasRate) return null;
        var calm = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.dim };
        if (!bare) {
          calm.marginTop = 12;
          calm.padding = '9px 12px';
          calm.borderRadius = 8;
          calm.border = '1px solid ' + C.line;
        }
        return h('div', { style: calm },
          Dot({ color: C.green, size: 6 }),
          t('按近 7 天的消耗速度，没有积分会烂在到期日上')
        );
      }
      var totalWaste = 0;
      doomed.forEach(function (r) { totalWaste += r.wasted; });
      var totalCny = 0;
      var priced = false;
      doomed.forEach(function (r) {
        var c = cnyOf(usage, r.item.platform, r.wasted);
        if (c !== null) { totalCny += c; priced = true; }
      });

      /* Bare keeps the red tint - that is what makes it look like the risky
         part - but gives up its own frame inside the 风险 card. */
      var box = bare
        ? { padding: '10px 12px', borderRadius: 8, background: 'rgba(229,72,77,0.05)' }
        : { marginTop: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid ' + C.line, background: 'rgba(229,72,77,0.06)' };
      return h('div', { style: box },
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 } },
          Dot({ color: C.red, size: 6 }),
          h('span', { style: { fontSize: 12, fontWeight: 600, color: C.text } },
            t('按当前速度，') + fmtAmount(totalWaste) + t(' 积分会在用掉前过期')),
          priced
            ? h('span', { style: { fontSize: 11, color: C.red, fontVariantNumeric: 'tabular-nums' } }, '≈¥' + fmtPrecise(totalCny))
            : null
        ),
        doomed.slice(0, 4).map(function (r) {
          var mine = PLATFORM[r.item.platform];
          var canSpend = r.burn * Math.max(r.days, 0);
          var m = PLATFORM[r.item.platform];
          return h('div', {
            key: r.item.platform + r.item.name + r.item.exp,
            style: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, lineHeight: '20px', color: C.dim }
          },
            PlatformIcon({ id: r.item.platform, size: 12, gap: 4 }),
            h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              mine.short + t('「') + r.item.name + t('」') + fmtDate(r.item.exp) + t(' 到期（') + (r.days <= 0 ? t('今天') : t('还剩 ') + r.days + t(' 天')) + t('）')),
            h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.faint } },
              t('每天 ') + fmtAmount(r.burn) + t(' · 到期前只能花 ') + fmtAmount(canSpend)),
            h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.red, minWidth: 54, textAlign: 'right' } },
              t('浪费 ') + fmtAmount(r.wasted))
          );
        }),
        doomed.length > 4
          ? h('div', { style: { marginTop: 4, fontSize: 10, color: C.faint } }, t('另有 ') + (doomed.length - 4) + t(' 个积分包同样会在到期前用不完'))
          : null,
        adviceLine(rows, usage)
          ? h('div', { style: { marginTop: 8, fontSize: 11, color: C.orange } }, adviceLine(rows, usage))
          : null,
        h('div', { style: { marginTop: 7, fontSize: 10, color: C.faint, lineHeight: '15px' } },
          t('消耗速度取各平台自己的积分口径、近 7 天日均；同一平台内按余额比例分摊到各积分包。'))
      );
    }

    /* The sentence a human would say out loud, assembled from the rows above:
       name the platform and the pack, because "go use your credits" is advice
       nobody can act on. */
    function adviceLine(rows, usage) {
      var doomed = rows.filter(function (r) { return r.willWaste && r.wasted > 0; });
      if (!doomed.length) return null;
      var top = doomed[0];
      var cny = cnyOf(usage, top.item.platform, top.wasted);
      return t('建议先用 ') + PLATFORM[top.item.platform].label + t(' 的「') + top.item.name + t('」')
        + (cny === null ? '' : t('（约 ¥') + fmtPrecise(cny) + t(' 会作废）'));
    }

    /**
     * One row per pack, all four platforms in one table - the abstraction none
     * of the surveyed plugins has. Units are stated in the header, not inferred
     * from the numbers: a credit is not a yuan and a percentage is neither.
     */
    function CreditLedger(props) {
      var items = props.items || [];
      /* The ledger is the only full-detail table in the panel and every platform
         lands in it, so scoping is the reader's job: which platform, which
         urgency band, which column order. */
      var platPair = React.useState('');
      var plat = platPair[0], setPlat = platPair[1];
      var statePair = React.useState('');
      var state = statePair[0], setState = statePair[1];
      var sortPair = React.useState('due');
      var sort = sortPair[0], setSort = sortPair[1];
      var plats = BALANCE_ORDER.filter(function (id) {
        return items.some(function (it) { return it.platform === id; });
      });
      var filtered = items.filter(function (it) {
        if (plat && it.platform !== plat) return false;
        if (!state) return true;
        var d = daysLeft(it.exp);
        if (state === 'soon') return d !== null && d <= ACTIVE.l30 && d > ACTIVE.l7;
        if (state === 'doomed') return d !== null && d <= ACTIVE.l7;
        return d === null || d > ACTIVE.l30;
      });
      var rows = filtered.slice().sort(function (a, b) {
        if (sort === 'remain') return (b.remain || 0) - (a.remain || 0);
        if (sort === 'used') return ((b.size || 0) - (b.remain || 0)) - ((a.size || 0) - (a.remain || 0));
        var da = daysLeft(a.exp), db = daysLeft(b.exp);
        if (da === null && db === null) return b.remain - a.remain;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
      if (!items.length) return h('div', { style: { fontSize: 12, color: C.faint } }, t('暂无积分包'));

      /* 紧迫度带：一眼看出「账本里有多少积分正在倒计时」。三段色条按积分量分宽，
         比读四个数字快；单个平台过滤时也跟着过滤后的行算。 */
      var band = { doomed: 0, soon: 0, safe: 0 };
      filtered.forEach(function (it) {
        var d = daysLeft(it.exp);
        var v = Number(it.remain) || 0;
        if (d !== null && d <= ACTIVE.l7) band.doomed += v;
        else if (d !== null && d <= ACTIVE.l30) band.soon += v;
        else band.safe += v;
      });
      var bandTotal = band.doomed + band.soon + band.safe;
      var bandSegs = [
        { key: 'doomed', value: band.doomed, color: C.red, label: t('7 天内') },
        { key: 'soon', value: band.soon, color: C.orange, label: t('30 天内') },
        { key: 'safe', value: band.safe, color: C.green, label: t('安全') }
      ];

      function cell(text, opts) {
        opts = opts || {};
        return h('div', {
          style: {
            padding: '7px 4px',
            fontSize: opts.size || 11,
            color: opts.color || C.dim,
            textAlign: opts.align || 'left',
            fontVariantNumeric: opts.align === 'right' ? 'tabular-nums' : undefined,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }
        }, text);
      }

      return h('div', null,
        h(FilterStrip, null,
          h('span', { style: { display: 'inline-flex', gap: 4, flexWrap: 'wrap' } },
            h(Chip, { on: plat === '', label: t('全部平台'), onClick: function () { setPlat(''); } }),
            plats.map(function (id) {
              return h(Chip, {
                key: id,
                on: plat === id,
                label: PLATFORM[id] ? PLATFORM[id].short : id,
                title: PLATFORM[id] ? PLATFORM[id].label : id,
                onClick: function () { setPlat(plat === id ? '' : id); }
              });
            })
          ),
          h('span', { style: { width: 1, height: 14, background: C.line, flex: 'none' } }),
          h('span', { style: { display: 'inline-flex', gap: 4, flexWrap: 'wrap' } },
            h(Chip, { on: state === '', label: t('全部状态'), onClick: function () { setState(''); } }),
            h(Chip, {
              on: state === 'soon',
              label: t('快到期'),
              title: t('30 天内到期'),
              onClick: function () { setState(state === 'soon' ? '' : 'soon'); }
            }),
            h(Chip, {
              on: state === 'doomed',
              label: t('即将作废'),
              title: t('7 天内到期'),
              onClick: function () { setState(state === 'doomed' ? '' : 'doomed'); }
            }),
            h(Chip, {
              on: state === 'safe',
              label: t('安全'),
              title: t('30 天以上或长期'),
              onClick: function () { setState(state === 'safe' ? '' : 'safe'); }
            })
          ),
          h('span', { style: { width: 1, height: 14, background: C.line, flex: 'none' } }),
          h('span', { style: { display: 'inline-flex', gap: 4, flexWrap: 'wrap' } },
            h(Chip, { on: sort === 'due', label: t('按到期'), onClick: function () { setSort('due'); } }),
            h(Chip, { on: sort === 'remain', label: t('按剩余'), onClick: function () { setSort('remain'); } }),
            h(Chip, { on: sort === 'used', label: t('按已用'), onClick: function () { setSort('used'); } })
          )
        ),
        h('div', { style: { fontSize: 11, color: C.dim, marginBottom: 4, fontVariantNumeric: 'tabular-nums' } },
          t('显示 ') + rows.length + ' / ' + items.length + t(' 个积分包')),
        !rows.length ? h('div', { style: { fontSize: 12, color: C.faint, padding: '8px 0' } }, t('没有匹配的积分包')) : null,
        bandTotal > 0 ? h('div', { style: { marginBottom: 8 } },
          h('div', {
            style: { display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: C.soft }
          }, bandSegs.map(function (seg) {
            if (!(seg.value > 0)) return null;
            return h('div', {
              key: seg.key,
              title: seg.label + ' · ' + fmtAmount(seg.value),
              style: { width: (seg.value / bandTotal * 100) + '%', background: seg.color }
            });
          })),
          h('div', {
            style: { display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: C.dim, fontVariantNumeric: 'tabular-nums' }
          }, bandSegs.map(function (seg) {
            return h('span', { key: seg.key, style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
              Dot({ color: seg.color, size: 5, gap: 0 }),
              seg.label + ' ' + fmtAmount(seg.value));
          }))
        ) : null,
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 58px 58px 64px 68px',
            gap: 4,
            borderBottom: '1px solid ' + C.line,
            paddingBottom: 2
          }
        },
          cell(t('平台 / 积分包'), { color: C.dim, size: 11 }),
          cell(t('剩余（积分）'), { color: C.dim, size: 11, align: 'right' }),
          cell(t('总量'), { color: C.dim, size: 11, align: 'right' }),
          cell(t('已用'), { color: C.dim, size: 11, align: 'right' }),
          cell(t('到期日'), { color: C.dim, size: 11, align: 'right' }),
          cell(t('剩余天数'), { color: C.dim, size: 11, align: 'right' })
        ),
        rows.map(function (item, i) {
          var days = daysLeft(item.exp);
          var used = Math.max(0, (item.size || 0) - (item.remain || 0));
          return h('div', {
            key: item.platform + '|' + item.name + '|' + i,
            style: {
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 58px 58px 64px 68px',
              gap: 4,
              borderBottom: '1px solid ' + C.line
            }
          },
            h('div', {
              style: {
                display: 'flex', alignItems: 'center', padding: '7px 0 7px 2px',
                fontSize: 11, color: C.text, minWidth: 0
              }
            }, PlatformIcon({ id: item.platform, size: 12, gap: 5 }),
              h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.name)),
            cell(fmtAmount(item.remain), { align: 'right', color: C.text }),
            cell(item.size > 0 ? fmtAmount(item.size) : '—', { align: 'right' }),
            cell(item.size > 0 ? fmtAmount(used) : '—', { align: 'right' }),
            cell(item.exp === null ? t('长期') : fmtDate(item.exp), { align: 'right' }),
            /* 剩余天数配一条 30 天刻度的细条：数字告诉你几天，条告诉你「还剩多少余地」。 */
            h('div', {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, padding: '7px 2px' }
            },
              days !== null && days <= ACTIVE.l30
                ? h('span', {
                  title: Math.max(0, days) + t(' 天'),
                  style: { width: 22, height: 3, borderRadius: 2, background: C.soft, flex: 'none', overflow: 'hidden' }
                }, h('span', {
                  style: {
                    display: 'block', height: '100%', borderRadius: 2,
                    width: Math.max(8, Math.min(100, (Math.max(0, days) / 30) * 100)) + '%',
                    background: days <= ACTIVE.l7 ? C.red : (days <= ACTIVE.l30 ? C.orange : C.green)
                  }
                }))
                : null,
              h('span', {
                style: {
                  fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  color: days !== null && days <= ACTIVE.l90 ? levelColor(levelOf(item.exp)) : C.faint
                }
              }, days === null ? '—' : countdownLabel(days)))
          );
        })
      );
    }

    /**
     * A month grid where the number inside a cell is the credits dying that
     * day - the one question a bar chart of spending cannot answer. Color is
     * the same five-level scale the rows use, so the two views agree.
     */
    function ExpiryCalendar(props) {
      usePrefs();
      var buckets = props.buckets || [];
      var items = props.items || [];
      var month = props.month;
      /* Per-platform layers: a day cell can tell which pool is dying on it, and
         each layer can be switched off without touching the sidebar balances
         (a separate preference on purpose - hiding a layer here must not hide a
         platform from the footer). */
      var layers = PLATFORM_ORDER.filter(function (id) { return (PREFS.cal[id] || false) !== false; });
      var byDay = {};
      function addTo(k, pid, value) {
        var cell = byDay[k] || (byDay[k] = { total: 0, parts: {} });
        cell.total += value;
        if (pid) cell.parts[pid] = (cell.parts[pid] || 0) + value;
      }
      if (items.length) {
        items.forEach(function (it) {
          if (it.exp === null || it.exp === undefined) return;
          if (layers.indexOf(it.platform) < 0) return;
          addTo(dayKey(it.exp), it.platform, Number(it.remain) || 0);
        });
      } else {
        buckets.forEach(function (b) {
          if (b.exp === null) return;
          addTo(dayKey(b.exp), null, b.total);
        });
      }
      var first = new Date(month.getFullYear(), month.getMonth(), 1);
      var daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      var lead = (first.getDay() + 6) % 7; /* Monday-first grid */
      var cells = [];
      for (var i = 0; i < lead; i += 1) cells.push(null);
      for (var d = 1; d <= daysInMonth; d += 1) {
        var key = month.getFullYear() + '-' + pad2(month.getMonth() + 1) + '-' + pad2(d);
        var info = byDay[key] || null;
        cells.push({ day: d, key: key, value: info ? info.total : 0, parts: info ? info.parts : {} });
      }
      /* Pad the last row: a 30-day month that starts on a Wednesday leaves the
         grid one cell short, which reads as a missing day. */
      while (cells.length % 7 !== 0) cells.push(null);
      var max = 1;
      cells.forEach(function (c) { if (c && c.value > max) max = c.value; });
      var todayKey = dayKey(Date.now());
      var monthTotal = 0;
      var daysWithExpiry = 0;
      var peakDay = null;
      cells.forEach(function (c) {
        if (!c) return;
        monthTotal += c.value;
        if (c.value > 0) {
          daysWithExpiry += 1;
          if (!peakDay || c.value > peakDay.value) {
            peakDay = { value: c.value, label: (month.getMonth() + 1) + '/' + c.day };
          }
        }
      });

      return h('div', null,
        h(FilterStrip, null,
          h('span', { style: { display: 'inline-flex', gap: 4, flexWrap: 'wrap' } },
            PLATFORM_ORDER.map(function (id) {
              var on = (PREFS.cal[id] || false) !== false;
              return h(Chip, {
                key: id,
                on: on,
                label: PLATFORM[id].short,
                title: t('只影响这张日历，侧栏余额不受影响'),
                onClick: function () { setPref(['cal', id], !on); }
              });
            })
          )
        ),
        /* 月份标题行：左边年月，右边本月合计与峰值日——读者一眼就能知道这个月
           的钱集中在哪一天，不用自己数格子。 */
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 } },
          h('span', { style: { fontSize: 12, fontWeight: 600, color: C.text } },
            month.getFullYear() + t(' 年 ') + (month.getMonth() + 1) + t(' 月')),
          h('span', { style: { display: 'flex', gap: 10, fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
            h('span', null, monthTotal > 0 ? t('本月到期 ') + fmtAmount(monthTotal) + t(' 积分') : t('本月无到期')),
            peakDay ? h('span', null, t('最多的一天 ') + peakDay.label + ' · ' + fmtAmount(peakDay.value)) : null
          )
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4, marginBottom: 5 } },
          [t('一'), t('二'), t('三'), t('四'), t('五'), t('六'), t('日')].map(function (w, wi) {
            return h('div', {
              key: w,
              style: { fontSize: 9, color: C.faint, textAlign: 'center', letterSpacing: 0.4, fontWeight: wi >= 5 ? 600 : 400 }
            }, w);
          })
        ),
        /* 每个格子里装三样东西：日期、当天到期多少、构成条。悬停还有一行小字
           说明是哪几家。这样日历本身能读，不必靠 tooltip 才看懂。 */
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 } },
          cells.map(function (cell, i) {
            if (!cell) return h('div', { key: 'e' + i });
            var isToday = cell.key === todayKey;
            var has = cell.value > 0;
            var ratio = max > 0 ? cell.value / max : 0;
            var dayMs = new Date(month.getFullYear(), month.getMonth(), cell.day).getTime();
            var tone = has ? levelColor(levelOf(dayMs)) : C.line;
            /* 8 位 hex 当半透明底色用：色相跟着紧急度走，深浅跟着金额走。 */
            var alpha = Math.round((0.06 + ratio * 0.30) * 255).toString(16).padStart(2, '0');
            var parts = cell.parts || {};
            var named = PLATFORM_ORDER.filter(function (id) { return (parts[id] || 0) > 0; });
            var detail = named.map(function (id) { return PLATFORM[id].label + ' ' + fmtAmount(parts[id]); }).join(' · ');
            return h('div', {
              key: cell.key,
              title: cell.key + (has
                ? ' · ' + fmtAmount(cell.value) + t(' 积分到期') + (detail ? ' (' + detail + ')' : '')
                : t(' · 无到期')),
              style: {
                height: 58,
                padding: '5px 6px 0',
                borderRadius: R.md,
                background: has ? tone + alpha : 'transparent',
                border: '1px solid ' + (isToday ? C.accent : (has ? tone + '40' : C.line)),
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 1,
                overflow: 'hidden',
                position: 'relative'
              },
              className: 'cxe-cell'
            },
              h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: 1 } },
                h('span', {
                  style: {
                    fontSize: 10,
                    fontWeight: isToday || has ? 600 : 400,
                    color: isToday ? C.accent : (has ? C.text : C.faint),
                    fontVariantNumeric: 'tabular-nums'
                  }
                }, cell.day),
                isToday
                  ? h('span', { style: { fontSize: 8, color: C.accent, fontWeight: 600 } }, t('今'))
                  : null
              ),
              has
                ? h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 } },
                  h('span', {
                    style: { fontSize: 12, fontWeight: 650, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2 }
                  }, fmtCompact(cell.value)),
                  named.length > 1
                    ? h('span', { style: { fontSize: 8, color: C.dim } }, named.length + t(' 家'))
                    : null
                )
                : h('div', { style: { flex: 1 } }),
              has && named.length
                ? h('div', {
                  style: { display: 'flex', width: '100%', height: 2.5, borderRadius: 2, overflow: 'hidden', marginBottom: 0 }
                }, named.map(function (id) {
                  return h('div', {
                    key: id,
                    style: { width: ((parts[id] || 0) / (cell.value || 1) * 100) + '%', height: '100%', background: PLATFORM[id].color }
                  });
                }))
                : h('div', { style: { height: 2.5 } })
            );
          })
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, fontSize: 10, color: C.faint, flexWrap: 'wrap' } },
          h('span', null, daysWithExpiry + t(' 天有到期')),
          LEVELS.map(function (lv) {
            return h('span', { key: lv.id, style: { display: 'inline-flex', alignItems: 'center' } }, Dot({ color: lv.color, size: 5 }), lv.label);
          }),
          h('span', null, t('底色深浅 = 当天金额，色相 = 离现在多远'))
        )
      );
    }

    function PlatformCard(props) {
      var card = props.card;
      var meta = PLATFORM[card.id];
      var parts = LEVELS.map(function (lv) {
        return { key: lv.id, value: card.byLevel[lv.id] || 0, color: lv.color, title: lv.label };
      });
      var soon = card.buckets.filter(function (b) { return b.exp !== null; }).slice(0, 3);
      var sizeSum = 0;
      var remainSum = 0;
      (props.items || []).forEach(function (i) {
        if (i.platform !== card.id) return;
        sizeSum += i.size || 0;
        remainSum += i.remain || 0;
      });
      var usedPct = sizeSum > 0 ? Math.round((sizeSum - remainSum) / sizeSum * 100) : null;
      /* A pool whose buckets all lack an expiry says the same thing in one line;
         giving it a quarter of the grid only pushes the cards that do carry
         deadlines down the page. */
      if (props.compact) {
        return h('div', {
          className: 'cxe-card cxe-in',
          style: {
            minWidth: 0, padding: '8px 10px', borderRadius: 10,
            border: '1px solid ' + C.line,
            display: 'flex', alignItems: 'center', gap: 8
          }
        },
          h('span', {
            style: {
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '1px 7px', borderRadius: 999, background: meta.tint,
              fontSize: 11, fontWeight: 600, color: meta.color
            }
          }, PlatformIcon({ id: card.id, size: 12, gap: 4 }), meta.label),
          h('span', { style: { flex: 1, minWidth: 0 } }),
          h('span', { style: { fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: C.text } }, fmtAmount(card.total))
        );
      }
      return h('div', {
        className: 'cxe-card cxe-in',
        style: {
          minWidth: 0,
          padding: '12px 13px 13px',
          borderRadius: R.lg,
          border: '1px solid ' + C.line,
          background: C.bg
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 } },
          h('span', {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 999,
              background: meta.tint,
              fontSize: 11,
              fontWeight: 600,
              color: meta.color
            }
          }, PlatformIcon({ id: card.id, size: 13, gap: 5 }), meta.label),
          h('span', { style: { flex: 1 } }),
          h('span', { style: { fontSize: 20, fontWeight: 650, letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums', color: C.text } }, fmtAmount(card.total))
        ),
        Track({ parts: parts, height: 6 }),
        /* 没有文字说明的进度条只能读出「有长有短」，读不出这是余额里的哪一半。 */
        usedPct === null ? null : h('div', { style: { fontSize: 11, color: C.dim, marginTop: 4 } }, t('已用 ') + usedPct + '%'),
        h('div', { style: { marginTop: 10 } },
          soon.length === 0
            ? h('div', { style: { fontSize: 11, color: C.faint } }, t('没有带有效期的积分'))
            : soon.map(function (bucket) {
              var days = daysLeft(bucket.exp);
              return h('div', {
                key: bucket.key,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 11,
                  lineHeight: '19px',
                  color: C.dim
                }
              },
                Dot({ color: levelColor(levelOf(bucket.exp)), size: 5 }),
                h('span', { style: { fontVariantNumeric: 'tabular-nums', minWidth: 34 } }, fmtDate(bucket.exp)),
                h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  bucket.count > 1 ? bucket.count + t(' 项') : (bucket.names[0] || '')),
                h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.text } }, fmtAmount(bucket.total)),
                h('span', {
                  style: {
                    minWidth: 40,
                    textAlign: 'right',
                    color: days !== null && days <= ACTIVE.l90 ? levelColor(levelOf(bucket.exp)) : C.faint
                  }
                }, days === null ? '' : countdownLabel(days))
              );
            })
        )
      );
    }

    /* The bar length is the bucket's share of the largest bucket, so 200
       credits visibly reads as twice the 100-credit row instead of every row
       filling the column and looking identical. */
    function BucketRow(props) {
      var bucket = props.bucket;
      var max = props.max || 1;
      var parts = BALANCE_ORDER.map(function (id) {
        return { key: id, value: bucket.byPool[id] || 0, color: PLATFORM[id].color, title: PLATFORM[id].label };
      });
      var pools = BALANCE_ORDER.filter(function (id) { return (bucket.byPool[id] || 0) > 0; });
      var days = daysLeft(bucket.exp);
      var ratio = max > 0 ? bucket.total / max : 0;
      var pct = Math.max(ratio * 100, 2.5);
      /* One expiry date per card: a date, its total, the mix bar and the package
         names. As a table row the amount was one of four columns to compare by
         eye; as a card it is the number the card is about. */
      return h('div', {
        style: {
          display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0,
          border: '1px solid ' + C.line, borderRadius: R.lg,
          padding: '9px 11px 10px', background: C.bg
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.dim } },
          Dot({ color: levelColor(levelOf(bucket.exp)), size: 6 }),
          h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, fmtDate(bucket.exp)),
          h('span', { style: { flex: 1 } }),
          h('span', {
            style: {
              flex: 'none', fontSize: 10,
              color: days === null ? C.faint : (days <= ACTIVE.l90 ? levelColor(levelOf(bucket.exp)) : C.faint)
            }
          }, countdownLabel(days))
        ),
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4 } },
          h('span', { style: { fontSize: FS.md, fontWeight: 650, letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(bucket.total)),
          h('span', { style: { fontSize: FS.xxs, color: C.dim } }, t('积分'))
        ),
        h('div', { style: { width: pct + '%', minWidth: 6 } }, Track({ parts: parts, height: 6 })),
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            fontSize: 10,
            color: C.faint,
            marginTop: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }
        },
          pools.map(function (id) {
            return h(React.Fragment, { key: id }, PlatformIcon({ id: id, size: 11, gap: 4 }));
          }),
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } },
            bucket.count > 1 ? bucket.count + t(' 项 · ') + bucket.names.slice(0, 2).join(t('、')) : (bucket.names[0] || t('积分')))
        )
      );
    }

    /* Cache hits are billed at a fraction of fresh input, so the ratio is the
       second most useful number on the row after the credits themselves. */
    function cacheSuffix(p) {
      var read = p.cacheReadTokens || 0;
      var fresh = p.inputTokens || 0;
      var all = read + fresh;
      if (!all) return '';
      return t(' · 命中 ') + Math.round(read / all * 100) + '%';
    }

    function ProviderList(props) {
      var all = props.providers || [];
      /* Two view states, both the reader's: a name filter over the rows already
         sent, and a family merge that folds per-model rows into one per family. */
      var qPair = React.useState('');
      var query = qPair[0], setQuery = qPair[1];
      var mergePair = React.useState(false);
      var merge = mergePair[0], setMerge = mergePair[1];
      var needle = query.trim().toLowerCase();
      var matched = all.filter(function (p) {
        if (!needle) return true;
        return (providerMeta(p.provider).label + ' ' + p.model).toLowerCase().indexOf(needle) >= 0;
      });
      var providers = (merge ? mergeProviders(matched) : matched).slice(0, 8);
      var hidden = Math.max(0, (needle ? matched.length : (props.total || all.length)) - providers.length);
      if (!all.length) return h('div', { style: { fontSize: 12, color: C.faint } }, t('暂无积分消耗'));
      var max = 0.0001;
      providers.forEach(function (p) { if (p.credits > max) max = p.credits; });
      var reported = props.total || all.length;
      return h('div', null,
        h(FilterStrip, {
          query: query,
          placeholder: t('按模型名筛选'),
          onQuery: setQuery
        },
          h(Chip, { on: merge, label: t('归并家族'), title: t('把同一家的模型合成一行'), onClick: function () { setMerge(!merge); } }),
          h('span', { style: { fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
            t('共 ') + reported + t(' 个模型') + (all.length < reported ? t('，只读到前 ') + all.length + t(' 个') : ''))
        ),
        /* 四个数字右对齐却没有列名，第一次看只能靠猜；表头把它们和下面的
           行钉在同一组宽度上。 */
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 4px',
            borderBottom: '1px solid ' + C.line, fontSize: 11, color: C.dim
          }
        },
          h('span', { style: { width: 14, flex: 'none' } }),
          h('span', { style: { flex: 1, minWidth: 0, marginLeft: 2 } }, t('模型')),
          h('span', { style: { width: 62, flex: 'none', textAlign: 'right' } }, 'token'),
          h('span', { style: { width: 40, flex: 'none', textAlign: 'right' } }, t('次')),
          h('span', { style: { width: 74, flex: 'none', textAlign: 'right' } }, t('积分 · 折合'))
        ),
        !providers.length ? h('div', { style: { fontSize: 11, color: C.faint } }, t('没有匹配的模型')) : null,
        providers.map(function (p) {
        var meta = providerMeta(p.provider);
        var color = meta.color;
        return h('div', { key: p.key, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' } },
          PlatformIcon({ id: p.provider, size: 14, gap: 0 }),
          h('div', { style: { flex: 1, minWidth: 0, marginLeft: 2 } },
            h('div', {
              title: meta.label + ' · ' + p.model,
              style: { fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
            }, meta.label + ' · ' + p.model),
            h('div', { style: { marginTop: 4 } }, Track({
              parts: [{ key: 'v', value: Math.max(p.credits, 0.0001), color: color }, { key: 'r', value: Math.max(max - p.credits, 0), color: 'transparent' }],
              height: 3
            }))
          ),
          /* 颜色只承担身份（图标、色条），数字回到中性色：平台的紫和
             「浪费/快到期」的红同屏出现时，红色会被读成两种意思。 */
          h('span', { title: cacheSuffix(p).replace(/^\s*·\s*/, ''), style: { width: 62, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, fmtCompact(p.tokens)),
          h('span', { style: { width: 40, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(p.calls)),
          h('span', {
            style: { width: 74, textAlign: 'right', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '15px' }
          },
            h('span', { style: { fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(p.credits)),
            MoneyNote({ costCny: p.costCny, free: p.free, unpriced: !p.priced })
          )
        );
      }).concat(hidden > 0 ? [h('div', {
        key: '__more',
        style: { paddingTop: 6, fontSize: 10, color: C.faint }
      }, hidden > 0 ? (needle ? t('另有 ') + hidden + t(' 个匹配未列出') : t('另有 ') + hidden + t(' 个模型未列出')) : '')] : []));
    }

    function SessionList(props) {
      var all = props.sessions || [];
      /* Filter, platform scope and tags are all reader-side state. Tags live in
         this browser only, so the section says so rather than implying the host
         knows about them. */
      var qPair = React.useState('');
      var query = qPair[0], setQuery = qPair[1];
      var platPair = React.useState('');
      var plat = platPair[0], setPlat = platPair[1];
      var tagPair = React.useState('');
      var tag = tagPair[0], setTag = tagPair[1];
      var bumpPair = React.useState(0);
      var bump = bumpPair[0], setBump = bumpPair[1];
      var tags = readTags();
      var needle = query.trim().toLowerCase();
      var plats = [];
      var tagNames = [];
      all.forEach(function (s) {
        var top = (s.top || '').split(':')[0];
        if (top && plats.indexOf(top) < 0) plats.push(top);
        if (tags[s.id] && tagNames.indexOf(tags[s.id]) < 0) tagNames.push(tags[s.id]);
      });
      var matched = all.filter(function (s) {
        if (plat && (s.top || '').split(':')[0] !== plat) return false;
        if (tag && tags[s.id] !== tag) return false;
        if (!needle) return true;
        return String(s.title || '').toLowerCase().indexOf(needle) >= 0;
      });
      var sessions = matched.slice(0, 12);
      var total = props.total || all.length;

      function editTag(id) {
        if (typeof window === 'undefined' || typeof window.prompt !== 'function') return;
        var current = readTags();
        var next = window.prompt(t('给这个会话打个标签（留空清除）'), current[id] || '');
        if (next === null) return;
        var value = String(next).trim().slice(0, 12);
        var map = readTags();
        if (value) map[id] = value; else delete map[id];
        writeTags(map);
        setBump(bump + 1);
      }

      return h('div', null,
        h(FilterStrip, {
          query: query,
          placeholder: t('按会话标题筛选'),
          onQuery: setQuery
        },
          plats.length > 1 ? h('span', { style: { display: 'inline-flex', gap: 4, flexWrap: 'wrap' } },
            h(Chip, { on: plat === '', label: t('全部'), onClick: function () { setPlat(''); } }),
            plats.map(function (id) {
              return h(Chip, {
                key: id,
                on: plat === id,
                label: PLATFORM[id] ? PLATFORM[id].short : id,
                onClick: function () { setPlat(plat === id ? '' : id); }
              });
            })
          ) : null,
          tagNames.length ? h('span', { style: { display: 'inline-flex', gap: 4, flexWrap: 'wrap' } },
            h(Chip, { on: tag === '', label: t('不限标签'), onClick: function () { setTag(''); } }),
            tagNames.map(function (name) {
              return h(Chip, {
                key: name,
                on: tag === name,
                label: name,
                onClick: function () { setTag(tag === name ? '' : name); }
              });
            })
          ) : null
        ),
        h('div', { style: { fontSize: 11, color: C.dim, marginBottom: 4, fontVariantNumeric: 'tabular-nums' } },
          t('显示 ') + sessions.length + ' / ' + total + t(' 条')
            + (total > all.length ? t('，只读到前 ') + all.length + t(' 条') : '')),
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 4px',
            borderBottom: '1px solid ' + C.line, fontSize: 11, color: C.dim
          }
        },
          h('span', { style: { width: 58, flex: 'none' } }, t('时间')),
          h('span', { style: { flex: 1, minWidth: 0 } }, t('会话')),
          h('span', { style: { width: 64, flex: 'none' } }),
          h('span', { style: { width: 40, flex: 'none', textAlign: 'right' } }, t('次')),
          h('span', { style: { width: 52, flex: 'none', textAlign: 'right' } }, 'token'),
          h('span', { style: { width: 74, flex: 'none', textAlign: 'right' } }, t('积分 · 折合'))
        ),
        !all.length ? h('div', { style: { fontSize: 12, color: C.faint } }, t('暂无积分会话')) : null,
        all.length && !sessions.length ? h('div', { style: { fontSize: 12, color: C.faint } }, t('没有匹配的会话')) : null,
        sessions.map(function (s, i) {
        var topProvider = (s.top || '').split(':')[0];
        var meta = topProvider ? providerMeta(topProvider) : null;
        var full = s.title || (s.top ? s.top.split(':')[1] : t('会话'));
        return h('div', {
          key: (s.id || 's') + '-' + i,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 0',
            borderBottom: '1px solid ' + C.line
          }
        },
          h('span', { style: { width: 58, flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } },
            (s.date || '').slice(5) + ' ' + fmtClock(s.at)),
          h('span', {
            title: full,
            style: {
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              color: C.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }
          },
            meta ? h('span', { style: { display: 'inline-flex', alignItems: 'center', verticalAlign: '-2px', marginRight: 4 } }, PlatformIcon({ id: topProvider, size: 12, gap: 3 })) : null,
            meta ? h('span', { style: { color: meta.ink || meta.color, marginRight: 6, fontSize: 11 } }, meta.label) : null,
            full
          ),
          h('span', { style: { width: 64, flex: 'none', display: 'flex', justifyContent: 'flex-end' } },
            h(Chip, {
              on: !!tags[s.id],
              label: tags[s.id] || t('＋标签'),
              title: t('点一下给这个会话打标签，只存在本浏览器'),
              onClick: function () { editTag(s.id); }
            })),
          h('span', { style: { width: 40, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(s.calls)),
          h('span', { style: { width: 52, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, fmtCompact(s.tokens)),
          h('span', {
            style: { width: 74, textAlign: 'right', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '15px' }
          },
            h('span', { style: { fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(s.credits)),
            MoneyNote({ costCny: s.costCny })
          )
        );
      }),
        h('div', { style: { fontSize: 11, color: C.dim, marginTop: 6 } },
          t('标签只存在本浏览器，会话滚出最近一段就失效。'))
      );
    }

    /* ---------- 跳出界面 ---------- */

    /* A credit that dies tomorrow is not worth a toast at 3am. Fire at most
       once per calendar day, only when something is actually going to waste,
       and only if the user opted in - permission is asked by the click, never
       on page load. */
    var NOTICE_KEY = 'dsh-credit-expiry:notified';

    function canNotify() {
      return typeof window !== 'undefined'
        && typeof window.Notification === 'function'
        && window.Notification.permission === 'granted';
    }

    function notifyOnce(rows, usage) {
      if (!canNotify() || !rows || !rows.length) return;
      var doomed = rows.filter(function (r) { return r.willWaste && r.wasted > 0; });
      if (!doomed.length) return;
      var stamp = dayKey(Date.now());
      var last = null;
      try { last = window.localStorage.getItem(NOTICE_KEY); } catch (e) { last = null; }
      if (last === stamp) return;
      var total = 0;
      doomed.forEach(function (r) { total += r.wasted; });
      try {
        new window.Notification(t('有积分会在用掉前过期'), {
          body: fmtAmount(total) + t(' 积分按当前速度用不完 · ') + adviceLine(rows, usage),
          tag: 'dsh-credit-expiry'
        });
        window.localStorage.setItem(NOTICE_KEY, stamp);
      } catch (e) { /* a blocked notification must never break the page */ }
    }

    function NotifyButton(props) {
      var pair = React.useState(canNotify() ? 'granted' : 'idle');
      var state = pair[0];
      var setState = pair[1];
      if (state === 'granted') {
        return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.faint } },
          Dot({ color: C.green, size: 4 }), t('到期提醒已开启'));
      }
      if (state === 'denied') {
        return h('span', { style: { fontSize: 10, color: C.faint } }, t('系统通知被浏览器拒绝'));
      }
      if (typeof window === 'undefined' || typeof window.Notification !== 'function') {
        return h('span', { style: { fontSize: 10, color: C.faint } }, t('此环境不支持系统通知'));
      }
      return h('button', {
        type: 'button',
        onClick: function () {
          try {
            var p = window.Notification.requestPermission();
            if (p && typeof p.then === 'function') {
              p.then(function (v) { setState(v === 'granted' ? 'granted' : 'denied'); });
            } else {
              setState(window.Notification.permission === 'granted' ? 'granted' : 'denied');
            }
          } catch (e) { setState('denied'); }
        },
        style: {
          border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
          borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer'
        }
      }, t('开启到期提醒'));
    }

    /* The whole page as one sentence, for pasting into a chat or a note. */
    function summaryText(items, buckets, usage, rows) {
      var lines = [t('积分到期 · ') + fmtFull(Date.now())];
      lines.push(t('合计 ') + fmtAmount(items.reduce(function (s, i) { return s + (i.remain || 0); }, 0)) + t(' 积分'));
      if (usage && usage.totals) {
        lines.push(t('已用 ') + fmtAmount(usage.totals.credits) + t(' 积分 ≈¥') + fmtPrecise(usage.totals.costCny)
          + ' · ' + usage.totals.calls + t(' 次 · ') + fmtCompact(usage.totals.tokens) + ' tok');
      }
      buckets.slice(0, 5).forEach(function (b) {
        lines.push('· ' + fmtDate(b.exp) + t(' 到期 ') + fmtAmount(b.total) + t('（') + b.names.join(t('、')) + t('）'));
      });
      var advice = rows ? adviceLine(rows, usage) : null;
      if (advice) lines.push(advice);
      return lines.join(String.fromCharCode(10));
    }

    function CopyButton(props) {
      var pair = React.useState('idle');
      var state = pair[0];
      var setState = pair[1];
      var settle = function (ok) {
        setState(ok ? 'done' : 'failed');
        setTimeout(function () { setState('idle'); }, 1600);
      };
      /* A plain-http origin has no navigator.clipboard, and claiming t('已复制')
         there means the reader walks away with nothing on their clipboard. */
      var legacyCopy = function (text) {
        try {
          var area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          var ok = document.execCommand && document.execCommand('copy');
          document.body.removeChild(area);
          return !!ok;
        } catch (e) {
          return false;
        }
      };
      return h('button', {
        type: 'button',
        title: t('把整页摘要复制成文本'),
        onClick: function () {
          var text = props.text();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { settle(true); }, function () { settle(legacyCopy(text)); });
            return;
          }
          settle(legacyCopy(text));
        },
        style: {
          border: '1px solid ' + C.line, background: 'transparent',
          color: state === 'done' ? C.green : (state === 'failed' ? C.red : C.dim),
          borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer'
        }
      }, state === 'done' ? t('已复制') : (state === 'failed' ? t('复制失败') : t('复制摘要')));
    }

    /* A download, not a clipboard: the point of an export is to survive this
       page, and a copied table does not. The host builds the file so the numbers
       are the ones it just measured, not a second reconstruction here. */
    function ExportButton(props) {
      var format = props.format;
      return h('a', {
        href: EXPORT_API + '?format=' + format,
        download: '',
        title: t('把本次读到的数据下载成文件'),
        style: {
          border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
          borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer',
          textDecoration: 'none', display: 'inline-block', lineHeight: '14px'
        }
      }, props.label);
    }

    /* Switching a preset mutates the module-level scale and asks the page to
       redraw. Every colour on the page reads levelOf() at render time, so one
       re-render recolours rows, calendar and mini entry together.
       IMPORTANT: render as a real element (h(ThresholdPicker, ...)), never call
       it as a plain function - its useState must belong to its own instance, or
       the containing panel's hook count changes when a tab hides this block. */
    function ThresholdPicker(props) {
      var pair = React.useState(ACTIVE.id);
      var active = pair[0];
      var setActive = pair[1];
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        h('span', { style: { fontSize: 10, color: C.faint, marginRight: 2 } }, t('临期档位')),
        THRESHOLD_PRESETS.map(function (p) {
          var on = p.id === active;
          return h('button', {
            key: p.id,
            type: 'button',
            title: p.l7 + ' / ' + p.l30 + ' / ' + p.l90 + t(' 天'),
            onClick: function () {
              ACTIVE = p;
              LEVELS = levelsOf(p);
              try { window.localStorage.setItem(THRESHOLD_KEY, p.id); } catch (e) { /* private mode */ }
              setActive(p.id);
              scaleEmit();
              if (props.onChange) props.onChange();
            },
            style: {
              border: '1px solid ' + (on ? C.accent : C.line),
              background: on ? C.soft : 'transparent',
              color: on ? C.accent : C.faint,
              borderRadius: 5,
              padding: '2px 7px',
              fontSize: 10,
              cursor: 'pointer'
            }
          }, p.label);
        })
      );
    }

    /* ---------- settings ---------- */

    /* One entry per toggleable block, in the order the page renders them. The id
       is the preference key; the label is what a reader calls that block. */
    function makeSectionMeta() {
      return [
        { id: 'forecast', group: 'overview', label: t('到期预测'), hint: t('按当前消耗速度推算哪些积分会用不完') },
        { id: 'burndown', group: 'overview', label: t('消耗速度 / 可用天数'), hint: t('每个平台的余额还够用几天') },
        { id: 'subscription', group: 'overview', label: t('周期额度与重置日'), hint: t('按月发放、会刷新的额度及其重置时间') },
        { id: 'doubao', group: 'overview', label: t('豆包额度'), hint: t('豆包额度 · 赠送会过期，订阅会刷新') },
        { id: 'codex', group: 'overview', label: t('GPT / Codex 额度'), hint: t('ChatGPT 订阅的限速窗口与积分') },
        { id: 'modelscope', group: 'overview', label: t('魔搭魔粒'), hint: t('今天还能用多少魔粒，每天重置') },
        { id: 'platforms', group: 'balances', label: t('按平台'), hint: t('每个平台的余额、构成与最近到期') },
        { id: 'buckets', group: 'balances', label: t('按到期日'), hint: t('把同一天到期的积分并成一行') },
        { id: 'ledger', group: 'balances', label: t('积分账本'), hint: t('每个积分包的剩余 / 总量 / 已用 / 到期') },
        { id: 'calendar', group: 'balances', label: t('到期日历'), hint: t('按月看每天有多少积分到期') },
        { id: 'daily', group: 'usage', label: t('积分消耗'), hint: t('日柱图、峰谷占比与模型用量') },
        { id: 'providers', group: 'usage', label: t('模型用量'), hint: t('每个模型的 token、命中率与金额') },
        { id: 'sessions', group: 'usage', label: t('积分会话'), hint: t('最近用过积分的会话') },
        { id: 'keys', group: 'accounts', label: t('API 密钥余额'), hint: t('用自己 API 密钥读到的现金余额（密钥只存在本机）') },
        { id: 'accounts', group: 'accounts', label: t('其他账号与凭据'), hint: t('WorkBuddy 其他账号、登录凭据倒计时') }
      ];
    }
    var SECTION_META = makeSectionMeta();

    function makeMiniMeta() {
      return [
        { id: 'total', label: t('余额合计') },
        { id: 'modelscope', label: t('魔搭魔粒') },
        { id: 'waste', label: t('会用不完的积分') },
        { id: 'platforms', label: t('各平台的分项余额') },
        { id: 'soon', label: t('最近的到期行') },
        { id: 'spark', label: t('近 7 天走势线') },
        { id: 'open', label: t('底部「打开面板」入口') }
      ];
    }
    var MINI_META = makeMiniMeta();

    function Switch(props) {
      var on = !!props.on;
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': on ? 'true' : 'false',
        title: props.title || '',
        onClick: props.onClick,
        style: {
          width: 34, height: 18, borderRadius: 9, padding: 0, flex: 'none',
          border: '1px solid ' + (on ? C.accent : C.line),
          background: on ? C.accent : 'transparent',
          cursor: 'pointer', position: 'relative', transition: 'background 140ms ease'
        }
      }, h('span', {
        style: {
          position: 'absolute', top: 2, left: on ? 17 : 2,
          width: 12, height: 12, borderRadius: '50%',
          background: on ? '#fff' : C.faint,
          transition: 'left 140ms ease'
        }
      }));
    }

    function SettingsRow(props) {
      /* SettingsRow is called as a plain function from inside a .map(), so the
         key has to land on the element it returns, not on the call. */
      return h('div', {
        key: props.key,
        className: 'cxe-row',
        style: {
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '11px 8px', margin: '0 -8px', borderRadius: 6,
          borderBottom: '1px solid ' + C.line
        }
      },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontSize: 13, color: C.text } }, props.label),
          props.hint ? h('div', { style: { fontSize: 11, color: C.faint, marginTop: 3, lineHeight: '15px' } }, props.hint) : null
        ),
        props.children
      );
    }

    function ChoiceRow(props) {
      return h('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
        props.options.map(function (option) {
          var on = option.value === props.value;
          return h('button', {
            key: String(option.value),
            type: 'button',
            onClick: function () { props.onPick(option.value); },
            style: {
              border: '1px solid ' + (on ? C.accent : C.line),
              background: on ? C.soft : 'transparent',
              color: on ? C.accent : C.dim,
              fontWeight: on ? 600 : 400,
              borderRadius: R.pill, padding: '3px 10px', fontSize: 11,
              lineHeight: '16px', cursor: 'pointer'
            }
          }, option.label);
        })
      );
    }

    function setPref(path, value) {
      var next = clonePrefs(PREFS);
      if (path[0] === 'sections') next.sections[path[1]] = value;
      else if (path[0] === 'mini') next.mini[path[1]] = value;
      else if (path[0] === 'platforms') next.platforms[path[1]] = value;
      else if (path[0] === 'cal') next.cal[path[1]] = value;
      else next[path[0]] = value;
      savePrefs(next);
    }

    function SettingsEntry(props) {
      var prefs = PREFS;
      var enabled = 0;
      SECTION_META.forEach(function (meta) { if (prefs.sections[meta.id]) enabled += 1; });
      return h('div', {
        style: { height: '100%', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box', color: C.text, fontSize: 13 }
      },
        Styles(),
        h('div', { style: { maxWidth: 780, margin: '0 auto', padding: '24px 26px 44px', boxSizing: 'border-box' } },
          h('div', {
            style: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: '1px solid ' + C.line }
          },
            h('button', {
              type: 'button',
              onClick: props.onBack,
              title: t('返回积分面板'),
              style: {
                border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
                borderRadius: 6, width: 26, height: 26, padding: 0, margin: 0,
                boxSizing: 'border-box', cursor: 'pointer', fontSize: 13, lineHeight: 1, flex: 'none'
              }
            }, '‹'),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { fontSize: 20, fontWeight: 650, letterSpacing: -0.2, lineHeight: '24px' } }, t('显示设置')),
              h('div', { style: { fontSize: 11, color: C.faint, marginTop: 2 } }, t('只影响这台机器上的这一套面板，改动立刻生效并存进浏览器本地。'))
            )
          ),
          Section({
            eyebrow: t('显示'),
            title: t('页面区块'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, enabled + ' / ' + SECTION_META.length + t(' 个已显示')),
            /* Fifteen switches in one column read as a wall. They already carry
               a group id, so show them under the same four zone headings the
               panel uses - each group is short and self-explanatory. */
            children: h('div', { style: { display: 'grid', gap: 16 } },
              [
                { id: 'overview', label: t('总览') },
                { id: 'balances', label: t('余额与到期') },
                { id: 'usage', label: t('用量与消耗') },
                { id: 'accounts', label: t('账号与密钥') }
              ].map(function (grp) {
                var rows = SECTION_META.filter(function (m) { return m.group === grp.id; });
                if (!rows.length) return null;
                var onCount = rows.filter(function (m) { return prefs.sections[m.id]; }).length;
                var allOn = onCount === rows.length;
                return h('div', { key: grp.id },
                  /* 一组开关的头：组名、开了几个、以及一键全开/全关——十五个开关
                     逐个点时，这两个字比什么说明都实用。 */
                  h('div', {
                    style: {
                      display: 'flex', alignItems: 'center', gap: 8,
                      paddingBottom: 6, marginBottom: 2, borderBottom: '1px solid ' + C.line
                    }
                  },
                    h('span', { style: { fontSize: 11, fontWeight: 600, letterSpacing: 0.3, color: C.text } }, grp.label),
                    h('span', { style: { fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' } }, onCount + ' / ' + rows.length),
                    h('span', { style: { flex: 1 } }),
                    h('button', {
                      type: 'button',
                      onClick: function () {
                        rows.forEach(function (m) { setPref(['sections', m.id], !allOn); });
                      },
                      style: {
                        border: 'none', background: 'transparent', color: C.dim,
                        fontSize: 10, cursor: 'pointer', padding: '1px 4px', borderRadius: R.sm
                      }
                    }, allOn ? t('全部关闭') : t('全部开启'))
                  ),
                  h('div', { style: { display: 'grid', gap: 2 } }, rows.map(function (m) {
                    return SettingsRow({
                      key: m.id,
                      label: m.label,
                      hint: m.hint,
                      children: Switch({
                        on: prefs.sections[m.id],
                        onClick: function () { setPref(['sections', m.id], !prefs.sections[m.id]); }
                      })
                    });
                  }))
                );
              })
            )
          }),
          Section({
            eyebrow: t('显示'),
            title: t('侧栏卡片'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('不打开页面时能看到的全部信息')),
            children: h('div', null,
              SettingsRow({
                label: t('侧栏版式'),
                hint: t('三种版式用同一份数据，只是排法不同；下面每项都能单独关掉'),
                children: ChoiceRow({
                  value: prefs.mini.layout,
                  options: [
                    { value: 'focus', label: t('焦点') },
                    { value: 'list', label: t('清单') },
                    { value: 'grid', label: t('网格') }
                  ],
                  onPick: function (value) { setPref(['mini', 'layout'], value); }
                })
              }),
              MINI_META.map(function (meta) {
                return SettingsRow({
                  key: meta.id,
                  label: meta.label,
                  children: Switch({
                    on: prefs.mini[meta.id],
                    onClick: function () { setPref(['mini', meta.id], !prefs.mini[meta.id]); }
                  })
                });
              }),
              SettingsRow({
                label: t('侧栏显示平台'),
                hint: t('关掉的平台不出现在侧栏合计与图标行'),
                children: h('div', { style: { display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' } }, BALANCE_ORDER.map(function (id) {
                  return h('span', { key: id, style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.dim } },
                    PlatformIcon({ id: id, size: 12, gap: 2 }),
                    Switch({ on: prefs.platforms[id], onClick: function () { setPref(['platforms', id], !prefs.platforms[id]); } })
                  );
                }))
              }),
              SettingsRow({
                label: t('侧栏显示几行近期到期'),
                hint: t('0 = 只看合计'),
                children: ChoiceRow({
                  value: prefs.mini.rows,
                  options: [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }],
                  onPick: function (value) { setPref(['mini', 'rows'], value); }
                })
              })
            )
          }),
          Section({
            eyebrow: t('数据'),
            title: t('刷新频率'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('每次刷新要打一次上游')),
            children: h('div', null,
              SettingsRow({
                label: t('面板开着时的轮询间隔'),
                hint: t('标签页在后台时不轮询；读取失败会按间隔翻倍退避，最长 10 分钟。'),
                children: ChoiceRow({
                  value: prefs.refreshMs,
                  options: REFRESH_CHOICES.map(function (c) { return { value: c.ms, label: c.label }; }),
                  onPick: function (value) { setPref(['refreshMs'], value); }
                })
              })
            )
          }),
          Section({
            eyebrow: t('集成'),
            title: t('API 密钥余额'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('密钥只存本机，不写仓库')),
            children: h(KeyManager)
          }),
          Section({
            eyebrow: t('集成'),
            title: t('IM 推送'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('把摘要推到群里')),
            children: h(NotifyConfig, { notify: props.notify, buildText: props.buildText })
          }),
          Section({
            eyebrow: t('其它'),
            title: t('语言'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('界面文案')),
            children: SettingsRow({
              label: t('显示语言'),
              hint: t('切换后整页立即重绘，设置存在本机。'),
              children: ChoiceRow({
                value: prefs.lang,
                options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }],
                onPick: function (value) { setLang(value); }
              })
            })
          }),
          Section({
            title: t('临期档位'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('决定多少天算「快到期」')),
            children: SettingsRow({
              label: t('颜色分档'),
              hint: t('紧 3/7/30 · 标准 7/30/90 · 宽 14/60/180 天'),
              /* ThresholdPicker owns the preset itself (it is module state the
                 sidebar row also reads); this parent only needs to repaint. */
              children: h(ThresholdPicker, { onChange: function () { } })
            })
          }),
          Section({
            title: t('界面密度'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('行距与留白，只影响这一页')),
            children: SettingsRow({
              label: t('密度'),
              hint: t('紧凑：一屏多看几行；舒适：保持原来的留白'),
              children: h(ChoiceRow, {
                value: prefs.density === 'compact' ? 'compact' : 'comfort',
                options: [{ value: 'comfort', label: t('舒适') }, { value: 'compact', label: t('紧凑') }],
                onPick: function (v) { setPref('density', v); }
              })
            })
          }),
          h('div', { style: { marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
            h('button', {
              type: 'button',
              onClick: exportPrefs,
              title: t('把当前设置存成 JSON 文件'),
              style: { border: '1px solid ' + C.line, background: 'transparent', color: C.dim, borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }
            }, t('导出设置')),
            h('label', {
              title: t('从 JSON 文件恢复设置'),
              style: { border: '1px solid ' + C.line, color: C.dim, borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', display: 'inline-block' }
            }, t('导入设置'),
              h('input', {
                type: 'file', accept: 'application/json,.json',
                style: { display: 'none' },
                onChange: function (e) { importPrefs(e.target.files && e.target.files[0]); e.target.value = ''; }
              })
            )
          ),
          h('div', { style: { marginTop: 22, display: 'flex', gap: 8 } },
            h('button', {
              type: 'button',
              onClick: function () {
                try { window.localStorage.removeItem(PREFS_KEY); } catch (e) { /* private mode */ }
                savePrefs(clonePrefs(null));
              },
              style: {
                border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
                borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer'
              }
            }, t('恢复默认')),
            h('button', {
              type: 'button',
              onClick: props.onBack,
              style: {
                border: '1px solid ' + C.accent, background: 'transparent', color: C.accent,
                borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer'
              }
            }, t('看效果'))
          ),
          h('div', { style: { marginTop: 20, fontSize: 10, color: C.faint, lineHeight: '16px' } },
            t('设置存在浏览器的 localStorage 里（键 ') + PREFS_KEY + t('），不上传、不写磁盘。换浏览器或清缓存后会回到默认。')
          )
        )
      );
    }

    /* The panel grew to 13 blocks in one long scroll; readers lost the thread.
       Four zones keep the same blocks (and the same per-block switches) but show
       one zone at a time: overview answers "am I OK", balances is the detail
       workbench, usage explains the burn, accounts holds the rarely-opened
       credentials. The active zone is remembered in localStorage, not in
       PREFS, so the settings export format stays untouched. */
    /**
     * 订阅与额度：把七家平台的订阅/套餐/到期/刷新收在一张独立页签里。
     * 每家一张带线框的小卡，最近的时间点提到第一行并按紧急程度着色，
     * 一眼就能看出「哪家快到期、哪家要刷新、哪家没订阅、哪家没读上来」。
     */
    /* One row per platform: plan, quota, and the next deadline. Pulled out of
       the tab so the overview short list and the subscription tab read the same
       numbers instead of each keeping its own copy of the rules. */
    function subscriptionRows(data) {
      data = data || {};
      function mk(id, o) {
        o = o || {};
        var exp = typeof o.expMs === 'number' ? o.expMs : null;
        var reset = typeof o.resetMs === 'number' ? o.resetMs : null;
        var deadline = exp !== null ? exp : reset;
        var kind = exp !== null ? 'expiry' : (reset !== null ? 'reset' : null);
        var days = deadline !== null ? daysLeft(deadline) : null;
        return {
          id: id, plan: o.plan || null, remain: o.remain, size: o.size,
          remainText: o.remainText || null, expMs: exp, resetMs: reset,
          deadline: deadline, kind: kind, days: days,
          soon: !!(days !== null && days >= 0 && days <= ACTIVE.l7),
          missing: !!o.missing, none: !!o.none, plain: !!o.plain, note: o.note || null
        };
      }
      var rows = [];
      /* WorkBuddy：月度周期额度 */
      var wb = data.wb;
      if (wb && wb.status && wb.status !== 'signed-out' && wb.status !== 'failed') {
        var ws = wb.subscription || null;
        rows.push(mk('wb', { plan: ws ? ws.label : null, remain: ws ? ws.remain : null,
          size: ws ? ws.size : null, resetMs: ws ? ws.resetAtMs : null,
          expMs: ws ? ws.expiresAtMs : null, none: !ws, note: ws ? t('按月刷新') : null }));
      } else rows.push(mk('wb', { missing: true }));
      /* Trae：连接插件不返回套餐名，只有「有/无订阅」标志 */
      var tr = data.tr;
      if (tr && tr.status && tr.status !== 'signed-out' && tr.status !== 'failed') {
        rows.push(mk('tr', { plan: tr.plan || (tr.hasPlan ? t('订阅套餐') : null),
          expMs: null, none: !tr.hasPlan }));
      } else rows.push(mk('tr', { missing: true }));
      /* MiniMax：会员计划（tier + 到期） */
      var mm = data.mm;
      if (mm && mm.status && mm.status !== 'signed-out' && mm.status !== 'failed') {
        var mp = mm.plan || null;
        rows.push(mk('mm', { plan: mp && mp.tier ? t('套餐：') + mp.tier : null,
          expMs: mp ? mp.expiresAtMs : null, none: !(mp && mp.active) }));
      } else rows.push(mk('mm', { missing: true }));
      /* Qoder：套餐到期日就是积分作废日 */
      var qd = data.qd;
      if (qd && qd.status && qd.status !== 'signed-out' && qd.status !== 'failed') {
        var qs = qd.subscription || null;
        rows.push(mk('qd', { plan: qs ? qs.label : null, remain: qs ? qs.remain : null,
          size: qs ? qs.size : null, expMs: qs ? qs.expiresAtMs : null, none: !qs }));
      } else rows.push(mk('qd', { missing: true }));
      /* 豆包：订阅窗口到点补满 */
      var db = data.db;
      if (db && db.status === 'ok') {
        var ds = db.subscription || null;
        rows.push(mk('db', { plan: db.plan || null, remain: ds ? ds.remain : null,
          size: ds ? ds.size : null, resetMs: ds ? ds.resetAtMs : null,
          none: !ds, note: ds ? t('订阅额度 · 到点补满') : null }));
      } else rows.push(mk('db', { missing: true }));
      /* Codex：限速窗口刷新 + 积分余额（美元，单独注明） */
      var cx = data.cx;
      if (cx && cx.status === 'ok') {
        var cxReset = null;
        (cx.windows || []).forEach(function (w) {
          if (w && w.resetsAtMs && (cxReset === null || w.resetsAtMs < cxReset)) cxReset = w.resetsAtMs;
        });
        var cash = (cx.creditsBalance !== null && cx.creditsBalance !== undefined)
          ? '$ ' + fmtPrecise(cx.creditsBalance) : null;
        rows.push(mk('cx', { plan: cx.plan || t('订阅套餐'), resetMs: cxReset,
          expMs: cx.creditsExpiresAtMs || null, remainText: cash }));
      } else rows.push(mk('cx', { missing: true }));
      /* 魔搭：每天重置的魔粒，不是订阅但仍在这里给个入口 */
      var ms = data.ms;
      if (ms && ms.status === 'ok') {
        rows.push(mk('ms', { plan: null,
          remainText: fmtAmount(ms.balance) + ' / ' + fmtAmount(ms.maxBudget || 0),
          plain: true, note: t('每天重置') }));
      } else rows.push(mk('ms', { missing: true }));

      /* 紧急的排前面，没读上来的排后面 */
      rows.sort(function (a, b) {
        if (a.soon !== b.soon) return a.soon ? -1 : 1;
        if (a.missing !== b.missing) return a.missing ? 1 : -1;
        if (a.deadline === null && b.deadline !== null) return 1;
        if (a.deadline !== null && b.deadline === null) return -1;
        if (a.deadline !== null && b.deadline !== null) return a.deadline - b.deadline;
        return 0;
      });
      return rows;
    }

    function SubscriptionOverview(props) {
      var data = props.data || {};
      var rows = subscriptionRows(data);

      function deadlineText(r) {
        if (r.deadline === null || r.days === null) return t('长期');
        if (r.days < 0) return t('已过期');
        if (r.days === 0) return r.kind === 'expiry' ? t('今天到期') : t('今天重置');
        return r.days + (r.kind === 'expiry' ? t(' 天后到期') : t(' 天后刷新'));
      }
      function deadlineColor(r) {
        if (r.deadline === null || r.days === null) return C.faint;
        return levelColor(levelOf(r.deadline));
      }
      function badge(r) {
        var text = null;
        if (r.soon) text = r.kind === 'expiry' ? t('快到期') : t('需刷新');
        else if (r.missing) text = t('没有读取到订阅信息');
        else if (r.none) text = t('未订阅');
        if (!text) return null;
        var color = r.soon ? C.red : (r.missing ? C.orange : C.dim);
        return h('span', { style: { fontSize: 10, color: color, border: '1px solid ' + color,
          borderRadius: R.pill, padding: '1px 7px', whiteSpace: 'nowrap' } }, text);
      }
      return h('div', null,
        h('div', { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } },
          rows.map(function (r) {
            var meta = PLATFORM[r.id];
            var note = r.note;
            var quota = r.remainText || ((r.remain !== null && r.remain !== undefined)
              ? fmtAmount(r.remain) + (r.size ? ' / ' + fmtAmount(r.size) : '') : null);
            /* 一张平台一张白卡：药丸在上、大字余额居中、到期日与备注在下。
               底色只给“快到期”的那张，其余一律白卡，靠边线分层。 */
            return h('div', {
              key: r.id,
              className: r.soon ? 'cxe-card' : 'cxe-card',
              style: {
                display: 'flex', flexDirection: 'column', gap: 8,
                border: '1px solid ' + (r.soon ? 'rgba(229,72,77,0.55)' : C.line),
                borderRadius: R.lg,
                padding: '11px 12px 12px',
                background: r.soon ? 'rgba(229,72,77,0.05)' : C.bg
              }
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                meta ? h('span', {
                  style: {
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px 2px 5px', borderRadius: R.pill,
                    background: meta.tint, color: meta.ink, fontSize: 10, fontWeight: 600
                  }
                }, PlatformIcon({ id: r.id, size: 11, gap: 0 }), meta.label)
                  : h('span', { style: { fontSize: 11, fontWeight: 600 } }, r.id),
                h('span', { style: { flex: 1 } }),
                badge(r)
              ),
              quota ? h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4 } },
                h('span', { style: { fontSize: FS.lg, fontWeight: 650, letterSpacing: -0.3, lineHeight: '22px', color: C.text, fontVariantNumeric: 'tabular-nums' } }, quota),
                h('span', { style: { fontSize: FS.xxs, color: C.dim } }, t('积分'))
              ) : h('div', { style: { fontSize: FS.sm, color: C.faint } }, t('未读到额度')),
              h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: FS.xxs, color: C.dim } },
                h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, color: deadlineColor(r) } },
                  r.deadline !== null && r.days !== null ? Dot({ color: deadlineColor(r), size: 5 }) : null,
                  deadlineText(r)),
                r.plan ? h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.plan) : null
              ),
              note ? h('div', { style: { fontSize: FS.xxs, color: C.faint } }, note) : null
            );
          })
        ),
        /* 额度构成只在这张页签里讲：豆包是赠送 + 订阅两段，Codex 是限速窗口 +
           美元余额，魔搭是每天重置的魔粒——口径和上面的平台卡不同，单独一张卡
           才不会混进“积分数”里。总览不再复制这一块。 */
        (data.db && data.db.status === 'ok') || (data.cx && data.cx.status === 'ok') || (data.ms && data.ms.status === 'ok')
          ? h('div', { style: { marginTop: 14 } },
            h('div', { style: { fontSize: 10, color: C.faint, marginBottom: 8 } },
              t('额度构成：这些额度的余额怎么来的，和积分不是一回事')),
            h('div', { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'start' } },
              data.db && data.db.status === 'ok'
                ? h('div', { style: { minWidth: 0, border: '1px solid ' + C.line, borderRadius: R.lg, padding: '11px 12px', background: C.bg } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.dim, marginBottom: 8, fontWeight: 600 } },
                    PlatformIcon({ id: 'db', size: 13, gap: 2 }), t('豆包额度')),
                  DoubaoQuota({ db: data.db }))
                : null,
              data.cx && data.cx.status === 'ok'
                ? h('div', { style: { minWidth: 0, border: '1px solid ' + C.line, borderRadius: R.lg, padding: '11px 12px', background: C.bg } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.dim, marginBottom: 8, fontWeight: 600 } },
                    PlatformIcon({ id: 'cx', size: 13, gap: 2 }), t('GPT / Codex 额度')),
                  CodexQuota({ cx: data.cx }))
                : null,
              data.ms && data.ms.status === 'ok'
                ? h('div', { style: { minWidth: 0, border: '1px solid ' + C.line, borderRadius: R.lg, padding: '11px 12px', background: C.bg } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.dim, marginBottom: 8, fontWeight: 600 } },
                    PlatformIcon({ id: 'ms', size: 13, gap: 2 }), t('魔搭魔粒')),
                  ModelScopeQuota({ ms: data.ms }))
                : null
            )
          )
          : null
      );
    }

    /* The overview never repeats the detail of the subscription tab. It shows only
       the rows that need acting on, one line each, and hands the rest over.
       The per-source switches still gate their own row, so a block switched off
       in settings cannot sneak back as a line here. */
    var QUOTA_SECTION = { wb: 'subscription', db: 'doubao', cx: 'codex', ms: 'modelscope' };
    function quotaGlanceRows(rows) {
      return (rows || []).filter(function (r) {
        var gate = QUOTA_SECTION[r.id];
        return !gate || showSection(gate);
      });
    }
    function QuotaGlance(props) {
      var rows = props.rows || [];
      var onGo = props.onGo || function () {};
      var urgent = rows.filter(function (r) { return r.soon || r.missing; });
      var list = urgent.length ? urgent.slice(0, 3) : rows.slice(0, 4);
      if (!list.length) {
        return h('div', { style: { fontSize: 11, color: C.faint } }, t('没有读到任何平台的额度信息'));
      }
      function deadlineText(r) {
        if (r.deadline === null || r.days === null) return t('长期');
        if (r.days < 0) return t('已过期');
        if (r.days === 0) return r.kind === 'expiry' ? t('今天到期') : t('今天重置');
        return r.days + (r.kind === 'expiry' ? t(' 天后到期') : t(' 天后刷新'));
      }
      return h('div', null,
        h('div', { style: { display: 'grid', gap: 7 } },
          list.map(function (r) {
            var meta = PLATFORM[r.id];
            var color = r.soon ? C.red : (r.deadline === null ? C.faint : levelColor(levelOf(r.deadline)));
            var quota = r.remainText || ((r.remain !== null && r.remain !== undefined)
              ? fmtAmount(r.remain) + (r.size ? ' / ' + fmtAmount(r.size) : '') : null);
            return h('div', {
              key: r.id,
              style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, minWidth: 0 }
            },
              meta
                ? h('span', {
                  style: {
                    display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none',
                    padding: '1px 7px 1px 4px', borderRadius: R.pill,
                    background: meta.tint, color: meta.ink, fontSize: 10, fontWeight: 600
                  }
                }, PlatformIcon({ id: r.id, size: 10, gap: 0 }), meta.label)
                : h('span', { style: { fontSize: 10 } }, r.id),
              h('span', {
                style: {
                  flex: 1, minWidth: 0, color: r.soon ? C.red : C.dim,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }
              }, deadlineText(r) + (r.note ? ' · ' + r.note : '')),
              h('span', { style: { flex: 'none', color: color, fontVariantNumeric: 'tabular-nums' } }, quota || '—')
            );
          })
        ),
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            marginTop: 10, paddingTop: 9, borderTop: '1px solid ' + C.line, fontSize: 10, color: C.faint
          }
        },
          h('span', null, urgent.length
            ? urgent.length + t(' 个平台要处理，其余在「订阅与额度」里')
            : rows.length + t(' 个平台的套餐与刷新日都还宽裕')),
          h('button', {
            type: 'button',
            onClick: onGo,
            style: {
              border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
              borderRadius: R.pill, padding: '2px 9px', fontSize: 10, cursor: 'pointer', flex: 'none'
            }
          }, t('订阅与额度') + ' \u203A')
        )
      );
    }

    function subscriptionCount(data) {
      var n = 0;
      ['wb', 'tr', 'mm', 'qd', 'db', 'cx', 'ms'].forEach(function (id) {
        var p = data && data[id];
        if (p && p.status && p.status !== 'signed-out' && p.status !== 'failed') n++;
      });
      return n;
    }

    var PANEL_TAB_KEY = 'dsh-credit-expiry:tab';
    /* Jump links for the long tabs: the sections already carry their own scroll
       anchors, so this is a row of buttons over the existing meta - no second
       copy of the section list. */
    function TabAnchors(props) {
      var items = props.items || [];
      if (items.length < 2) return null;
      return h('div', {
        className: 'cxe-noprint',
        style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }
      },
        h('span', { style: { fontSize: 10, color: C.faint } }, t('跳到')),
        items.map(function (m) {
          return h('button', {
            key: m.id,
            type: 'button',
            onClick: function () {
              var node = document.getElementById('cxe-sec-' + m.id);
              if (!node || !node.scrollIntoView) return;
              var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            },
            style: {
              border: '1px solid ' + C.line,
              background: 'transparent',
              color: C.dim,
              borderRadius: 999,
              padding: '2px 9px',
              fontSize: 10,
              cursor: 'pointer'
            }
          }, m.label);
        })
      );
    }

    function makePanelTabs() {
      return [
        { id: 'overview', label: t('总览'), hint: t('余额有多少、什么时候过期、先用哪家') },
        { id: 'subscriptions', label: t('订阅与额度'), hint: t('各平台的订阅套餐与到期 / 刷新一览，一眼看出哪个要处理') },
        { id: 'balances', label: t('余额与到期'), hint: t('每个积分包的明细、按天和按月看到期') },
        { id: 'usage', label: t('用量与消耗'), hint: t('花得多快、花在哪些模型和会话上') },
        { id: 'accounts', label: t('账号与密钥'), hint: t('其他账号、登录凭据与现金余额') }
      ];
    }
    function readPanelTab() {
      try {
        var v = window.localStorage.getItem(PANEL_TAB_KEY);
        if (v === 'overview' || v === 'subscriptions' || v === 'balances' || v === 'usage' || v === 'accounts') return v;
      } catch (e) { /* storage unavailable: fall through */ }
      return 'overview';
    }
    function PanelTabs(props) {
      var tabs = makePanelTabs();
      var active = props.active;
      var risk = props.risk || {};
      function go(id) {
        if (id === active) return;
        try { window.localStorage.setItem(PANEL_TAB_KEY, id); } catch (e) { /* ignore */ }
        props.onChange(id);
      }
      return h('div', {
        className: 'cxe-noprint',
        style: {
          position: 'sticky', top: 0, zIndex: 6, background: C.bg,
          padding: '10px 0 6px', marginBottom: 6
        }
      },
        h('div', {
          role: 'tablist',
          /* A segmented track instead of an underline row: the strip is a control
             that belongs to the page, not a rule the content hangs off. */
          style: {
            display: 'flex', gap: 2, padding: 3, borderRadius: R.pill,
            background: C.soft, overflowX: 'auto'
          }
        },
          tabs.map(function (tb) {
            var on = tb.id === active;
            var riskN = risk[tb.id] || 0;
            return h('button', {
              key: tb.id, type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false',
              title: tb.hint, onClick: function () { go(tb.id); },
              onKeyDown: function (e) {
                var ids = tabs.map(function (t) { return t.id; });
                var at = ids.indexOf(active);
                var nextAt = null;
                if (e.key === 'ArrowRight') nextAt = (at + 1) % ids.length;
                else if (e.key === 'ArrowLeft') nextAt = (at - 1 + ids.length) % ids.length;
                else if (e.key === 'Home') nextAt = 0;
                else if (e.key === 'End') nextAt = ids.length - 1;
                if (nextAt === null) return;
                e.preventDefault();
                go(ids[nextAt]);
                var nodes = e.currentTarget && e.currentTarget.parentNode ? e.currentTarget.parentNode.children : null;
                if (nodes && nodes[nextAt] && nodes[nextAt].focus) nodes[nextAt].focus();
              },
              style: {
                border: 'none', cursor: 'pointer', flex: 'none',
                padding: '5px 11px', borderRadius: R.pill,
                fontSize: 11.5, fontWeight: on ? 600 : 400,
                color: on ? C.text : C.dim,
                background: on ? C.bg : 'transparent',
                boxShadow: on ? '0 1px 2px rgba(0,0,0,0.10)' : 'none',
                display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap'
              }
            },
              tb.label,
              riskN > 0
                ? h('span', {
                  title: t('7 天内到期'),
                  style: {
                    fontSize: 10, fontWeight: 600, color: C.red,
                    background: 'rgba(229,72,77,0.12)', borderRadius: 999,
                    padding: '1px 6px', fontVariantNumeric: 'tabular-nums'
                  }
                }, riskN + t(' 笔临期'))
                : null
            );
          })
        ),
        /* The hint used to hide in the tooltip; under the strip it tells
           the reader what this tab answers before they scroll. */
        h('div', { style: { fontSize: 10, color: C.faint, marginTop: 6, paddingLeft: 3 } },
          (tabs.filter(function (tb) { return tb.id === active; })[0] || {}).hint || '')
      );
    }

    function PanelView(props) {
      var pair = useData();
      var state = pair[0];
      var load = pair[1];
      var updateTriple = useUpdate();
      var version = updateTriple[0];
      var versionBusy = updateTriple[1];
      var checkUpdate = updateTriple[2];
      var expandedPair = React.useState(false);
      var expanded = expandedPair[0];
      var setExpanded = expandedPair[1];
      /* Calendar month offset from today: 0 = this month. Kept here, not in
         ExpiryCalendar, so the header buttons and the grid share one value. */
      var monthPair = React.useState(0);
      var monthOffset = monthPair[0];
      var setMonthOffset = monthPair[1];
      var calMonth = new Date();
      calMonth.setDate(1);
      calMonth.setMonth(calMonth.getMonth() + monthOffset);
      /* Bumped when the expiry scale changes, so the whole tree repaints with
         the new colours instead of leaving stale dots behind. */
      var redrawPair = React.useState(0);
      var setRedraw = redrawPair[1];
      /* Subscribed, not read once: flipping a switch has to repaint this tree,
         or the toggle appears to do nothing until the next poll. Nothing below
         reads the value - showSection() consults the live module state - so the
         hook is here purely for its re render. */
      usePrefs();
      var tabPair = React.useState(readPanelTab);
      var tab = tabPair[0];
      var setTab = tabPair[1];
      /* Same write the tab bar does: a jump button that forgets the choice would
         bounce back to the overview on the next open. */
      var goTab = function (id) {
        setTab(id);
        try { window.localStorage.setItem(PANEL_TAB_KEY, id); } catch (e) { /* private mode */ }
      };
      /* Blocks switched off in settings must not leave a phantom tab behind:
         a zone with nothing to show falls back to the overview. */
      var visible = SECTION_META.filter(function (m) { return showSection(m.id); });
      var tabCounts = {};
      visible.forEach(function (m) { tabCounts[m.group] = (tabCounts[m.group] || 0) + 1; });
      /* 订阅页签不占区块开关，始终可进；数字显示已连上的平台数 */
      tabCounts.subscriptions = subscriptionCount(state.data);
      var shownTab = tabCounts[tab] ? tab : 'overview';
      /* Only the two long sections carry anchors today; the list is derived from
         what is switched on, so a hidden section never leaves a dead chip. */
      var anchors = visible.filter(function (m) {
        return m.group === shownTab && (m.id === 'daily' || m.id === 'sessions');
      }).map(function (m) { return { id: m.id, label: m.label }; });

      var data = state.data;
      var items = collect(data);
      var buckets = bucketize(items.filter(function (i) { return i.remain > 0; }));
      /* A tab badge should say what needs acting on, not how many blocks the tab
         happens to hold: "3 笔临期" is a reason to click, "4" is not. */
      var soonCount = 0;
      buckets.forEach(function (b) {
        var d = daysLeft(b.exp);
        if (d !== null && d >= 0 && d <= 7) soonCount += 1;
      });
      var riskByTab = { balances: soonCount };
      var cards = byPlatform(items);
      var fatCards = [];
      var slimCards = [];
      cards.forEach(function (card) {
        var hasExp = card.buckets.some(function (b) { return b.exp !== null; });
        if (!hasExp && card.total > 0) slimCards.push(card);
        else fatCards.push(card);
      });
      var usage = data && data.usage ? data.usage : null;
      var missing = missingPlatforms(data);
      var shown = expanded ? buckets : buckets.slice(0, BUCKET_LIMIT);
      /* Scale against the rows actually on screen: a single 4,100-credit bucket
         would otherwise flatten every 100-credit row into an invisible stub. */
      var maxBucket = 1;
      shown.forEach(function (b) { if (b.total > maxBucket) maxBucket = b.total; });
      var rows = foresee(items, usage);
      /* One quota model for the overview short list and the subscription tab;
         the same block switches gate rows in both places. */
      var quotaRows = quotaGlanceRows(subscriptionRows(data));
      /* Runs after paint, so a notification never delays the balance itself.
         Keyed on the waste total, not on every render: this tree repaints on each
         poll and on every threshold click, and a toast must be one decision a
         day, not one per repaint. */
      var wasteKey = 0;
      rows.forEach(function (r) { wasteKey += r.wasted || 0; });
      React.useEffect(function () { notifyOnce(rows, usage); }, [wasteKey]);
      /* Numbers 1-5 jump between tabs and Esc hands the panel back to the
         conversation. Bound on document so it works before the panel is clicked,
         but never steals a key while someone is typing in a search box. */
      React.useEffect(function () {
        function onKey(e) {
          /* A real press of our own only. The app around this panel closes its own
             popovers by dispatching an untrusted Esc keydown, and answering that
             made the panel shut the instant it opened. */
          if (!e || e.isTrusted !== true) return;
          var el = e.target;
          var tagName = el && el.tagName ? el.tagName : '';
          if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || (el && el.isContentEditable)) return;
          /* Keys pressed while focus sits on another surface (sidebar row, menu,
             dialog) belong to that surface, not to this panel. */
          var rootEl = document.getElementById(PANEL_ROOT_ID);
          if (rootEl && el && el !== document.body && el !== document.documentElement && !rootEl.contains(el)) return;
          if (e.key === 'Escape') {
            if (props.backToConversation) props.backToConversation();
            return;
          }
          var n = parseInt(e.key, 10);
          if (!(n >= 1 && n <= 5)) return;
          var pick = makePanelTabs()[n - 1];
          if (!pick) return;
          if (pick.id !== 'subscriptions' && !visible.some(function (m) { return m.group === pick.id; })) return;
          setTab(pick.id);
          try { window.localStorage.setItem(PANEL_TAB_KEY, pick.id); } catch (err) { /* private mode */ }
        }
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey); };
      }, []);
      /* Two spacing scales, one preference: dense data wants rows closer
         together, browsing wants air. Sections read these variables. */
      var densityVars = PREFS.density === 'compact'
        ? { '--cxe-pad': '11px 14px', '--cxe-gap': '13px' }
        : { '--cxe-pad': '16px 18px', '--cxe-gap': '20px' };
      return h('div', {
        id: PANEL_ROOT_ID,
        style: {
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          color: C.text,
          fontSize: 13,
          '--cxe-pad': densityVars['--cxe-pad'],
          '--cxe-gap': densityVars['--cxe-gap']
        }
      },
        Styles(),
        h('div', {
          style: {
            maxWidth: 760,
            margin: '0 auto',
            padding: '20px 22px 40px',
            boxSizing: 'border-box'
          }
        },
          PageHead({
            version: version,
            versionBusy: versionBusy,
            onRecheck: function () { checkUpdate(true); },
            updatedAt: data ? data.updatedAt : 0,
            onBack: props.backToConversation,
            onRefresh: load,
            onSettings: props.onSettings,
            spinning: state.loading,
            /* 复制/导出/提醒原来在每个页签的内容正上方各来一遍，既不对齐任何
               区块，又把页签下面挤窄了；收进头部图标区后正文只剩区块本身。 */
            actions: h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, flex: 'none' } },
              h(CopyButton, { text: function () { return summaryText(items, buckets, usage, rows); } }),
              h(ExportButton, { format: 'csv', label: 'CSV' }),
              h(ExportButton, { format: 'json', label: 'JSON' }),
              h(NotifyButton, {}))
          }),
          DegradedBadge({ data: data, state: state }),
          state.error ? h('div', { style: { marginTop: 10, fontSize: 12, color: C.red } }, t('读取失败：') + state.error + (data ? t('（下面是上次成功读取的数据）') : '')) : null,
          missing.length
            ? h('div', {
              style: {
                marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 11,
                color: C.orange, border: '1px solid ' + C.line, background: 'rgba(249,115,22,0.08)'
              }
            }, t('有平台没读上来：') + missing.map(function (id) { return PLATFORM[id].label; }).join(t('、')) + t('。下面的合计不含它们，不等于它们已经花光。'))
            : null,
          data && data.errors && data.errors.length
            ? h('div', { style: { marginTop: 10, fontSize: 11, color: C.orange } }, data.errors.join(' · '))
            : null,
          Hero({ items: items, usage: usage, rows: rows }),
          PanelTabs({ active: shownTab, risk: riskByTab, onChange: setTab }),
          h(TabAnchors, { items: anchors }),
          shownTab === 'overview' ? h(React.Fragment, null,
          /* 总览按三块排：先看会不会浪费（风险）、再看消耗节奏（速度）、
             最后是会刷新的那类额度。三块各一张白卡、各一个分区标签，
             不再是一串样式雷同的卡片从上堆到下。 */
          Section({
            eyebrow: t('风险'),
            title: t('要先处理'),
            extra: h('span', { style: { fontSize: 11, color: C.dim } }, t('按近 7 天的消耗速度推算')),
            children: h('div', { style: { display: 'grid', gap: 10 } },
              /* 告警原来挂在所有页签上方、又零间距贴着页签栏，看起来像页签
                 的一部分；现在它是风险块里的第一行，跟着风险一起读。 */
              Alert({ buckets: buckets, usage: usage, bare: true }),
              showSection('forecast') ? Foresight({ rows: rows, usage: usage, bare: true }) : null
            )
          }),
          Section({
            id: 'burndown',
            eyebrow: t('节奏'),
            title: t('消耗速度 · 还能用几天'),
            extra: usage && usage.burn
              ? h('span', { style: { fontSize: 11, color: C.dim } }, t('近 7 天日均 · 横条按 90 天满格'))
              : null,
            children: Burndown({ items: items, usage: usage })
          }),
          /* 额度明细只在「订阅与额度」页签里讲一遍。总览这里只留需要处理的那几行，
             不再把四个来源各做一格——同一份数据在一页上出现两遍就是噪音。 */
          quotaRows.length
            ? Section({
              eyebrow: t('额度'),
              title: t('额度与订阅'),
              extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('只看要处理的 · 明细在「订阅与额度」')),
              children: h(QuotaGlance, { rows: quotaRows, onGo: function () { goTab('subscriptions'); } })
            })
            : null
          ) : null,
          shownTab === 'subscriptions' ? h(React.Fragment, null,
            h(SubscriptionOverview, { data: data })
          ) : null,
          shownTab === 'balances' ? h(React.Fragment, null,
          Section({ id: 'platforms', title: t('按平台'), children: h('div', null,
            h('div', { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } },
              fatCards.map(function (card) { return h(PlatformCard, { key: card.id, card: card, items: items }); })
            ),
            slimCards.length
              ? h('div', { style: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginTop: 10 } },
                slimCards.map(function (card) { return h(PlatformCard, { key: card.id, card: card, items: items, compact: true }); }))
              : null
          ) }),
          Section({
            id: 'buckets',
            title: t('按到期日'),
            extra: h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
              h('div', { style: { display: 'flex', gap: 10, fontSize: 10, color: C.faint, flexWrap: 'wrap' } }, LEVELS.map(function (lv) {
                return h('span', { key: lv.id, style: { display: 'flex', alignItems: 'center' } }, Dot({ color: lv.color, size: 5 }), lv.label);
              })),
              h(ThresholdPicker, { onChange: function () { setRedraw(function (n) { return n + 1; }); } })
            ),
            children: h('div', null,
              h('div', { style: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(208px, 1fr))' } },
                shown.map(function (bucket) { return h(BucketRow, { key: bucket.key, bucket: bucket, max: maxBucket }); })),
              buckets.length > BUCKET_LIMIT
                ? h('button', {
                  type: 'button',
                  onClick: function () { setExpanded(!expanded); },
                  style: {
                    marginTop: 10,
                    border: '1px solid ' + C.line,
                    background: 'transparent',
                    color: C.dim,
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 11,
                    cursor: 'pointer'
                  }
                }, expanded ? t('收起') : t('展开全部 ') + buckets.length + t(' 个到期日'))
                : null
            )
          }),
          Section({
            id: 'ledger',
            title: t('积分账本'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, items.length + t(' 个积分包')),
            children: h(CreditLedger, { items: items })
          }),
          Section({
            id: 'calendar',
            title: t('到期日历'),
            extra: h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              h('span', { style: { fontSize: 10, color: C.faint } }, t('按月翻，看哪天到期最多')),
              h('button', {
                type: 'button',
                onClick: function () { setMonthOffset(monthOffset - 1); },
                title: t('上个月'),
                style: {
                  border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
                  borderRadius: 5, width: 20, height: 20, lineHeight: '16px', fontSize: 11,
                  cursor: 'pointer', padding: 0
                }
              }, '‹'),
              h('button', {
                type: 'button',
                onClick: function () { setMonthOffset(monthOffset + 1); },
                title: t('下个月'),
                style: {
                  border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
                  borderRadius: 5, width: 20, height: 20, lineHeight: '16px', fontSize: 11,
                  cursor: 'pointer', padding: 0
                }
              }, '›')
            ),
            children: h(ExpiryCalendar, { buckets: buckets, items: items, month: calMonth })
          })
          ) : null,
          shownTab === 'usage' ? h(React.Fragment, null,
          !usage ? h('div', {
            style: {
              marginTop: 18,
              fontSize: 11,
              color: C.faint,
              padding: '9px 12px',
              border: '1px dashed ' + C.line,
              borderRadius: 8
            }
          }, t('用量统计暂未加载：宿主半改动需要重启一次 DSH 才会生效。')) : null,
          Section({
            id: 'daily',
            anchor: 'daily',
            /* 总量写在图表自己脚下（那里跟着时间窗走）；标题只说明这是哪一块，
               否则标题的天数和图表选中的天数会各说一套。 */
            title: t('积分消耗'),
            extra: usage ? h('span', { style: { fontSize: 11, color: C.faint } }, t('指标、图表与时间窗都可切换')) : null,
            children: h(StatsView, { usage: usage })
          }),
          /* 峰谷与模型用量各占一张卡：原来三块挤在同一张卡里，没有边界，
             读起来像一张超长的图。 */
          usage && usage.pricing && usage.pricing.peak
            && ((usage.pricing.peak.peakTokens || 0) + (usage.pricing.peak.idleTokens || 0)) > 0
            ? Section({
              title: t('峰谷用量'),
              extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('高峰价是空闲价的 2 倍')),
              children: PeakSplit({ peak: usage.pricing.peak, bare: true })
            })
            : null,
          showSection('providers')
            ? Section({
              id: 'providers',
              title: t('模型用量'),
              extra: usage
                ? h('span', { style: { fontSize: 10, color: C.faint } }, usage.providerCount + t(' 个模型'))
                : null,
              children: h(ProviderList, {
                providers: usage ? usage.providers : [],
                total: usage ? usage.providerCount : 0
              })
            })
            : null,
          Section({
            id: 'sessions',
            anchor: 'sessions',
            title: t('积分会话'),
            extra: usage ? h('span', { style: { fontSize: 11, color: C.faint } }, t('共 ') + usage.sessionCount + t(' 条')) : null,
            children: h(SessionList, {
              sessions: usage ? usage.sessions : [],
              total: usage ? usage.sessionCount : 0
            })
          })
          ) : null,
          shownTab === 'accounts' ? h(React.Fragment, null,
          Section({
            id: 'keys',
            title: t('API 密钥余额'),
            extra: h('span', { style: { fontSize: 11, color: C.faint } }, t('现金余额，不会过期，和上面的积分分开算')),
            children: KeyBalances({ keys: data && data.keys ? data.keys : [] })
          }),
          showSection('accounts') ? AccountPool({ data: data }) : null,
          showSection('accounts') ? CredentialLine({ data: data }) : null
          ) : null,
          h(DepsNote, { usage: usage })
        )
      );
    }

    /* The page has two independent views. The switch lives in a one-hook
       router: React compares hook COUNTS between renders of the same component,
       so calling the settings tree (with its own hooks) inline used to change
       PageEntry's count on every switch and crash the whole page white. */
    /* DSH closes the side panel when the page throws during render, which used
       to look like the panel "snapping shut". Catching the error here keeps the
       shell alive and shows the reason instead of a white page. */
    var PanelBoundary = (function () {
      function Boundary(props) {
        React.Component.call(this, props);
        this.state = { failed: false, message: '' };
      }
      Boundary.prototype = Object.create(React.Component.prototype);
      Boundary.prototype.constructor = Boundary;
      Boundary.getDerivedStateFromError = function (error) {
        return { failed: true, message: String((error && error.message) || error) };
      };
      Boundary.prototype.componentDidCatch = function (error, info) {
        console.error('[dsh-credit-expiry] panel render failed:', error, info && info.componentStack);
      };
      Boundary.prototype.render = function () {
        if (!this.state.failed) return this.props.children;
        return h('div', { style: { padding: '24px 22px', fontSize: 12, color: C.text, lineHeight: 1.7 } },
          h('div', { style: { fontSize: 14, fontWeight: 600, marginBottom: 8 } }, t('面板渲染出错')),
          h('div', { style: { color: C.dim, marginBottom: 10 } }, t('刷新页面可以再试一次；如果每次都这样，把下面这行发给我。')),
          h('div', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.red, wordBreak: 'break-all' } }, this.state.message || '-'));
      };
      return Boundary;
    }());

    function PageEntry(props) {
      var viewPair = React.useState('panel');
      var view = viewPair[0];
      var setView = viewPair[1];
      if (view === 'settings') {
        return h(PanelBoundary, null, h(SettingsRoute, {
          onBack: function () { setView('panel'); }
        }));
      }
      return h(PanelBoundary, null, h(PanelView, {
        backToConversation: props.backToConversation,
        onSettings: function () { setView('settings'); }
      }));
    }

    /* Settings need the same live data as the panel (notify config + copyable
       summary) but must own their hooks instead of borrowing the panel's.
       Re-reading the singleton store here is cheap and safe. */
    function SettingsRoute(props) {
      var pair = useData();
      var state = pair[0];
      usePrefs();
      var data = state.data;
      var items = collect(data);
      var buckets = bucketize(items.filter(function (i) { return i.remain > 0; }));
      var usage = data && data.usage ? data.usage : null;
      var rows = foresee(items, usage);
      return SettingsEntry({
        onBack: props.onBack,
        notify: data ? data.notify : null,
        buildText: function () { return summaryText(items, buckets, usage, rows); }
      });
    }

    /* ---------- registration ---------- */

    var ctxRef = null;

    function backToConversation() {
      if (!ctxRef) return;
      var layout = null;
      try { layout = ctxRef.get('layout'); } catch (e) { layout = null; }
      if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null);
    }

    function apply(ctx) {
      ctxRef = ctx;

      /* Every seat goes through ctx.effect so the plugin host owns teardown;
         a failed seat only logs, it never blocks the other one. */
      function seat(slotName, factory, tag) {
        ctx.effect(function () {
          try {
            return ctx.slots.inject(slotName, factory);
          } catch (error) {
            console.error('[dsh-credit-expiry] ' + tag + ' failed to register:', error);
            return function () {};
          }
        }, 'dsh-credit-expiry: ' + tag);
      }

      seat('sidebar.footer.action', function () {
        return ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'credit-expiry-mini',
          order: 2
        }, MiniEntry);
      }, 'sidebar row');

      seat('main', function () {
        return ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          inject: function () {
            return { surface: 'page', backToConversation: backToConversation };
          }
        }, PageEntry);
      }, 'main page');

    }

    var exports = {};
    exports.name = 'dsh-credit-expiry';
    exports.inject = ['slots'];
    exports.apply = apply;
    return exports;
  }
});
