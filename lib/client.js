window.__ModuleLoader__.load({
  id: 'dsh-credit-expiry',
  factory: function (require) {
    'use strict';
    var React = require('react');
    var h = React.createElement;

    var API = '/credit-expiry/api/data';
    var UPDATE_API = '/credit-expiry/api/update';
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

    /* Official brand marks, inlined so the panel never depends on a CDN and
       keeps working offline. 48x48 palette PNGs, ~3 KB each. */
    var ICON = {
      wb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAADAFBMVEVMaXFjTfJpS/pnSvNMds1WWtJqS/tmYuxmS/ZJh8tqTP9pS/pqTPzRyvlpSvhUWNRPadBMdc5lSPJMe85nSfZmSvNnSfVoSfdSXdFRWs9lSfBVV9dYWtpsTP9sTf+4vu1sTP9Od85rTf9TZddObNFOas1UYNaupPNRW89RW87LyfRZU9xbUd9dSuFfTOdfTOdNd8uyt+lJgcmor+bi5ffLwfnAw+yqqutWWtDBtvd2Yejr5/zd1vpiSuloVelfT+NYV9tiR+tnSvZjTO9mSfR8jdr///9oS/ZpS/ppSvhrTP5mSvNmSvRPd9P19P5lSvJlS/BqTPthT+trTPzw7f7s6P5QdNPy7/77+/9kTO9jTe7w8fz19v3t7fzv7/38/P9OdtJjSOzx8/zz8f74+f7n5vtlTPJIjMtJicxgUulnS/Tz8/3u7P5Sbtbz9f1iR+pKg83+/v9RctRUa9leT+VRdNXs7Pzt7/xhSOjp6ftMgc9MfdDt6v5WZNvr6vzk4/teVOhKhs708v5PctHy8f5VaNtgSufo4/5dVeNQYtBOetJHj8pYXd5eUuVXYdxiSer2+P1Ob8/49v5QZtDm4f5fTOZbU99gSOfi3/tiTOxiUO1bWOJaWeBeTePq5f5kS+5PaM5cUeNZV95UaNdPddFYYN1Kfszu6v5Pa85RX9BXXNpgTuhWZNhTbdhUcddNcs5fSeXFu/nd1/ysvOpLgM5aXeDY0fxPb9Hk3v5Qa9Hq5v5iTOlvUfibjPTp6/tWedRRbtdTb9dXatp0Z+teS+NcTuBWYNhSW8+pmPmHcfW6vfF0ceSdlfHU0/jW3/RYg9O0pfl6mNyer+dzjdp5buvDwfJgcdtpWurd3Pm/svx3XPh+i+K8zO5nTu6NpeKNiexnktaSgfJrhtu1xOyMevHM1vKQevqEavyttutvVu6WgfO2rvSzsPJiXeS6tfPHzvKio+7LxfiftuZgYd5rYOne5PdnbuGKj+V3geR/otvQ1PWPnOiDnOBndNbI0/Btdt4FXNyDAAAA1nRSTlMAE25T/hr0Bhr+kFvN/SZgL4D1/WnO83nbxpCX9vruqNtkufTXoYMp+vDQcsyUu+6aj99K9+q4M3mQv/rq3vne0P32aP4r///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+jtbVYAAAAAlwSFlzAAA9hAAAPYQB1ayvdAAABUpJREFUSMeFlndYE3cYgE8UkKEIinvvbfce//hcpGkSqnASk0CAIDQhEBlKGEEIICJKoChQEAQOpBHZqwwpopThnrj3Hq3dtfP77hIUCfrmeXiSh/e9fLnL734hiBcZbmM9c/rUKVOmTp9pbTOceAVDzGw/64et2ZCX6MOtLVYNwMJ6sLexNDOhr1p157bFOEtT/kjbL0xxp6rhXLPtyIH+UIsVpmiua2hIr2y2GPqib8Mx6a/obEhPT990boXTmP7+GCfTnGf8TY2dTk5m/ebhDMIx1HMbG3O7OJznpho5dhD/fAPouY2urpFVzZyxfZ/c0tGkLZdzOvHwoO/e7X+Ow3E0nt1xcrmcC3xuAJ9z5UgVTOMaGbnb38XFpWv58nGG6+uArtGRMzWb3c416qtXe9fJl49lr/lEAZcrEDgL1vYBLwCuoLIRp0F9dWwsv4XLnch83xzgn87AWmcDa/GZQHCvBX328LF8fprLsWYH/CaasZbQWSgUrgGEiLNz17F01NFHnZ+WJpM13sfL5yjME+at6c+lljo4N5Hs0ZnDo+/m4fE2fOS8PIP+dR/X6lw18GFdXNyZ4Q06+OvWzSNs8rKy1mRlrXxG+xO1RoPDu7PD+4+orKzzRp0kyfeJiVlZrP6lgUPRas16f9RF3t58/oiblzyBS9eq0CcXEksZHc2NyNlKjWa9RIJ6nCKWX3UzJSXFMxAenp4taRB8RHzcdLb91Kn2Xxh9Y/thjUYicXd3F8XFKRTqQyubIEgJBDw9A7v4JPkhsexBb2ZmZnR05uHTDw9d6cXDgw+2wvvB2T17mpoSwtgCuE+S3sQnmYzv4+OjVsPw4ItEItD5T05t3bp1D5KQkJARlhEWFhZYSboR26tAj2b0fWBL3EUiL4VC3HslMRGCkJCQ7QkYYBEYdo/vRix7bNQ1fbpC8uOj7OzsRGjyQ7ABKioygM444tMWZpp9OPwG0L0UAYru32pra3NyMMlnkp3YVCRkVDSNIJY+yvTB4Q06+E//iCoqKko2Jj29/NOJO4EDFcAHxJL8h2o1qzOH9/krPj4+KmrbtqLk5OSc7IIcHzj7j/MBSA5ULCHsdvSo2VPj5RUQIO4+Exy8f78hweZnvL4ePTuAg5AMJcx3FHQbpgkQi0/sBYKDg5l3gQaqXiyeFhQUYHLQnCAWF/RImMOLxbrqtrayMuXeNowKC0vjS6NKoy5gQP6u12OyGNbDIr2+G4cX63S/lgWFhoYGBUGk/A4aJiv8AQN11DZMFuESnaz/T4S6TnYZdIqisAlSAm34R3ndDYsLhaUd+snMZjFJ33EXfJnMq5WieTQVSoX+feJ6kBaqIAr7agxOKqGYxN5mJnec0eGKukVRtFTK49FgeByHGJAmJSUdPUKSFylKWTjLnL0xze04wyzAGxRN86S0lIcz7GuV8kCOiIgIDw8/fjUiiUcp5xpvleP3Mwu2WisFeFJeAM7wk9GOAVSq8Ajp7L6NaNQsXN/kDS1NY0IzQ+uOoq6KifFDYlTho0c9u33byXDBHtHS8JDSdOsGLC5G1NSorPz8fBE/K9WM5zeIaWi4tWrLtQBNX8aX667WqCDw9d0C+PrZ99+CpnmAcqI+tb6+PjVVW34Eiz/ZYAuD/Yub3OtiktxQ9i1QAslJ6MVHi5kCZ7KaMXAbffMtkrz7FbKrpKTk+K1/Tw4bNrq4GBIrqzdGmdzY39HJ/tkMYANRank5kxSrXrMc5LfAuwtPfwNgs7kvGTbH/CW/Nua9N+F7gKl2QZM62978VT9ozO0mTRi/YP78BeMnzLEbaP8PbZs7ZcnTSNgAAAAASUVORK5CYII=',
      tr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAMFBMVEUKCw0y8Iwjml0ZYT0PKB0jmlwMGRUt03wNGRUrxXQefUwefkwqxXQlqGUmqWUURC13+a/8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAeUlEQVRIx+3USQ6AIAxA0RZBJof739YAboyQlgQSTfpXXfQtRBRAkga3EL0AEv0FHLra3gSqfoBqPFjhMZBA23jvb4YDtEWMZR/R0CDtZ5H2s2CBAOA8D2QR0pCE4T10KIPzpvNY3awXNwfkz7Tnen8UnKqd/Iil0V3ptgPv4rhglQAAAABJRU5ErkJggg==',
      mm: 'data:image/png;base64,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',
      qd: 'data:image/png;base64,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',
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
      qd: { id: 'qd', label: 'Qoder', short: 'Qoder', color: '#84CC16', ink: '#4D7C0F', tint: 'rgba(132,204,22,0.16)' }
    };
    var PLATFORM_ORDER = ['wb', 'tr', 'mm', 'qd'];

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
      return PROVIDER[id] || { label: id || '其他', color: C.accent, ink: C.accent };
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
    var THRESHOLD_PRESETS = [
      { id: 'tight', label: '紧', l7: 3, l30: 7, l90: 30 },
      { id: 'std', label: '标准', l7: 7, l30: 30, l90: 90 },
      { id: 'loose', label: '宽', l7: 14, l30: 60, l90: 180 }
    ];
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
        { id: 'expired', label: '已过期', color: '#8B8B8B' },
        { id: 'today', label: '今天到期', color: '#E5484D' },
        { id: 'l7', label: active.l7 + ' 天内', color: '#E5484D' },
        { id: 'l30', label: active.l30 + ' 天内', color: '#F97316' },
        { id: 'l90', label: active.l90 + ' 天内', color: '#FACC15' },
        { id: 'later', label: active.l90 + ' 天以上', color: '#94A3B8' },
        { id: 'never', label: '长期有效', color: C.faint }
      ];
    }

    var LEVELS = levelsOf(ACTIVE);

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
      if (days === null) return '长期';
      if (days < 0) return '已过期';
      if (days === 0) return '今天';
      return days + ' 天';
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
      if (typeof ms !== 'number' || !isFinite(ms)) return '长期';
      var d = new Date(ms);
      return (d.getMonth() + 1) + '/' + d.getDate();
    }

    function fmtFull(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return '长期有效';
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
          items.push({ platform: 'wb', name: p.name || '积分包', remain: p.remain || 0, size: p.size || 0, exp: p.expiresAtMs });
        });
      }
      if (data && data.tr && Array.isArray(data.tr.accounts)) {
        data.tr.accounts.forEach(function (a) {
          items.push({ platform: 'tr', name: a.desc || '积分账户', remain: a.remain || 0, size: a.size || 0, exp: a.expiresAtMs });
        });
      }
      if (data && data.mm) {
        var mm = data.mm;
        var lots = Array.isArray(mm.lots) ? mm.lots : [];
        if (lots.length) {
          lots.forEach(function (lot, i) {
            items.push({
              platform: 'mm',
              name: lots.length > 1 ? 'MiniMax 积分 ' + (i + 1) : 'MiniMax 积分',
              remain: lot.amount || 0,
              size: lot.amount || 0,
              exp: lot.expiresAtMs
            });
          });
        } else if (mm.total > 0) {
          /* No lot list at all: one balance, one known expiry date. */
          items.push({ platform: 'mm', name: 'MiniMax 积分', remain: mm.total, size: mm.total, exp: mm.expiresAtMs });
        }
      }
      if (data && data.qd && Array.isArray(data.qd.packages)) {
        data.qd.packages.forEach(function (p) {
          items.push({ platform: 'qd', name: p.name || 'Qoder 积分', remain: p.remain || 0, size: p.size || 0, exp: p.expiresAtMs });
        });
      }
      /* A drained pack is not an expiring balance: Trae keeps the account row
         after the credits are spent, and a '0 · 15天' line reads as if there
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
      return PLATFORM_ORDER.filter(function (id) { return (bucket.byPool[id] || 0) > 0; });
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

    function byPlatform(items) {
      return PLATFORM_ORDER.map(function (id) {
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

    function useData() {
      var pair = React.useState({ data: null, error: null, loading: true });
      var state = pair[0];
      var setState = pair[1];
      var alive = React.useRef(true);

      var load = React.useCallback(function () {
        setState(function (prev) {
          if (prev.loading) return prev;
          return { data: prev.data, error: prev.error, loading: true };
        });
        fetch(API, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (data) {
            if (!alive.current) return;
            setState({ data: data, error: null, loading: false });
          })
          .catch(function (err) {
            if (!alive.current) return;
            /* Keep the last good payload on screen: a two-second hiccup must not
               blank the numbers, and the stale stamp is what tells the reader
               how old they are. */
            setState(function (prev) {
              return { data: prev.data, error: String((err && err.message) || err), loading: false };
            });
          });
      }, []);

      React.useEffect(function () {
        alive.current = true;
        load();
        var timer = setInterval(load, REFRESH_MS);
        return function () {
          alive.current = false;
          clearInterval(timer);
        };
      }, []);

      return [state, load];
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
          style: { width: (p.value / total * 100) + '%', background: p.color, flex: 'none' }
        });
      }));
    }

    function RefreshButton(props) {
      return h('button', {
        type: 'button',
        onClick: props.onClick,
        title: '刷新',
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
      }, props.spinning ? '…' : '↻');
    }

    function Section(props) {
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
        return h('span', { style: { fontSize: 10, color: C.faint, whiteSpace: 'nowrap' } }, '免费模型');
      }
      if (props.unpriced) {
        return h('span', { style: { fontSize: 10, color: C.faint, whiteSpace: 'nowrap' } }, '无公开价');
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

    var VENDOR_LABEL = { deepseek: 'DeepSeek', zhipu: '智谱', minimax: 'MiniMax' };

    /**
     * Where the money figure came from. Nothing here is a magic constant any
     * more: each call pays its vendor's own list price, split by token kind
     * (fresh input / cache hit / output), and DeepSeek charges twice as much
     * inside its peak windows, so the split is part of the answer.
     */
    function PricingNote(props) {
      var usage = props.usage;
      if (!usage || !usage.pricing) return '金额按各模型官方 token 单价估算（含缓存命中价）。';
      var pricing = usage.pricing;
      var vendors = (pricing.vendors || []).map(function (v) { return VENDOR_LABEL[v] || v; });
      /* Every vendor names its own origin: 'official, all three live' while one
         page failed and fell back to a cached number is exactly the quiet lie
         the money column must not tell. */
      var originOf = pricing.vendorSource || null;
      var ORIGIN_TEXT = { live: '官网实时', cache: '上次成功抓取', bundled: '内置快照' };
      var stamped = originOf
        ? Object.keys(originOf).map(function (v) { return (VENDOR_LABEL[v] || v) + ' ' + (ORIGIN_TEXT[originOf[v]] || originOf[v]); }).join(' / ')
        : vendors.join(' / ');
      var source = pricing.live
        ? '官方价目 · ' + stamped
        : (pricing.fetchedAt ? '缓存价目（' + stamped + '）' : '内置价目（尚未联网抓取）');
      var when = pricing.fetchedAt ? ' · 抓取于 ' + fmtFull(pricing.fetchedAt) : '';
      var pools = usage.pools || {};
      var rates = [];
      PLATFORM_ORDER.forEach(function (id) {
        if (!(id in pools)) return;
        var pool = pools[id];
        if (!pool || !(pool.rate > 0) || pool.estimated) return;
        rates.push(PLATFORM[id].short + ' ' + (pool.rate).toFixed(2) + ' 分/元');
      });
      var estimated = PLATFORM_ORDER.filter(function (id) {
        var pool = pools[id];
        return pool && pool.estimated;
      }).map(function (id) { return PLATFORM[id].short; });
      var rateText = rates.length
        ? ' 积分按各平台自己的消耗数分摊到模型（' + rates.join('，') + '）。'
        : ' ';
      if (estimated.length) {
        rateText += estimated.join('、') + ' 未返回消耗数，该平台的积分分摊与金额换算不可用，只统计 token。';
      }
      var parts = ['金额按各模型官方 token 单价估算（分输入、缓存命中、输出三档），' + source + when + '。' + rateText];
      if (pricing.missing && pricing.missing.length) {
        parts.push('没有公开价的模型（' + pricing.missing.join('、') + '）只计 token，不计金额。');
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
        title: 'WorkBuddy 其他账号',
        extra: h('span', { style: { fontSize: 10, color: C.faint } }, accounts.length + ' 个 · 共 ' + fmtAmount(total) + ' 积分'),
        children: h('div', null, accounts.map(function (a, i) {
          var days = daysLeft(a.expiresAtMs);
          return h('div', {
            key: (a.name || '') + i,
            style: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid ' + C.line }
          },
            h('span', { style: { flex: 1, minWidth: 0, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.name || '未命名账号'),
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
      if (data && data.wb && data.wb.tokenExpiresAtMs) rows.push({ id: 'wb', exp: data.wb.tokenExpiresAtMs, note: '登录' });
      if (data && data.tr && data.tr.tokenExpiresAtMs) rows.push({ id: 'tr', exp: data.tr.tokenExpiresAtMs, note: '访问令牌' });
      if (data && data.tr && data.tr.refreshExpiresAtMs) rows.push({ id: 'tr', exp: data.tr.refreshExpiresAtMs, note: '刷新令牌' });
      if (!rows.length) return null;
      var soon = rows.filter(function (r) { var d = daysLeft(r.exp); return d !== null && d <= ACTIVE.l30; });
      if (!soon.length) return null;
      return h('div', {
        style: {
          marginTop: 16, padding: '9px 12px', borderRadius: 8, fontSize: 11,
          color: C.orange, border: '1px solid ' + C.line, background: 'rgba(249,115,22,0.08)'
        }
      }, '登录凭据快到期：' + soon.map(function (r) {
        return PLATFORM[r.id].label + ' ' + r.note + ' ' + fmtDate(r.exp) + '（' + countdownLabel(daysLeft(r.exp)) + '）';
      }).join('；') + '。过期后这一栏会整片读取失败。');
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
        tail = h('span', { style: { color: C.green } }, ' · 有新版本 v' + info.latest + '，去 Releases 看看');
      } else if (info && info.latest) {
        tail = h('span', { style: { color: C.faint } }, ' · 已是最新');
      } else if (info && info.error) {
        tail = h('span', { style: { color: C.faint } }, ' · 无法检查更新');
      } else if (busy) {
        tail = h('span', { style: { color: C.faint } }, ' · 检查中');
      }
      return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.faint } },
        h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, label),
        tail,
        onRecheck ? h('button', {
          type: 'button',
          onClick: onRecheck,
          disabled: busy,
          title: '重新检查更新',
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
        }, busy ? '…' : '检查') : null
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
      var windows = (peak.windows || []).map(function (w) { return w[0] + ':00-' + w[1] + ':00'; }).join('、');
      return h('div', { style: { marginTop: 12, padding: '12px 14px', border: '1px solid ' + C.line, borderRadius: 10 } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 } },
          h('span', { style: { fontSize: 11, color: C.dim } }, '峰谷用量'),
          h('span', { style: { fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
            '高峰 ' + peakPct + '% · 空闲 ' + (100 - peakPct) + '%')
        ),
        h('div', { style: { display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: C.soft } },
          h('div', { style: { width: peakPct + '%', background: C.orange } }),
          h('div', { style: { width: (100 - peakPct) + '%', background: C.green } })
        ),
        h('div', { style: { display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: C.dim, flexWrap: 'wrap' } },
          h('span', { style: { display: 'flex', alignItems: 'center' } }, Dot({ color: C.orange, size: 5 }), '高峰 ' + fmtCompact(peakTokens) + ' tok'),
          h('span', { style: { display: 'flex', alignItems: 'center' } }, Dot({ color: C.green, size: 5 }), '空闲 ' + fmtCompact(idleTokens) + ' tok')
        ),
        h('div', { style: { marginTop: 6, fontSize: 10, color: C.faint, lineHeight: '15px' } },
          '高峰 = 北京时间工作日 ' + (windows || '9:00-12:00、14:00-18:00') + '（法定节假日除外的全天空闲），DeepSeek 高峰价是空闲价的 2 倍；智谱与 MiniMax 不分峰谷。')
      );
    }

    /* ---------- left sidebar row (compact) ---------- */

    function MiniEntry() {
      var pair = useData();
      var state = pair[0];
      var load = pair[1];
      var data = state.data;
      var items = collect(data);
      var buckets = bucketize(items.filter(function (i) { return i.remain > 0; }));
      var soon = buckets.filter(function (b) { return b.exp !== null; }).slice(0, 2);
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
        title: '积分到期 · 点击查看完整面板',
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
          h('span', { style: { fontSize: 11, color: C.dim, letterSpacing: 0.2 } }, '积分到期'),
          h('span', { style: { fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }, fmtAmount(total))
        ),
        state.error ? h('div', { style: { fontSize: 11, color: C.red } }, '读取失败') : null,
        state.loading && !data ? h('div', { style: { fontSize: 11, color: C.faint } }, '读取中…') : null,
        waste > 0
          ? h('div', {
            style: { fontSize: 10, color: C.red, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }
          }, Dot({ color: C.red, size: 4 }), fmtAmount(waste) + ' 积分会在用掉前过期')
          : null,
        h('div', { style: { display: 'flex', gap: 10, marginBottom: soon.length ? 6 : 0, flexWrap: 'wrap' } },
          PLATFORM_ORDER.map(function (id) {
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
        !state.loading && !state.error && soon.length === 0
          ? h('div', { style: { fontSize: 11, color: C.faint } }, '暂无临期积分')
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
          title: '返回会话',
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
            h('div', { style: { fontSize: 15, fontWeight: 600, color: C.text } }, '积分到期'),
            VersionLine({ info: props.version, busy: props.versionBusy, onRecheck: props.onRecheck })
          ),
          h('div', { style: { fontSize: 11, color: C.faint, marginTop: 2 } }, 'WorkBuddy、Trae、MiniMax 与 Qoder 的积分余额、到期节奏与消耗')
        ),
        props.updatedAt ? h('span', { style: { fontSize: 11, color: C.faint, flex: 'none' } }, '更新于 ' + fmtClock(props.updatedAt)) : null,
        RefreshButton({ onClick: props.onRefresh, spinning: props.spinning })
      );
    }

    function Hero(props) {
      var items = props.items;
      var total = sumOf(items, 'remain');
      var parts = PLATFORM_ORDER.map(function (id) {
        var meta = PLATFORM[id];
        var value = sumOf(items.filter(function (i) { return i.platform === id; }), 'remain');
        return { key: id, value: value, color: meta.color, title: meta.label + ' ' + fmtAmount(value) };
      }).filter(function (p) { return p.value > 0; });
      return h('div', {
        style: {
          marginTop: 18,
          padding: '16px 18px',
          borderRadius: 12,
          border: '1px solid ' + C.line,
          background: C.soft
        }
      },
        h('div', { style: { fontSize: 11, color: C.dim } }, '剩余积分合计'),
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
        )
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
          '30 天内没有到期积分'
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
        h('span', { style: { flex: 1 } }, ACTIVE.l30 + ' 天内有 ' + soon.length + ' 个到期日，共 ' + fmtAmount(amount) + ' 积分'),
        h('span', { style: { fontSize: 11, color: C.faint } }, '优先消耗')
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
          '按近 7 天的消耗速度，没有积分会烂在到期日上'
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
            '按当前速度，' + fmtAmount(totalWaste) + ' 积分会在用掉前过期'),
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
              mine.short + '「' + r.item.name + '」' + fmtDate(r.item.exp) + ' 到期（' + (r.days <= 0 ? '今天' : '还剩 ' + r.days + ' 天') + '）'),
            h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.faint } },
              '每天 ' + fmtAmount(r.burn) + ' · 到期前只能花 ' + fmtAmount(canSpend)),
            h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.red, minWidth: 54, textAlign: 'right' } },
              '浪费 ' + fmtAmount(r.wasted))
          );
        }),
        doomed.length > 4
          ? h('div', { style: { marginTop: 4, fontSize: 10, color: C.faint } }, '另有 ' + (doomed.length - 4) + ' 个积分包同样会在到期前用不完')
          : null,
        adviceLine(rows, usage)
          ? h('div', { style: { marginTop: 8, fontSize: 11, color: C.orange } }, adviceLine(rows, usage))
          : null,
        h('div', { style: { marginTop: 7, fontSize: 10, color: C.faint, lineHeight: '15px' } },
          '消耗速度取各平台自己的积分口径、近 7 天日均；同一平台内按余额比例分摊到各积分包。')
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
      return '建议先用 ' + PLATFORM[top.item.platform].label + ' 的「' + top.item.name + '」'
        + (cny === null ? '' : '（约 ¥' + fmtPrecise(cny) + ' 会作废）');
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
      if (!rows.length) return h('div', { style: { fontSize: 12, color: C.faint } }, '暂无积分包');

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
          cell('平台 / 积分包', { color: C.faint, size: 10 }),
          cell('剩余（积分）', { color: C.faint, size: 10, align: 'right' }),
          cell('总量', { color: C.faint, size: 10, align: 'right' }),
          cell('已用', { color: C.faint, size: 10, align: 'right' }),
          cell('到期日', { color: C.faint, size: 10, align: 'right' }),
          cell('剩余天数', { color: C.faint, size: 10, align: 'right' })
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
            cell(item.exp === null ? '长期' : fmtDate(item.exp), { align: 'right' }),
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
          h('span', { style: { fontSize: 11, color: C.dim } }, month.getFullYear() + ' 年 ' + (month.getMonth() + 1) + ' 月'),
          h('span', { style: { fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
            monthTotal > 0 ? '本月到期 ' + fmtAmount(monthTotal) : '本月无到期')
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 3, marginBottom: 4 } },
          ['一', '二', '三', '四', '五', '六', '日'].map(function (w) {
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
              title: cell.key + (cell.value > 0 ? ' · ' + fmtAmount(cell.value) + ' 积分到期' : ' · 无到期'),
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
              }
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
            ? h('div', { style: { fontSize: 11, color: C.faint } }, '没有带有效期的积分')
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
                  bucket.count > 1 ? bucket.count + ' 项' : (bucket.names[0] || '')),
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
      var parts = PLATFORM_ORDER.map(function (id) {
        return { key: id, value: bucket.byPool[id] || 0, color: PLATFORM[id].color, title: PLATFORM[id].label };
      });
      var pools = PLATFORM_ORDER.filter(function (id) { return (bucket.byPool[id] || 0) > 0; });
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
              bucket.count > 1 ? bucket.count + ' 项 · ' + bucket.names.slice(0, 2).join('、') : (bucket.names[0] || '积分'))
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
      if (!daily.length) return h('div', { style: { fontSize: 12, color: C.faint } }, '暂无日粒度数据');
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
        { v: avg, label: '日均 ' + fmtAmount(avg), dash: '3px 3px' }
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
              title: d.date + ' · ' + fmtAmount(d.credits) + ' 积分 · ' + d.calls + ' 次 · ' + fmtCompact(d.tokens) + ' tokens · ≈¥' + fmtPrecise(d.costCny),
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
                  title: (id === '__all' ? '' : PLATFORM[id].label + ' ') + fmtAmount(part) + ' 积分',
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
      return ' · 命中 ' + Math.round(read / all * 100) + '%';
    }

    function ProviderList(props) {
      var all = props.providers || [];
      var providers = all.slice(0, 6);
      var hidden = props.total ? Math.max(0, props.total - providers.length) : Math.max(0, all.length - 6);
      if (!providers.length) return h('div', { style: { fontSize: 12, color: C.faint } }, '暂无积分消耗');
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
          h('span', { style: { width: 46, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, p.calls + ' 次'),
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
      }, '另有 ' + hidden + ' 个模型未列出')] : []));
    }

    function SessionList(props) {
      var sessions = (props.sessions || []).slice(0, 10);
      if (!sessions.length) return h('div', { style: { fontSize: 12, color: C.faint } }, '暂无积分会话');
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
            s.title || (s.top ? s.top.split(':')[1] : '会话')
          ),
          h('span', { style: { width: 46, textAlign: 'right', flex: 'none', fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' } }, s.calls + ' 次'),
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
        new window.Notification('有积分会在用掉前过期', {
          body: fmtAmount(total) + ' 积分按当前速度用不完 · ' + adviceLine(rows, usage),
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
          Dot({ color: C.green, size: 4 }), '到期提醒已开启');
      }
      if (state === 'denied') {
        return h('span', { style: { fontSize: 10, color: C.faint } }, '系统通知被浏览器拒绝');
      }
      if (typeof window === 'undefined' || typeof window.Notification !== 'function') {
        return h('span', { style: { fontSize: 10, color: C.faint } }, '此环境不支持系统通知');
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
      }, '开启到期提醒');
    }

    /* The whole page as one sentence, for pasting into a chat or a note. */
    function summaryText(items, buckets, usage, rows) {
      var lines = ['积分到期 · ' + fmtFull(Date.now())];
      lines.push('合计 ' + fmtAmount(items.reduce(function (s, i) { return s + (i.remain || 0); }, 0)) + ' 积分');
      if (usage && usage.totals) {
        lines.push('已用 ' + fmtAmount(usage.totals.credits) + ' 积分 ≈¥' + fmtPrecise(usage.totals.costCny)
          + ' · ' + usage.totals.calls + ' 次 · ' + fmtCompact(usage.totals.tokens) + ' tok');
      }
      buckets.slice(0, 5).forEach(function (b) {
        lines.push('· ' + fmtDate(b.exp) + ' 到期 ' + fmtAmount(b.total) + '（' + b.names.join('、') + '）');
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
      /* A plain-http origin has no navigator.clipboard, and claiming '已复制'
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
        title: '把整页摘要复制成文本',
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
      }, state === 'done' ? '已复制' : (state === 'failed' ? '复制失败' : '复制摘要'));
    }

    /* Switching a preset mutates the module-level scale and asks the page to
       redraw. Every colour on the page reads levelOf() at render time, so one
       re-render recolours rows, calendar and mini entry together. */
    function ThresholdPicker(props) {
      var pair = React.useState(ACTIVE.id);
      var active = pair[0];
      var setActive = pair[1];
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        h('span', { style: { fontSize: 10, color: C.faint, marginRight: 2 } }, '临期档位'),
        THRESHOLD_PRESETS.map(function (p) {
          var on = p.id === active;
          return h('button', {
            key: p.id,
            type: 'button',
            title: p.l7 + ' / ' + p.l30 + ' / ' + p.l90 + ' 天',
            onClick: function () {
              ACTIVE = p;
              LEVELS = levelsOf(p);
              try { window.localStorage.setItem(THRESHOLD_KEY, p.id); } catch (e) { /* private mode */ }
              setActive(p.id);
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

    function PageEntry(props) {
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
            spinning: state.loading
          }),
          state.error ? h('div', { style: { marginTop: 14, fontSize: 12, color: C.red } }, '读取失败：' + state.error + (data ? '（下面是上次成功读取的数据）' : '')) : null,
          missing.length
            ? h('div', {
              style: {
                marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 11,
                color: C.orange, border: '1px solid ' + C.line, background: 'rgba(249,115,22,0.08)'
              }
            }, '有平台没读上来：' + missing.map(function (id) { return PLATFORM[id].label; }).join('、') + '。下面的合计不含它们，不等于它们已经花光。')
            : null,
          data && data.errors && data.errors.length
            ? h('div', { style: { marginTop: 10, fontSize: 11, color: C.orange } }, data.errors.join(' · '))
            : null,
          Hero({ items: items }),
          Alert({ buckets: buckets, usage: usage }),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 } },
            CopyButton({ text: function () { return summaryText(items, buckets, usage, rows); } }),
            NotifyButton({})
          ),
          Foresight({ rows: rows, usage: usage }),
          Section({ title: '按平台', children: h('div', { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
            cards.map(function (card) { return h(PlatformCard, { key: card.id, card: card }); })
          ) }),
          Section({
            title: '按到期日',
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
                }, expanded ? '收起' : '展开全部 ' + buckets.length + ' 个到期日')
                : null
            )
          }),
          Section({
            title: '积分账本',
            extra: h('span', { style: { fontSize: 10, color: C.faint } }, items.length + ' 个积分包'),
            children: CreditLedger({ items: items })
          }),
          Section({
            title: '到期日历',
            extra: h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              h('span', { style: { fontSize: 10, color: C.faint } }, '格内数字 = 当天到期积分'),
              h('button', {
                type: 'button',
                onClick: function () { setMonthOffset(monthOffset - 1); },
                title: '上个月',
                style: {
                  border: '1px solid ' + C.line, background: 'transparent', color: C.dim,
                  borderRadius: 5, width: 20, height: 20, lineHeight: '16px', fontSize: 11,
                  cursor: 'pointer', padding: 0
                }
              }, '‹'),
              h('button', {
                type: 'button',
                onClick: function () { setMonthOffset(monthOffset + 1); },
                title: '下个月',
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
          }, '用量统计暂未加载：宿主半改动需要重启一次 DSH 才会生效。') : null,
          Section({
            title: '积分消耗 · 近 14 天',
            extra: usage ? h('span', { style: { fontSize: 11, color: C.faint } },
              fmtAmount(usage.totals.credits) + ' 积分 · ' + usage.totals.calls + ' 次 · ' + fmtCompact(usage.totals.tokens) + ' tok · ≈¥' + fmtPrecise(usage.totals.costCny)) : null,
            children: h('div', null,
              h('div', { style: { padding: '12px 14px', border: '1px solid ' + C.line, borderRadius: 10 } },
                DailyChart({ daily: usage ? usage.daily : [] })
              ),
              usage ? PeakSplit({ peak: usage.pricing ? usage.pricing.peak : null }) : null,
              h('div', { style: { marginTop: 14 } }, ProviderList({ providers: usage ? usage.providers : [], total: usage ? usage.providerCount : 0 }))
            )
          }),
          Section({
            title: '积分会话',
            extra: usage ? h('span', { style: { fontSize: 11, color: C.faint } }, '共 ' + usage.sessionCount + ' 条') : null,
            children: SessionList({ sessions: usage ? usage.sessions : [] })
          }),
          AccountPool({ data: data }),
          CredentialLine({ data: data }),
          h('div', { style: { marginTop: 22, fontSize: 10, color: C.faint, lineHeight: '16px' } },
            '积分余额与到期来自 WorkBuddy / Trae / MiniMax / Qoder 账号接口；消耗来自本机 cost-meter 账本，只统计这四个积分池。',
            h('br', null),
            PricingNote({ usage: usage }),
            h('br', null),
            'Qoder 积分本身不带到期日，这里用的是套餐到期时间（套餐失效后余额一并消失）。'
          )
        )
      );
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
