window.__ModuleLoader__.load({
  id: 'dsh-credit-expiry',
  factory: function (require) {
    'use strict';
    var React = require('react');
    var h = React.createElement;

    var API = '/credit-expiry/api/data';
    var UPDATE_API = '/credit-expiry/api/update';
    var EXPORT_API = '/credit-expiry/api/export';
    var KEYS_API = '/credit-expiry/api/keys';
    var NOTIFY_API = '/credit-expiry/api/notify';
    var PANEL_ID = 'credit-expiry';
    var REFRESH_MS = 120000;
    var BUCKET_LIMIT = 8;

    /* Design tokens. The first name is what the host theme actually defines;
       the literal is only a fallback for a theme that predates it. */
    var C = {
      text: 'var(--dsw-alias-label-primary,#1c1c1e)',
      dim: 'var(--dsw-alias-label-secondary,#5c5c60)',
      faint: 'var(--dsw-alias-label-tertiary,#8e8e93)',
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
       "30 天内没有到期积分": "Nothing expires within 30 days",
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
       "按近 7 天日均速度推算余额归零需要几天；横条按 90 天满格，不是余额比例。": "Days until the balance hits zero at the 7-day average burn; the bar is scaled to 90 days full, not to the balance.",
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
       "暂无日粒度数据": "No daily data yet",
       "日均 ": "Daily avg ",
       " 次 · ": " calls · ",
       " · 命中 ": " · cache hit ",
       "暂无积分消耗": "No credit usage yet",
       " 次": " calls",
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
       "近 14 天消耗": "Last 14 days",
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
       "四个平台的分项余额": "Per-platform balances",
       "最近的到期行": "Next expiring rows",
       "返回积分面板": "Back to the credits panel",
       "只影响这台机器上的这一套面板，改动立刻生效并存进浏览器本地。": "Affects only this panel on this machine; changes apply immediately and are stored in the browser.",
       "页面区块": "Page sections",
       " 个已显示": " shown",
       "侧栏卡片": "Sidebar card",
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
       "导出 CSV": "Export CSV",
       "导出 JSON": "Export JSON",
       "消耗速度 · 还能用几天": "Burn rate · days left",
       "近 7 天日均": "7-day average",
       "会刷新的额度，不是会过期的余额": "Quotas that refresh, not balances that expire",
       "收起": "Collapse",
       "展开全部 ": "Show all ",
       " 个到期日": " expiry dates",
       " 个积分包": " credit packs",
       "格内数字 = 当天到期积分": "Cell number = credits expiring that day",
       "上个月": "Prev month",
       "下个月": "Next month",
       "用量统计暂未加载：宿主半改动需要重启一次 DSH 才会生效。": "Usage stats not loaded yet: host-side changes need a DSH restart to take effect.",
       "积分消耗 · 近 14 天": "Credit spend · last 14 days",
       "共 ": "Total ",
       " 条": " rows",
       "现金余额，不会过期，和上面的积分分开算": "Cash balance, no expiry, counted separately from credits above",
       "积分余额与到期来自 WorkBuddy / Trae / MiniMax / Qoder 账号接口；消耗来自本机 cost-meter 账本，只统计这四个积分池。": "Balances and expiries come from the WorkBuddy / Trae / MiniMax / Qoder account APIs; usage comes from the local cost-meter ledger and only covers these four credit pools.",
       "Qoder 积分本身不带到期日，这里用的是套餐到期时间（套餐失效后余额一并消失）。": "Qoder credits carry no expiry date; this uses the plan's expiry (the balance disappears with the plan).",
        "没有检测到周期额度。": "No cycle quotas detected.",
        "如果你开了会员却没显示，试着重新登录对应平台后刷新。": "If you have a membership but don't see it here, try signing in to that platform again and refreshing.",
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
        "豆包额度暂未读上来": "Doubao quota not loaded yet"
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
      '.cxe-card{transition:transform 160ms ease,box-shadow 160ms ease}',
      '.cxe-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.10)}',
      '.cxe-cell{transition:transform 120ms ease}',
      '.cxe-cell:hover{transform:scale(1.07)}',
      '.cxe-spin{display:inline-block;animation:cxeSpin 900ms linear infinite}',
      '.cxe-pulse{animation:cxePulse 2.6s ease-in-out infinite}',
      '@media (prefers-reduced-motion:reduce){.cxe-in,.cxe-track>div,.cxe-pulse,.cxe-spin{animation:none!important}.cxe-card:hover,.cxe-cell:hover{transform:none}}'
    ].join('');

    /* Injected once per page mount rather than into document.head: a plugin
       should not leave global styles behind after it unloads. */
    function Styles() {
      return h('style', { dangerouslySetInnerHTML: { __html: CSS } });
    }

    /* Official brand marks, inlined so the panel never depends on a CDN and
       keeps working offline. 48x48 palette PNGs, ~3 KB each. */
    var ICON = {
      wb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAADAFBMVEVMaXFjTfJpS/pnSvNMds1WWtJqS/tmYuxmS/ZJh8tqTP9pS/pqTPzRyvlpSvhUWNRPadBMdc5lSPJMe85nSfZmSvNnSfVoSfdSXdFRWs9lSfBVV9dYWtpsTP9sTf+4vu1sTP9Od85rTf9TZddObNFOas1UYNaupPNRW89RW87LyfRZU9xbUd9dSuFfTOdfTOdNd8uyt+lJgcmor+bi5ffLwfnAw+yqqutWWtDBtvd2Yejr5/zd1vpiSuloVelfT+NYV9tiR+tnSvZjTO9mSfR8jdr///9oS/ZpS/ppSvhrTP5mSvNmSvRPd9P19P5lSvJlS/BqTPthT+trTPzw7f7s6P5QdNPy7/77+/9kTO9jTe7w8fz19v3t7fzv7/38/P9OdtJjSOzx8/zz8f74+f7n5vtlTPJIjMtJicxgUulnS/Tz8/3u7P5Sbtbz9f1iR+pKg83+/v9RctRUa9leT+VRdNXs7Pzt7/xhSOjp6ftMgc9MfdDt6v5WZNvr6vzk4/teVOhKhs708v5PctHy8f5VaNtgSufo4/5dVeNQYtBOetJHj8pYXd5eUuVXYdxiSer2+P1Ob8/49v5QZtDm4f5fTOZbU99gSOfi3/tiTOxiUO1bWOJaWeBeTePq5f5kS+5PaM5cUeNZV95UaNdPddFYYN1Kfszu6v5Pa85RX9BXXNpgTuhWZNhTbdhUcddNcs5fSeXFu/nd1/ysvOpLgM5aXeDY0fxPb9Hk3v5Qa9Hq5v5iTOlvUfibjPTp6/tWedRRbtdTb9dXatp0Z+teS+NcTuBWYNhSW8+pmPmHcfW6vfF0ceSdlfHU0/jW3/RYg9O0pfl6mNyer+dzjdp5buvDwfJgcdtpWurd3Pm/svx3XPh+i+K8zO5nTu6NpeKNiexnktaSgfJrhtu1xOyMevHM1vKQevqEavyttutvVu6WgfO2rvSzsPJiXeS6tfPHzvKio+7LxfiftuZgYd5rYOne5PdnbuGKj+V3geR/otvQ1PWPnOiDnOBndNbI0/Btdt4FXNyDAAAA1nRSTlMAE25T/hr0Bhr+kFvN/SZgL4D1/WnO83nbxpCX9vruqNtkufTXoYMp+vDQcsyUu+6aj99K9+q4M3mQv/rq3vne0P32aP4r///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+jtbVYAAAAAlwSFlzAAA9hAAAPYQB1ayvdAAABUpJREFUSMeFlndYE3cYgE8UkKEIinvvbfce//hcpGkSqnASk0CAIDQhEBlKGEEIICJKoChQEAQOpBHZqwwpopThnrj3Hq3dtfP77hIUCfrmeXiSh/e9fLnL734hiBcZbmM9c/rUKVOmTp9pbTOceAVDzGw/64et2ZCX6MOtLVYNwMJ6sLexNDOhr1p157bFOEtT/kjbL0xxp6rhXLPtyIH+UIsVpmiua2hIr2y2GPqib8Mx6a/obEhPT990boXTmP7+GCfTnGf8TY2dTk5m/ebhDMIx1HMbG3O7OJznpho5dhD/fAPouY2urpFVzZyxfZ/c0tGkLZdzOvHwoO/e7X+Ow3E0nt1xcrmcC3xuAJ9z5UgVTOMaGbnb38XFpWv58nGG6+uArtGRMzWb3c416qtXe9fJl49lr/lEAZcrEDgL1vYBLwCuoLIRp0F9dWwsv4XLnch83xzgn87AWmcDa/GZQHCvBX328LF8fprLsWYH/CaasZbQWSgUrgGEiLNz17F01NFHnZ+WJpM13sfL5yjME+at6c+lljo4N5Hs0ZnDo+/m4fE2fOS8PIP+dR/X6lw18GFdXNyZ4Q06+OvWzSNs8rKy1mRlrXxG+xO1RoPDu7PD+4+orKzzRp0kyfeJiVlZrP6lgUPRas16f9RF3t58/oiblzyBS9eq0CcXEksZHc2NyNlKjWa9RIJ6nCKWX3UzJSXFMxAenp4taRB8RHzcdLb91Kn2Xxh9Y/thjUYicXd3F8XFKRTqQyubIEgJBDw9A7v4JPkhsexBb2ZmZnR05uHTDw9d6cXDgw+2wvvB2T17mpoSwtgCuE+S3sQnmYzv4+OjVsPw4ItEItD5T05t3bp1D5KQkJARlhEWFhZYSboR26tAj2b0fWBL3EUiL4VC3HslMRGCkJCQ7QkYYBEYdo/vRix7bNQ1fbpC8uOj7OzsRGjyQ7ABKioygM444tMWZpp9OPwG0L0UAYru32pra3NyMMlnkp3YVCRkVDSNIJY+yvTB4Q06+E//iCoqKko2Jj29/NOJO4EDFcAHxJL8h2o1qzOH9/krPj4+KmrbtqLk5OSc7IIcHzj7j/MBSA5ULCHsdvSo2VPj5RUQIO4+Exy8f78hweZnvL4ePTuAg5AMJcx3FHQbpgkQi0/sBYKDg5l3gQaqXiyeFhQUYHLQnCAWF/RImMOLxbrqtrayMuXeNowKC0vjS6NKoy5gQP6u12OyGNbDIr2+G4cX63S/lgWFhoYGBUGk/A4aJiv8AQN11DZMFuESnaz/T4S6TnYZdIqisAlSAm34R3ndDYsLhaUd+snMZjFJ33EXfJnMq5WieTQVSoX+feJ6kBaqIAr7agxOKqGYxN5mJnec0eGKukVRtFTK49FgeByHGJAmJSUdPUKSFylKWTjLnL0xze04wyzAGxRN86S0lIcz7GuV8kCOiIgIDw8/fjUiiUcp5xpvleP3Mwu2WisFeFJeAM7wk9GOAVSq8Ajp7L6NaNQsXN/kDS1NY0IzQ+uOoq6KifFDYlTho0c9u33byXDBHtHS8JDSdOsGLC5G1NSorPz8fBE/K9WM5zeIaWi4tWrLtQBNX8aX667WqCDw9d0C+PrZ99+CpnmAcqI+tb6+PjVVW34Eiz/ZYAuD/Yub3OtiktxQ9i1QAslJ6MVHi5kCZ7KaMXAbffMtkrz7FbKrpKTk+K1/Tw4bNrq4GBIrqzdGmdzY39HJ/tkMYANRank5kxSrXrMc5LfAuwtPfwNgs7kvGTbH/CW/Nua9N+F7gKl2QZM62978VT9ozO0mTRi/YP78BeMnzLEbaP8PbZs7ZcnTSNgAAAAASUVORK5CYII=',
      tr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAMFBMVEUKCw0y8Iwjml0ZYT0PKB0jmlwMGRUt03wNGRUrxXQefUwefkwqxXQlqGUmqWUURC13+a/8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAeUlEQVRIx+3USQ6AIAxA0RZBJof739YAboyQlgQSTfpXXfQtRBRAkga3EL0AEv0FHLra3gSqfoBqPFjhMZBA23jvb4YDtEWMZR/R0CDtZ5H2s2CBAOA8D2QR0pCE4T10KIPzpvNY3awXNwfkz7Tnen8UnKqd/Iil0V3ptgPv4rhglQAAAABJRU5ErkJggg==',
      mm: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAADAFBMVEX///8Arv8Acv8Ae/8As//8/v8AsP/+//8ArP/9/v8AgP/9//8Adv8Agv8AeP8Aff/8/f8Amv8AmP902/8Asf8BuP8Atv8Auv8B4P8ApP8Bhf/7//8AjP8Atf8Aof8Aqv8Alf8Ao/8Aif8Ak/8Ad/8AvP8AkP8AdP8Agf8Apv8Ahv8Ah/8Anf8Ap/8Anv8AtP8AqP8AfP8MwP+P5/8Am/8A4v9l1v/+/v8Akf8Ac/8AlP8/yf+c7f943v+f7/+I5P+W6v+k9/8Ajf8Uwv8Bvf9c0/9Dy/8Cv/9GzP/5/v9t2f+4+v+2+/+F4/+y+v/W+/+B4f+o+P967/8n4/9T6P9E5f8AiP8Ajv8Aov8Be/8hxP9T0P9Lzv8uxP9+4f+0+P/2/f9X0v+s9v+q8/8lxv+Y7P8Bw/+M5v+K8P8A3f+Z9P8Byf+s+f+L9P8/5v9z8P8axP9e6v/u+v/V9P973v8umf8Oif80xv9JzP82yP9i1P9Qzv+k8f9r2f+T6f+A3//k8v9+3v+r6f+U8/+87f9e1P/x/f+w9v+D8P/q/f9u3P/e+/8G4v+f9f+A8f9p7v8A0P9Z7P9u6/9Q4f+E8/+c9v+Q9P/R+v/i9//R8v/m+P+dz/8Jh/+/9/+O4P9T7f9g1P9esv+i5v+07f/N+P+v+f+g8/+79/+78f8z5/+b7/+C7v+F5v965P8o5/+h9/+R8P8dlP9K6f9x4/8U4/9j7P9R2f8e5P803v9Q6/9k4P8e4f9F3P8W3v9h5/884v8P3/8I3v993P932P8Ytv9hz/8etv8asf/X7P+Y4//J5P+Ewf9Kpf/I5f8Wjf/b7f9Zr/8CiP/U6v8oxf/A+v8Uvf8HxP9j1f+13f+U7f+m8/+n9P8zzP8h4/+N6/+G6f8Wyv9f2f995/8A2v8/0/946v8p0f8P0f90wv8V1/811/+W9f8Civ/T7f+p2v8Is/9jw/941f9Jt/+Z3P9Iuv8Kpv+05/990f+Q0v8xt//Q9P85wf+c3//Y9v9Hv/+j5f9+QMpEAAAACXBIWXMAAAsTAAALEwEAmpwYAAAE40lEQVRIx9VVd1STVxx9kB3Il/ARssggEFYYYQQIWzZh76EgW4aCgIjiAmWLIIIMcdRtXXXVWffsbq3de0+6W7trf1/gQBLLaf2rp/ecnPMl5953733vy/sh9D8BjUGA9i/JFA5j8pEz9TQz/DjEupyWx194rp74TuHMvLKOyUCMJ596+ljjli2Nzy7esbkFJH/vwqD4QQIKKty8ONcRI3kyAWwSqfH5Z8CUw2AYh4PlKVrkh15djJnnstm58GE6sUQiFlu0owV+B4aZAR+NXfvtl2++/FTEZuZiGKbASCRPNpMlUt6+zTr21c/f/fDTGNLbNAb6tZYqk+P4uIuIjSkcAQoFkUukdBE7ZGcH4K7ym5vQdCoKalCprt9ytwlXOnkqHP1NQWGOYSQmy2U8W4Pjrj/eort9C7Rphz9879X/qbYRK51I5v6mAH9HBYnNFGWJNTa4Wir8/u6NRcigNwX9LgQHFxbJ3FQHfxA4iWyz7XALd6Hw5pghHfij192keLYtRNI5mDpinkyWUqyxw12lzjLZDcQxElyl0nMsNOMiJgYdoIQCGijBwMbCXe4mM/l6k4EFDXWU8qhurkQmNmYOwHT8cAfYIKnQg841uabXmTDYNS9SRReqA8RKFpvkSYL8LBdxNjSGBmBA5uZr9Q+Cgg7Pn8fnyuRqu/AsEYvpBHRbHV/tLneW0alkHl8/E7wYg/3zYwiFRYCDeDwry1YM9ABYXpoDgUy4KivJGr1M4HWmv1/nIXTFbew0DhpNAKRxlUqFzh4yEEisJNsMBJT0Dz77BBQqupvUXY3juIUa2HKhsxvBp3J5VrzVBgKz9AtnPv/43ZcjeVy6h7M8J0cOZGege8gIA3DgNRtGqrlw6fz5D9+c7cWXkKkmdAKySRAOZJ7kCf19paC6y5mDg6dO5QWWRkTyrXhkMpdLNTGhTylUqjZDwdErmRkXz517r2h5bNOdCC8+n8eTkLlgJQMvQvDSqP5Rm6GRy5cyLg6cOLHWN2rO0sD82V72hA9hMpko1ujVQJmPZZwc+Oj9w8ETkiWzvSL5PAgGIEus+PydBq8GskYlVzLrBtIOvnNobnCcb9Ty2MD8iBg+uMD+8O1jvGILEQ3dZ7E+ravi7fJEkCwryosGk5hIe3v7SK/a/CW7jP4P0CI5vaZuYV/F0ddWeSfOtVy5fU5eYFNpbURE7Z2m2OhtxnxCcDodLCpaqw6UTUigS15sdGD00uVFRTtpRhctDXWnVz5as2HhxuGq3r0hQbO8Q1MaQLOsPap9+zLfuFfuGlaA0hWVAp+3jp9Mq/6iN+yN11eElBGa5tXBlhO4Wm+ggGvtIYFAsG7/2fV9w0NhqcXFJSUrwGeVd3loaGJKc0ODpeGlQQh8BAIfXajqodQFewoKOotLVgQFBYFTeWjK6jijW8YaVfusE/j4pB/fsLAz7MiCpIT4+PiC4q0Ph0z0sbSsNz6H7kcERKjTdSNoZDhVp0jYp0W7D5TNKk8Mbl9jVJrY1v2CykrB2W6EejYOhYEiIelFMxrqCTkUvHblGsr98wQVdh7s2mcN6bQVfVVHUvckpSYjUBQuamsb1d34xkfnN1mfhpLTulp7w8K2anXWU+Pp/mkIoOnMeva2VhXv1k5P1H8apIjW0aFFtAeY07SZYsyseCD6f4u/ALgmS0ixUxJxAAAAAElFTkSuQmCC',
      qd: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAADAFBMVEVMaXH///8h1GL9/f3///+9x73+/v7////U2dlDiGLv//////////8p2Vsp21v9/f0cOhwp3l3///8j22QADwAp21wp21sKIB305+c3sjc7ajsq2Vsq21v////r6+uBjYRna2cf2VMs213///8QHRCrzrjc6+COtJf1+vZ5lYK5ubmdnZ/s7OyZtqLw9vLa2tskrUh1dXUmylYq2Vzm++0r4V4ozldmj3A6X0b8/vwehjwaWy4q2lsnxlQhgj4p0Fgny1Yluk8bdDggmEIbYzF/f3/19fVmf2vKysrS49jv8/G/1MUp2lxaWlq+vr65ubmmpqjs7OzCwsUksEwgi0G9vb0ktU4ozlbk5OS6urqhoaEjn0fJycknwlN6enodUCvS0tLS1dPU5tjO3NEoylbAwMHJycny8vLL2s/BwcHPz88o5F3X19fg4OD7+/tOyHAxoFEjrkvf398lu1C8vLwt4mDKysrZ2dkdcjf5+fm8vLyrq67m5ubT09NaWmLv7+/W1tbk5OSwx7jc3NxG5nMq1lvE2MnM6dMx22ImwVOu8cEz3GMq2lwkokhz54vW2dj6+fko2lqnn6fo6OjX19dMblb1/ffI3c7L2c/x9vSyxrc13GTw//XB3MhNhWOvy7ce3lXm7uityLSe8rbN59QX2E3p9Owx2mHY5duftaTl8ugomUoOrzwnxFSL0IsnvVIgkEAr4F4nzVYbczclvlIlsEwjqUk4tFsksU1a3H5V/1WGmoYkrEsp11smwVIkpUgnt1AdfDgikEQluE8koUckrkwnylYp3VwjoUYq21z///8q2Vsq2lsjoEcr5mAr4F4r5WD8/Pwr2127u7z+//8jokct62L+/v8j2lcs52Er3l0s2177+/v8/Pz8/vwt6WL9//0r5V8s6WEn2lor418p3Fz9/f33/Pkt4GBE33Ab2FGT7awp01nz8/Pp6en5+fld8Ye8vL22traO7Kkc3VPy//jj7eZf44Sm9Ly+9M7J9tZP4Xjg+ud++KAf5Fcx6WXWox8oAAAAyXRSTlMA/QL9/gT9/AIBA/oB/vv+A/yGBwn85wYEBAL+/fn6MSb9/QUONLc1/Wdwb+dn/PJCEvPy/fv9DBT8Q0T44hr39tcoRi4k9jK1svKy6CJDmnnebmFdabxe5pxKXcXQMCPW37Lc0eim2N1kYP3WuvrtYY6ix0X+Or48kpVPu6sfoqP7e5T+9rLs+6H95+hVC5D16UO5vDX7g3zps/39Zxee/Pdn/LD73/7foNx+tPcL+F/9+lKO9oOer/YDJu6Ts5R1Xh62/t+N/v4wx3xjAAAACXBIWXMAAAPoAAAD6AG1e1JrAAADqklEQVRIx42Wd5QTVRTG7yQzeQkbJxvJmk1ZtkjvHZZeFMQGiCBVivSmgAioCCjVQlHsFRQpUqR3FBQ8c3che5awm2SXBNiwVFk6goK+SQIhMy/E7+Tkr/t735377p07ABHp9SCMGFOBR1l82cBaFhD0EF96sI4chjyStOLS0uI0jseXqiVDOX38+PTRyBNiKsSwRTHh/JUrhYxZSoUaF3iiw/vk1hI8NagKGFku5eC5Mk5biLFyEw6rzk4Ho2BXnV+9mBxFtdw6grW/+FiJCND7zyQTMlVKCF7/tAloBMO9eCM80xW1GEfu7GwOP/+sHhg00QI9gSRO+DG//P/JV9fmvF0PbLZI/LNlXCEznNe58dStczfOfDl35sWXXwFNxGRAnIS0HDa8csZzNtNTUuLJHDVxwmQIebxWxjMNtLhwwXtXPflFRfmynCmB1nVDxFTUMeP5Oh/CotNZ0j2JwVnNQANNayKrpEn4UROY/74rNwpIDm/LigBvIMfMZ7EVjOUfiQEkMfArwOusmmrxTQutnxJwBqnFFAZgwjpv0XgVIDl97WGSuqg8jn2VNoxBDYjeX+ASqtpOh0NpA8vA00qgYDccVgEmrJkBdmA5pAT2MACCnWnHA2Uea+xzxgA5eUfUgAkvvCgb0Ft93mfOTQzosC+EptIGLwREKTFAsDstEZUGenhTEgM8dng8lJEd+td3ORIDHPa00CmUM+qWpzBgAkdxiIVWlP6s/bwOBnBZARAcL98aNejjUhqEgGmKXkrCh+FR+ZGTB6sMKHAQ3mEDNhjnVRlIOYcOQg0mYIO6LRS3fBfImIGFSiDVBs3bBFUJhQGYHtvfMrAWmq/Le0iKA6RX4E0KAJqtyWOcHwYEqI5ppljgpwZB1vkRBz30wiTCR8f5h9X/NmLHhwEDJHd5EsldxI9/3clySA8A5Pd9x6dqI0fcYeDdzCLpwQAIRqjSqSpP5CXkx5ue/ERAaPVVquzniBaP4T9xDaIARQSwVhvupi7o/zuuxX0A3YwCWGqtQD6bO3e26P8AYLDpwbJ0FfINl5coLZy5kW79PWadGuhOtn79I36/LCs2XvSZU8Lv7/2KDSwj36xccvs7MdqqDtEcaNDIaxadzhYFBxhbXg8Z324/sV4M3V6OaHYV5M9r9UFbX8D1R0HrdozvCGOqEXZu3RA4flKSTgYDrvrbNtIZT977W5vGbduzP1XsdKjbbdl1XpLOb970c1M77NBoaAe12lcRDP8BJOPGOxBSuPoAAAAASUVORK5CYII=',
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
      db: { id: 'db', label: t('豆包'), short: 'DB', color: '#F04438', ink: '#C4322A', tint: 'rgba(240,68,56,0.14)' }
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
    function PlatformIcon(props) {
      var pid = platformIdOf(props.id);
      var meta = PLATFORM[pid];
      var size = props.size || 14;
      var gap = props.gap === undefined ? 6 : props.gap;
      if (!meta || !ICON[pid]) return Dot({ color: meta ? meta.color : C.faint, size: size, gap: gap });
      return h('img', {
        src: ICON[pid],
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
        sessions: true, accounts: true, keys: true, doubao: true
      },
      mini: { total: true, waste: true, platforms: true, soon: true, rows: 2 },
      refreshMs: 120000,
      lang: 'zh'
    };

    /* A stored preference is a claim about a shape this build may no longer have:
       fill missing keys from the defaults instead of trusting the blob. */
    function clonePrefs(source) {
      var out = { sections: {}, mini: {}, refreshMs: DEFAULT_PREFS.refreshMs, lang: DEFAULT_PREFS.lang };
      Object.keys(DEFAULT_PREFS.sections).forEach(function (k) {
        out.sections[k] = source && source.sections && typeof source.sections[k] === 'boolean'
          ? source.sections[k]
          : DEFAULT_PREFS.sections[k];
      });
      Object.keys(DEFAULT_PREFS.mini).forEach(function (k) {
        var fallback = DEFAULT_PREFS.mini[k];
        var value = source && source.mini ? source.mini[k] : undefined;
        if (typeof fallback === 'boolean') out.mini[k] = typeof value === 'boolean' ? value : fallback;
        else out.mini[k] = (typeof value === 'number' && isFinite(value)) ? value : fallback;
      });
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

    function fmtAmount(n) {
      if (typeof n !== 'number' || !isFinite(n)) return '0';
      var rounded = Math.round(n * 100) / 100;
      var parts = rounded.toFixed(2).split('.');
      var head = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts[1] === '00' ? head : head + '.' + parts[1];
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
      /* Doubao bonus grants are one-off credits that expire, so they behave
         exactly like a credit pack: a remaining amount plus an expiry date.
         Subscription windows are skipped here - they refill, and the DoubaoQuota
         block already shows them. */
      if (data && data.db && Array.isArray(data.db.windows)) {
        data.db.windows.forEach(function (w) {
          if (w && w.kind === 'incentive') {
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

    function hasSubscription(data) {
      if (!data) return false;
      return PLATFORM_ORDER.some(function (id) { return !!(data[id] && data[id].subscription); });
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

    function Section(props) {
      /* A block hidden in the settings page must not cost a render, and its
         header button would otherwise stay clickable while invisible. */
      if (props.id && !showSection(props.id)) return null;
      return h('section', { style: { marginTop: 22 } },
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10
          }
        },
          h('div', { style: { fontSize: 12, fontWeight: 600, color: C.text, letterSpacing: 0.2 } }, props.title),
          props.extra || null
        ),
        props.children
      );
    }

    function MoneyNote(props) {
      if (props.free) {
        return h('span', { style: { fontSize: 10, color: C.faint, whiteSpace: 'nowrap' } }, t('免费模型'));
      }
      if (props.unpriced) {
        return h('span', { style: { fontSize: 10, color: C.faint, whiteSpace: 'nowrap' } }, t('无公开价'));
      }
      return h('span', {
        style: {
          fontSize: 10,
          color: C.faint,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap'
        }
      }, '≈¥' + fmtPrecise(props.costCny));
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
        children: h('div', null, accounts.map(function (a, i) {
          var days = daysLeft(a.expiresAtMs);
          return h('div', {
            key: (a.name || '') + i,
            style: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid ' + C.line }
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
    function PeakSplit(props) {
      var peak = props.peak || {};
      var peakTokens = peak.peakTokens || 0;
      var idleTokens = peak.idleTokens || 0;
      var sum = peakTokens + idleTokens;
      if (!sum) return null;
      var peakPct = Math.round(peakTokens / sum * 100);
      var windows = (peak.windows || []).map(function (w) { return w[0] + ':00-' + w[1] + ':00'; }).join(t('、'));
      return h('div', { style: { marginTop: 12, padding: '12px 14px', border: '1px solid ' + C.line, borderRadius: 10 } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 } },
          h('span', { style: { fontSize: 11, color: C.dim } }, t('峰谷用量')),
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
        mini.platforms === false ? null : h('div', { style: { display: 'flex', gap: 10, marginBottom: soon.length ? 6 : 0, flexWrap: 'wrap' } },
          BALANCE_ORDER.map(function (id) {
            var value = sumOf(items.filter(function (i) { return i.platform === id; }), 'remain');
            return h('span', {
              key: id,
              style: { display: 'flex', alignItems: 'center', fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' }
            }, PlatformIcon({ id: id, size: 11, gap: 3 }), fmtAmount(value));
          })
        ),
        soon.map(function (bucket) {
          var days = daysLeft(bucket.exp);
          return h('div', {
            key: bucket.key,
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              lineHeight: '18px',
              color: C.dim
            }
          },
            h('span', { style: { display: 'flex', alignItems: 'center', minWidth: 0 } },
              bucketPools(bucket).map(function (id) {
                return h(React.Fragment, { key: id }, PlatformIcon({ id: id, size: 11, gap: 3 }));
              }),
              h('span', { style: { fontVariantNumeric: 'tabular-nums', marginLeft: 2 } }, fmtDate(bucket.exp)),
              days !== null && days <= ACTIVE.l30 ? h('span', { style: { marginLeft: 5, color: levelColor(levelOf(bucket.exp)) } }, countdownLabel(days)) : null
            ),
            h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.text } }, fmtAmount(bucket.total))
          );
        }),
        !state.loading && !state.error && soon.length === 0 && mini.soon !== false
          ? h('div', { style: { fontSize: 11, color: C.faint } }, t('暂无临期积分'))
          : null
      );
    }

    /* ---------- full page ---------- */

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
            h('div', { style: { fontSize: 15, fontWeight: 600, color: C.text } }, t('积分到期')),
            VersionLine({ info: props.version, busy: props.versionBusy, onRecheck: props.onRecheck })
          ),
          h('div', { style: { fontSize: 11, color: C.faint, marginTop: 2 } }, t('WorkBuddy、Trae、MiniMax 与 Qoder 的积分余额、到期节奏与消耗'))
        ),
        props.updatedAt ? h('span', { style: { fontSize: 11, color: C.faint, flex: 'none' } }, t('更新于 ') + fmtClock(props.updatedAt)) : null,
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
      var buckets = props.buckets.filter(function (b) { return b.exp !== null; });
      var soon = buckets.filter(function (b) { var d = daysLeft(b.exp); return d !== null && d >= 0 && d <= ACTIVE.l30; });
      var amount = 0;
      soon.forEach(function (b) { amount += b.total; });
      if (!soon.length) {
        return h('div', {
          style: {
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: C.dim,
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid ' + C.line
          }
        },
          Dot({ color: C.green, size: 6 }),
          t('30 天内没有到期积分')
        );
      }
      return h('div', {
        style: {
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: C.text,
          padding: '9px 12px',
          borderRadius: 8,
          border: '1px solid ' + C.line,
          background: 'rgba(229,72,77,0.08)'
        }
      },
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
        h('div', { style: { fontSize: 10, color: C.faint, lineHeight: '15px', marginTop: 2 } },
          t('按近 7 天日均速度推算余额归零需要几天；横条按 90 天满格，不是余额比例。'))
      );
    }

    /**
     * Recurring grants, in their own card because they are the opposite of an
     * expiring balance: the allowance refills, so the useful pair is
     * "how much of the cycle is left" plus "when it comes back".
     */
    function Subscription(props) {
      var data = props.data || {};
      var pools = [];
      PLATFORM_ORDER.forEach(function (id) {
        var pool = data[id];
        if (pool && pool.subscription) pools.push(pool.subscription);
      });
      if (!pools.length) return null;
      return h('div', { style: { display: 'grid', gap: 8 } },
        pools.map(function (sub, i) {
          var pct = sub.size > 0 ? Math.max(0, Math.min(100, Math.round((sub.remain / sub.size) * 100))) : null;
          var reset = resetLabel(sub.resetAtMs);
          var cliff = sub.expiresAtMs ? daysLeft(sub.expiresAtMs) : null;
          return h('div', {
            key: 'sub' + i,
            style: { border: '1px solid ' + C.line, borderRadius: 8, padding: '9px 11px' }
          },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
              h('span', { style: { fontSize: 12, color: C.text, flex: 1, minWidth: 0 } }, sub.label),
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
                ? h('span', { style: { color: cliff <= 7 ? C.red : C.faint } },
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
      var rows = windows.map(function (w, i) {
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
        var label = isBonus ? (w.label || t('活动赠送')) : (w.label || t('豆包额度'));
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
      });
      return h('div', null,
        head,
        h('div', { style: { fontSize: 10, color: C.faint, marginBottom: 10 } },
          t('赠送额度到期作废，订阅额度到点刷新；重置日由平台估算')),
        rows
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
      return symbol + (abs >= 1000 ? fmtAmount(amount) : amount.toFixed(2));
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
      var doomed = rows.filter(function (r) { return r.willWaste && r.wasted > 0; });
      if (!doomed.length) {
        var hasRate = PLATFORM_ORDER.some(function (id) { return burnOf(usage, id) !== null; });
        if (!hasRate) return null;
        return h('div', {
          style: {
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: C.dim,
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid ' + C.line
          }
        },
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

      return h('div', {
        style: {
          marginTop: 12,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid ' + C.line,
          background: 'rgba(229,72,77,0.06)'
        }
      },
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
      var rows = items.slice().sort(function (a, b) {
        var da = daysLeft(a.exp), db = daysLeft(b.exp);
        if (da === null && db === null) return b.remain - a.remain;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
      if (!rows.length) return h('div', { style: { fontSize: 12, color: C.faint } }, t('暂无积分包'));

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
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 58px 58px 64px 68px',
            gap: 4,
            borderBottom: '1px solid ' + C.line,
            paddingBottom: 2
          }
        },
          cell(t('平台 / 积分包'), { color: C.faint, size: 10 }),
          cell(t('剩余（积分）'), { color: C.faint, size: 10, align: 'right' }),
          cell(t('总量'), { color: C.faint, size: 10, align: 'right' }),
          cell(t('已用'), { color: C.faint, size: 10, align: 'right' }),
          cell(t('到期日'), { color: C.faint, size: 10, align: 'right' }),
          cell(t('剩余天数'), { color: C.faint, size: 10, align: 'right' })
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
            h('div', {
              style: {
                padding: '7px 4px', fontSize: 11, textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: days !== null && days <= ACTIVE.l90 ? levelColor(levelOf(item.exp)) : C.faint,
                whiteSpace: 'nowrap'
              }
            }, days === null ? '—' : countdownLabel(days))
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
      var buckets = props.buckets || [];
      var month = props.month;
      var byDay = {};
      buckets.forEach(function (b) {
        if (b.exp === null) return;
        var k = dayKey(b.exp);
        byDay[k] = (byDay[k] || 0) + b.total;
      });
      var first = new Date(month.getFullYear(), month.getMonth(), 1);
      var daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      var lead = (first.getDay() + 6) % 7; /* Monday-first grid */
      var cells = [];
      for (var i = 0; i < lead; i += 1) cells.push(null);
      for (var d = 1; d <= daysInMonth; d += 1) {
        var key = month.getFullYear() + '-' + pad2(month.getMonth() + 1) + '-' + pad2(d);
        cells.push({ day: d, key: key, value: byDay[key] || 0 });
      }
      /* Pad the last row: a 30-day month that starts on a Wednesday leaves the
         grid one cell short, which reads as a missing day. */
      while (cells.length % 7 !== 0) cells.push(null);
      var max = 1;
      cells.forEach(function (c) { if (c && c.value > max) max = c.value; });
      var todayKey = dayKey(Date.now());
      var monthTotal = 0;
      cells.forEach(function (c) { if (c) monthTotal += c.value; });

      return h('div', null,
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 } },
          h('span', { style: { fontSize: 11, color: C.dim } }, month.getFullYear() + t(' 年 ') + (month.getMonth() + 1) + t(' 月')),
          h('span', { style: { fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
            monthTotal > 0 ? t('本月到期 ') + fmtAmount(monthTotal) : t('本月无到期'))
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 3, marginBottom: 4 } },
          [t('一'), t('二'), t('三'), t('四'), t('五'), t('六'), t('日')].map(function (w) {
            return h('div', { key: w, style: { fontSize: 9, color: C.faint, textAlign: 'center' } }, w);
          })
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 3 } },
          cells.map(function (cell, i) {
            if (!cell) return h('div', { key: 'e' + i });
            var isToday = cell.key === todayKey;
            var ratio = cell.value / max;
            var bg = cell.value > 0
              ? 'rgba(229,72,77,' + (0.10 + ratio * 0.55).toFixed(3) + ')'
              : 'transparent';
            return h('div', {
              key: cell.key,
              title: cell.key + (cell.value > 0 ? ' · ' + fmtAmount(cell.value) + t(' 积分到期') : t(' · 无到期')),
              style: {
                height: 34,
                borderRadius: 4,
                background: bg,
                border: isToday ? '1px solid ' + C.accent : '1px solid ' + C.line,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              },
              className: 'cxe-cell'
            },
              h('span', { style: { fontSize: 9, color: cell.value > 0 ? C.text : C.faint, lineHeight: 1 } }, cell.day),
              cell.value > 0
                ? h('span', { style: { fontSize: 8, color: C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 } }, fmtCompact(cell.value))
                : null
            );
          })
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
      return h('div', {
        className: 'cxe-card cxe-in',
        style: {
          minWidth: 0,
          padding: '13px 14px',
          borderRadius: 10,
          border: '1px solid ' + C.line
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
          h('span', { style: { fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: C.text } }, fmtAmount(card.total))
        ),
        Track({ parts: parts, height: 6 }),
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
      return h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 0',
          borderBottom: '1px solid ' + C.line
        }
      },
        h('span', { style: { display: 'flex', alignItems: 'center', width: 58, flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } },
          Dot({ color: levelColor(levelOf(bucket.exp)), size: 6 }),
          fmtDate(bucket.exp)
        ),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { width: pct + '%', minWidth: 6 } }, Track({ parts: parts, height: 6 })),
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              fontSize: 10,
              color: C.faint,
              marginTop: 3,
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
        ),
        h('span', { style: { width: 66, textAlign: 'right', flex: 'none', fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(bucket.total)),
        h('span', {
          style: {
            width: 46,
            textAlign: 'right',
            flex: 'none',
            fontSize: 11,
            color: days === null ? C.faint : (days <= ACTIVE.l90 ? levelColor(levelOf(bucket.exp)) : C.faint)
          }
        }, countdownLabel(days))
      );
    }

    function DailyChart(props) {
      var daily = props.daily || [];
      if (!daily.length) return h('div', { style: { fontSize: 12, color: C.faint } }, t('暂无日粒度数据'));
      var max = 1;
      var sum = 0;
      daily.forEach(function (d) {
        if (d.credits > max) max = d.credits;
        sum += d.credits;
      });
      var avg = sum / daily.length;
      var H = 96;
      /* Two hairlines (half and full of the tallest day) plus a dashed average
         give the bars a scale without an axis full of numbers. */
      var guides = [
        { v: max, label: fmtAmount(max), dash: 'none' },
        { v: avg, label: t('日均 ') + fmtAmount(avg), dash: '3px 3px' }
      ];
      return h('div', null,
        h('div', { style: { position: 'relative', height: H } },
          guides.map(function (g, gi) {
            var top = H - Math.round((g.v / max) * (H - 6));
            return h('div', {
              key: 'g' + gi,
              style: {
                position: 'absolute',
                left: 0,
                right: 0,
                top: Math.max(0, top),
                borderTop: '1px ' + (g.dash === 'none' ? 'solid' : 'dashed') + ' ' + C.line,
                pointerEvents: 'none'
              }
            },
              h('span', {
                style: {
                  position: 'absolute',
                  left: 0,
                  top: -12,
                  padding: '0 3px',
                  fontSize: 9,
                  color: C.faint,
                  fontVariantNumeric: 'tabular-nums',
                  background: C.bg,
                  borderRadius: 2
                }
              }, g.label)
            );
          }),
          h('div', {
            style: { display: 'flex', alignItems: 'flex-end', gap: 5, height: '100%', position: 'relative' }
          }, daily.map(function (d) {
            var px = Math.max(2, Math.round((d.credits / max) * (H - 6)));
            var byPool = d.byPool || {};
            var stack = PLATFORM_ORDER.filter(function (id) { return (byPool[id] || 0) > 0; });
            /* An older host sends no per-pool split; still show the total so the
               chart never collapses into empty guide lines. */
            if (!stack.length && d.credits > 0) stack = ['__all'];
            return h('div', {
              key: d.date,
              title: d.date + ' · ' + fmtAmount(d.credits) + t(' 积分 · ') + d.calls + t(' 次 · ') + fmtCompact(d.tokens) + ' tokens · ≈¥' + fmtPrecise(d.costCny),
              style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }
            },
              h('div', {
                style: {
                  width: '100%',
                  height: px,
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  borderRadius: '3px 3px 0 0',
                  overflow: 'hidden'
                }
              }, stack.map(function (id) {
                var part = id === '__all' ? d.credits : (byPool[id] || 0);
                return h('div', {
                  key: id,
                  title: (id === '__all' ? '' : PLATFORM[id].label + ' ') + fmtAmount(part) + t(' 积分'),
                  style: { width: '100%', height: (part / (d.credits || 1) * 100) + '%', background: id === '__all' ? C.accent : PLATFORM[id].color }
                });
              }))
            );
          }))
        ),
        h('div', { style: { display: 'flex', gap: 5, marginTop: 5 } }, daily.map(function (d, i) {
          var show = daily.length <= 10 || i % 2 === 0;
          return h('div', {
            key: d.date,
            style: { flex: 1, textAlign: 'center', fontSize: 9, color: C.faint, fontVariantNumeric: 'tabular-nums' }
          }, show ? d.date.slice(5) : '');
        }))
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
      var providers = all.slice(0, 6);
      var hidden = props.total ? Math.max(0, props.total - providers.length) : Math.max(0, all.length - 6);
      if (!providers.length) return h('div', { style: { fontSize: 12, color: C.faint } }, t('暂无积分消耗'));
      var max = 0.0001;
      providers.forEach(function (p) { if (p.credits > max) max = p.credits; });
      return h('div', null, providers.map(function (p) {
        var meta = providerMeta(p.provider);
        var color = meta.color;
        return h('div', { key: p.key, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' } },
          PlatformIcon({ id: p.provider, size: 14, gap: 0 }),
          h('div', { style: { flex: 1, minWidth: 0, marginLeft: 2 } },
            h('div', {
              style: { fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
            }, meta.label + ' · ' + p.model),
            h('div', { style: { marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 } },
              h('div', { style: { flex: 1, minWidth: 0 } }, Track({
                parts: [{ key: 'v', value: Math.max(p.credits, 0.0001), color: color }, { key: 'r', value: Math.max(max - p.credits, 0), color: 'transparent' }],
                height: 3
              })),
              h('span', { style: { fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
                fmtCompact(p.tokens) + ' tok' + cacheSuffix(p))
            )
          ),
          h('span', { style: { width: 46, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, p.calls + t(' 次')),
          h('span', {
            style: { width: 76, textAlign: 'right', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '15px' }
          },
            h('span', { style: { fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(p.credits)),
            MoneyNote({ costCny: p.costCny, free: p.free, unpriced: !p.priced })
          )
        );
      }).concat(hidden > 0 ? [h('div', {
        key: '__more',
        style: { paddingTop: 6, fontSize: 10, color: C.faint }
      }, t('另有 ') + hidden + t(' 个模型未列出'))] : []));
    }

    function SessionList(props) {
      var sessions = (props.sessions || []).slice(0, 10);
      if (!sessions.length) return h('div', { style: { fontSize: 12, color: C.faint } }, t('暂无积分会话'));
      return h('div', null, sessions.map(function (s, i) {
        var topProvider = (s.top || '').split(':')[0];
        var meta = topProvider ? providerMeta(topProvider) : null;
        return h('div', {
          key: s.id || String(i),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 0',
            borderBottom: '1px solid ' + C.line
          }
        },
          h('span', { style: { width: 58, flex: 'none', fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
            (s.date || '').slice(5) + ' ' + fmtClock(s.at)),
          h('span', {
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
            s.title || (s.top ? s.top.split(':')[1] : t('会话'))
          ),
          h('span', { style: { width: 46, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, s.calls + t(' 次')),
          h('span', { style: { width: 52, textAlign: 'right', flex: 'none', fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' } }, fmtCompact(s.tokens)),
          h('span', {
            style: { width: 76, textAlign: 'right', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '15px' }
          },
            h('span', { style: { fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(s.credits)),
            MoneyNote({ costCny: s.costCny })
          )
        );
      }));
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
       re-render recolours rows, calendar and mini entry together. */
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
        { id: 'forecast', label: t('到期预测'), hint: t('按当前消耗速度推算哪些积分会用不完') },
        { id: 'burndown', label: t('消耗速度 / 可用天数'), hint: t('每个平台的余额还够用几天') },
        { id: 'subscription', label: t('周期额度与重置日'), hint: t('按月发放、会刷新的额度及其重置时间') },
        { id: 'doubao', label: t('豆包额度'), hint: t('豆包额度 · 赠送会过期，订阅会刷新') },
        { id: 'platforms', label: t('按平台'), hint: t('每个平台的余额、构成与最近到期') },
        { id: 'buckets', label: t('按到期日'), hint: t('把同一天到期的积分并成一行') },
        { id: 'ledger', label: t('积分账本'), hint: t('每个积分包的剩余 / 总量 / 已用 / 到期') },
        { id: 'calendar', label: t('到期日历'), hint: t('按月看每天有多少积分到期') },
        { id: 'daily', label: t('近 14 天消耗'), hint: t('日柱图、峰谷占比与模型用量') },
        { id: 'providers', label: t('模型用量'), hint: t('每个模型的 token、命中率与金额') },
        { id: 'sessions', label: t('积分会话'), hint: t('最近用过积分的会话') },
        { id: 'keys', label: t('API 密钥余额'), hint: t('用自己 API 密钥读到的现金余额（密钥只存在本机）') },
        { id: 'accounts', label: t('其他账号与凭据'), hint: t('WorkBuddy 其他账号、登录凭据倒计时') }
      ];
    }
    var SECTION_META = makeSectionMeta();

    function makeMiniMeta() {
      return [
        { id: 'total', label: t('余额合计') },
        { id: 'waste', label: t('会用不完的积分') },
        { id: 'platforms', label: t('四个平台的分项余额') },
        { id: 'soon', label: t('最近的到期行') }
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
        style: {
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '9px 0', borderBottom: '1px solid ' + C.line
        }
      },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontSize: 12, color: C.text } }, props.label),
          props.hint ? h('div', { style: { fontSize: 10, color: C.faint, marginTop: 2 } }, props.hint) : null
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
              color: on ? C.accent : C.faint,
              borderRadius: 5, padding: '2px 8px', fontSize: 10, cursor: 'pointer'
            }
          }, option.label);
        })
      );
    }

    function setPref(path, value) {
      var next = clonePrefs(PREFS);
      if (path[0] === 'sections') next.sections[path[1]] = value;
      else if (path[0] === 'mini') next.mini[path[1]] = value;
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
        h('div', { style: { maxWidth: 720, margin: '0 auto', padding: '20px 22px 40px', boxSizing: 'border-box' } },
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
              h('div', { style: { fontSize: 15, fontWeight: 600 } }, t('显示设置')),
              h('div', { style: { fontSize: 11, color: C.faint, marginTop: 2 } }, t('只影响这台机器上的这一套面板，改动立刻生效并存进浏览器本地。'))
            )
          ),
          Section({
            title: t('页面区块'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, enabled + ' / ' + SECTION_META.length + t(' 个已显示')),
            children: h('div', null, SECTION_META.map(function (meta) {
              return SettingsRow({
                key: meta.id,
                label: meta.label,
                hint: meta.hint,
                children: Switch({
                  on: prefs.sections[meta.id],
                  onClick: function () { setPref(['sections', meta.id], !prefs.sections[meta.id]); }
                })
              });
            }))
          }),
          Section({
            title: t('侧栏卡片'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('不打开页面时能看到的全部信息')),
            children: h('div', null,
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
            title: t('API 密钥余额'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('密钥只存本机，不写仓库')),
            children: h(KeyManager)
          }),
          Section({
            title: t('IM 推送'),
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, t('把摘要推到群里')),
            children: h(NotifyConfig, { notify: props.notify, buildText: props.buildText })
          }),
          Section({
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
              children: ThresholdPicker({ onChange: function () { } })
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

      var data = state.data;
      var items = collect(data);
      var buckets = bucketize(items.filter(function (i) { return i.remain > 0; }));
      var cards = byPlatform(items);
      var usage = data && data.usage ? data.usage : null;
      var missing = missingPlatforms(data);
      var shown = expanded ? buckets : buckets.slice(0, BUCKET_LIMIT);
      /* Scale against the rows actually on screen: a single 4,100-credit bucket
         would otherwise flatten every 100-credit row into an invisible stub. */
      var maxBucket = 1;
      shown.forEach(function (b) { if (b.total > maxBucket) maxBucket = b.total; });
      var rows = foresee(items, usage);
      /* Runs after paint, so a notification never delays the balance itself.
         Keyed on the waste total, not on every render: this tree repaints on each
         poll and on every threshold click, and a toast must be one decision a
         day, not one per repaint. */
      var wasteKey = 0;
      rows.forEach(function (r) { wasteKey += r.wasted || 0; });
      React.useEffect(function () { notifyOnce(rows, usage); }, [wasteKey]);

      return h('div', {
        style: {
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          color: C.text,
          fontSize: 13
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
            spinning: state.loading
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
          Hero({ items: items, usage: usage }),
          Alert({ buckets: buckets, usage: usage }),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 } },
            CopyButton({ text: function () { return summaryText(items, buckets, usage, rows); } }),
            ExportButton({ format: 'csv', label: t('导出 CSV') }),
            ExportButton({ format: 'json', label: t('导出 JSON') }),
            NotifyButton({})
          ),
          showSection('forecast') ? Foresight({ rows: rows, usage: usage }) : null,
          Section({
            id: 'burndown',
            title: t('消耗速度 · 还能用几天'),
            extra: usage && usage.burn
              ? h('span', { style: { fontSize: 11, color: C.faint } }, t('近 7 天日均'))
              : null,
            children: Burndown({ items: items, usage: usage })
          }),
          showSection('subscription')
            ? Section({
              id: 'subscription',
              title: t('周期额度与重置日'),
              extra: h('span', { style: { fontSize: 11, color: C.faint } }, t('会刷新的额度，不是会过期的余额')),
              /* Keep the section visible even without a membership: an empty
                 sill is information ("we looked, nothing is there"), while a
                 missing block reads as a broken panel. */
              children: hasSubscription(data)
                ? Subscription({ data: data })
                : h('div', { style: { fontSize: 11, color: C.faint, lineHeight: '17px' } },
                  t('没有检测到周期额度。') + t('如果你开了会员却没显示，试着重新登录对应平台后刷新。'))
            })
            : null,
          Section({
            id: 'doubao',
            title: t('豆包额度'),
            extra: h('span', { style: { fontSize: 11, color: C.faint } }, t('豆包额度 · 赠送会过期，订阅会刷新')),
            children: DoubaoQuota({ db: data && data.db ? data.db : null })
          }),
          Section({ id: 'platforms', title: t('按平台'), children: h('div', { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
            cards.map(function (card) { return h(PlatformCard, { key: card.id, card: card }); })
          ) }),
          Section({
            id: 'buckets',
            title: t('按到期日'),
            extra: h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
              h('div', { style: { display: 'flex', gap: 10, fontSize: 10, color: C.faint, flexWrap: 'wrap' } }, LEVELS.map(function (lv) {
                return h('span', { key: lv.id, style: { display: 'flex', alignItems: 'center' } }, Dot({ color: lv.color, size: 5 }), lv.label);
              })),
              ThresholdPicker({ onChange: function () { setRedraw(function (n) { return n + 1; }); } })
            ),
            children: h('div', null,
              shown.map(function (bucket) { return h(BucketRow, { key: bucket.key, bucket: bucket, max: maxBucket }); }),
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
            children: CreditLedger({ items: items })
          }),
          Section({
            id: 'calendar',
            title: t('到期日历'),
            extra: h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              h('span', { style: { fontSize: 10, color: C.faint } }, t('格内数字 = 当天到期积分')),
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
            children: ExpiryCalendar({ buckets: buckets, month: calMonth })
          }),
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
            title: t('积分消耗 · 近 14 天'),
            extra: usage ? h('span', { style: { fontSize: 11, color: C.faint } },
              fmtAmount(usage.totals.credits) + t(' 积分 · ') + usage.totals.calls + t(' 次 · ') + fmtCompact(usage.totals.tokens) + ' tok · ≈¥' + fmtPrecise(usage.totals.costCny)) : null,
            children: h('div', null,
              h('div', { style: { padding: '12px 14px', border: '1px solid ' + C.line, borderRadius: 10 } },
                DailyChart({ daily: usage ? usage.daily : [] })
              ),
              usage ? PeakSplit({ peak: usage.pricing ? usage.pricing.peak : null }) : null,
              showSection('providers')
                ? h('div', { style: { marginTop: 14 } }, ProviderList({ providers: usage ? usage.providers : [], total: usage ? usage.providerCount : 0 }))
                : null
            )
          }),
          Section({
            id: 'sessions',
            title: t('积分会话'),
            extra: usage ? h('span', { style: { fontSize: 11, color: C.faint } }, t('共 ') + usage.sessionCount + t(' 条')) : null,
            children: SessionList({ sessions: usage ? usage.sessions : [] })
          }),
          Section({
            id: 'keys',
            title: t('API 密钥余额'),
            extra: h('span', { style: { fontSize: 11, color: C.faint } }, t('现金余额，不会过期，和上面的积分分开算')),
            children: KeyBalances({ keys: data && data.keys ? data.keys : [] })
          }),
          showSection('accounts') ? AccountPool({ data: data }) : null,
          showSection('accounts') ? CredentialLine({ data: data }) : null,
          h('div', { style: { marginTop: 22, fontSize: 10, color: C.faint, lineHeight: '16px' } },
            t('积分余额与到期来自 WorkBuddy / Trae / MiniMax / Qoder 账号接口；消耗来自本机 cost-meter 账本，只统计这四个积分池。'),
            h('br', null),
            PricingNote({ usage: usage }),
            h('br', null),
            t('Qoder 积分本身不带到期日，这里用的是套餐到期时间（套餐失效后余额一并消失）。')
          )
        )
      );
    }

    /* The page has two independent views. The switch lives in a one-hook
       router: React compares hook COUNTS between renders of the same component,
       so calling the settings tree (with its own hooks) inline used to change
       PageEntry's count on every switch and crash the whole page white. */
    function PageEntry(props) {
      var viewPair = React.useState('panel');
      var view = viewPair[0];
      var setView = viewPair[1];
      if (view === 'settings') {
        return h(SettingsRoute, {
          onBack: function () { setView('panel'); }
        });
      }
      return h(PanelView, {
        backToConversation: props.backToConversation,
        onSettings: function () { setView('settings'); }
      });
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
