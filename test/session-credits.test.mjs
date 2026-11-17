/**
 * 会话消耗同源守卫：修「同一会话换模型后会话消耗显示 0」的回归。
 *
 * 根因回顾：会话 credits 曾经走「金额 × 汇率」的二次换算，qoder 这类无价模型
 * 的池 rate=null，整段跳过导致 credits 归零；而今日用量走 creditsOf 直接按
 * token 权重分摊池积分，所以有值。两者不一致。
 *
 * 本测试用合成账本（不碰本机真实账本）断言：带 consumed 时，会话 credits
 * 必须由 creditsOf 得出（与 daily 同源），即使对应池的 rate 为 null。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { summarizeUsage } = await import('file:///C:/Users/user/.dsh/local-plugins/dsh-credit-expiry/lib/index.js');

/** 合成账本：一天，一个会话，包含 qoder 无价模型 + workbuddy 收费模型。 */
function ledger() {
  return {
    config: {},
    days: {
      '2026-11-17': {
        byProviderModel: {
          'qoder:qmodel_latest': { calls: 40, input: 800000, output: 200000 },
          'workbuddy:deepseek-v4.1-flash': { calls: 10, input: 100000, output: 50000 }
        },
        sessions: [{
          id: 'session-mixed', at: Date.parse('2026-11-17T10:00:00Z'), title: '换模型会话',
          byProviderModel: {
            'qoder:qmodel_latest': { calls: 40, input: 800000, output: 200000 },
            'workbuddy:deepseek-v4.1-flash': { calls: 10, input: 100000, output: 50000 }
          }
        }]
      }
    }
  };
}

test('无价模型池 rate=null 时，会话 credits 仍由 creditsOf 得出（不再归零）', () => {
  const r = summarizeUsage(ledger(), { consumed: { wb: 100, qd: 50 } });
  assert.ok(r, 'summarizeUsage 应返回结果');
  const qd = r.pools.qd;
  assert.equal(qd.rate, null, 'qoder 无价模型池的 rate 应为 null（前提）');
  assert.equal(qd.credits, 50, 'qoder 池依然有平台上报的积分');
  const s = r.sessions.find(x => x.id === 'session-mixed');
  assert.ok(s, '会话应存在');
  assert.ok(s.calls > 0, '调用次数应有值');
  assert.ok(s.credits > 0, '会话 credits 必须 > 0（修复点：不能再是 0）');
  assert.ok(s.credits <= 150, '会话 credits 不应超过所有池积分之和');
});

test('会话 credits 与 daily credits 同源：同一天各会话之和不超过当日 credits', () => {
  const r = summarizeUsage(ledger(), { consumed: { wb: 100, qd: 50 } });
  const s = r.sessions.find(x => x.id === 'session-mixed');
  const day = r.daily.find(d => d.date === '2026-11-17');
  assert.ok(day, '当日数据应存在');
  // 会话里的数据是当日数据的子集（当日 byModel 与 session 相同），credits 应基本一致
  assert.ok(Math.abs(s.credits - day.credits) < 1e-6,
    '同一批数据下，会话 credits 应等于当日 credits（同源），实际 ' + s.credits + ' vs ' + day.credits);
});

test('换模型会话（qoder→workbuddy）两段消耗都计入 credits', () => {
  const r = summarizeUsage(ledger(), { consumed: { wb: 100, qd: 50 } });
  const s = r.sessions.find(x => x.id === 'session-mixed');
  const dayZero = summarizeUsage(ledger(), {});
  const sZero = dayZero.sessions.find(x => x.id === 'session-mixed');
  assert.equal(sZero.credits, 0, '没有 consumed 时无法分摊，credits 为 0（合理）');
  assert.ok(s.credits > sZero.credits, '有 consumed 时会话 credits 必须大于无 consumed 时');
});
