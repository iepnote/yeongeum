import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { IncomeSource, Rules } from '../types'
import { DEFAULT_RETIREMENT } from './fixtures'
import { annuityMonthly } from '../pension/annuity'
import { mutualAidFvAtRetire } from '../pension/mutualAidFund'
import { retentionProbability, simulateRetirement } from '../pension/retirement'
import { adviseRetirement } from '../report/advisor'

const RULES = rulesJson as unknown as Rules

describe('adviseRetirement — 종합 의견 (규칙 기반)', () => {
  it('프레이밍(고정 재원 vs 레버)과 공백기 분석이 항상 포함된다', () => {
    const a = adviseRetirement({ retirement: DEFAULT_RETIREMENT, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES })
    expect(a.some((x) => x.text.includes('조정할 수 없는 고정 재원'))).toBe(true)
    expect(a.some((x) => x.text.includes('공백기'))).toBe(true)
  })

  it('공제회 미반영 + 총액 있음 → 최적 분할 기간을 실제 비교로 제안', () => {
    const total = 18200
    const a = adviseRetirement({ retirement: DEFAULT_RETIREMENT, incomeSources: [], mutualAidTotal: total, payoutRatePct: 3.8, rules: RULES })
    const rec = a.find((x) => x.text.includes('아직 수령기에 반영되지'))!
    expect(rec).toBeTruthy()
    expect(rec.kind).toBe('action')
    // 제안된 기간이 브루트포스 최적(동률 시 유지 확률 판정 포함)과 일치하는지 검증
    const scores = [5, 10, 15, 20].map((y) => {
      const src: IncomeSource = { id: 't', label: '', kind: 'mutual-aid', monthlyAmount: annuityMonthly(total, 3.8, y), startAge: 63, endAge: 62 + y, inflationLinked: false }
      const r = simulateRetirement(DEFAULT_RETIREMENT, RULES, [src])
      const retained = retentionProbability(DEFAULT_RETIREMENT, RULES, [src], { runs: 400 }).probRetained
      return { y, s: (r.uncoveredAge ?? 200) * 1_000_000 + (r.poolOutAge ?? 200) * 1_000 + Math.min((r.bal85 ?? 0) / 1000, 999), retained }
    })
    const bestY = scores.reduce((p, c) => (c.s > p.s || (c.s === p.s && c.retained > p.retained) ? c : p)).y
    expect(rec.text).toContain(`${bestY}년 분할`)
  })

  it('사적연금: 한도 미만이면 증액 효과를 직접 비교해 개선 시에만 제안, 한도면 양호', () => {
    const sc = (r: ReturnType<typeof simulateRetirement>) =>
      (r.uncoveredAge ?? 200) * 1_000_000 + (r.poolOutAge ?? 200) * 1_000 + Math.min((r.bal85 ?? 0) / 1000, 999)
    const inp = { ...DEFAULT_RETIREMENT, privateAnnual: 1000 }
    const improves = sc(simulateRetirement({ ...inp, privateAnnual: 1500 }, RULES, [])) > sc(simulateRetirement(inp, RULES, []))
    const under = adviseRetirement({ retirement: inp, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES })
    expect(under.some((x) => x.kind === 'action' && x.text.includes('한도까지'))).toBe(improves) // 제안 여부 = 실제 개선 여부
    const atLimit = adviseRetirement({ retirement: DEFAULT_RETIREMENT, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES })
    expect(atLimit.some((x) => x.kind === 'good' && x.text.includes('한도를 정확히'))).toBe(true)
  })

  it('주택연금 미사용 + 미달 예상 → 제안', () => {
    const a = adviseRetirement({ retirement: { ...DEFAULT_RETIREMENT, housingMonthly: 0 }, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES })
    expect(a.some((x) => x.kind === 'action' && x.text.includes('주택연금'))).toBe(true)
  })

  it('action이 맨 앞으로 정렬된다', () => {
    const a = adviseRetirement({ retirement: { ...DEFAULT_RETIREMENT, housingMonthly: 0 }, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES })
    const firstInfo = a.findIndex((x) => x.kind === 'info')
    const lastAction = a.map((x) => x.kind).lastIndexOf('action')
    expect(lastAction).toBeLessThan(firstInfo)
  })
})

describe('mutualAidFvAtRetire — The-K 조회값 연장', () => {
  const m = { queriedTotal: 17109, queriedBaseDate: '2037-08-31', monthlyContribution: 36, accrualRatePct: 3.8 }
  it('기준일 < 퇴직일이면 잔여 구간만 연장 (앨리스: 2037-08 조회 → 2038-08 퇴직, 12개월)', () => {
    const fv = mutualAidFvAtRetire(m, '2038-08-31', '2026-08-09')
    const i = 3.8 / 100 / 12
    const g = Math.pow(1 + i, 12)
    expect(fv).toBeCloseTo(17109 * g + 36 * ((g - 1) / i), 6) // ≈ 1.82억
  })
  it('기준일 ≥ 퇴직일이면 조회값 그대로', () => {
    expect(mutualAidFvAtRetire(m, '2037-08-31', '2026-08-09')).toBe(17109)
    expect(mutualAidFvAtRetire(m, '2037-01-01', '2026-08-09')).toBe(17109)
  })
  it('주택 시세가 주택연금 상한(12억) 초과 시 이주(다운사이징) 비교 조언 포함', () => {
    const a = adviseRetirement({ retirement: DEFAULT_RETIREMENT, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES, housePrice: 150000 })
    const adv = a.find((x) => x.text.includes('상한 12억'))!
    expect(adv).toBeTruthy()
    expect(adv.text).toContain('3.0억') // 초과분 15억 − 12억
    expect(adv.text).toContain('27,000만') // 90% 목돈화 가정
    // 상한 이하면 조언 없음
    const b = adviseRetirement({ retirement: DEFAULT_RETIREMENT, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES, housePrice: 90000 })
    expect(b.some((x) => x.text.includes('상한 12억'))).toBe(false)
  })
  it('잉여 구간이 있으면 스윕(잉여 적립) 제안, 주택연금 사용+시세 입력 시 개시 지연 스캔', () => {
    // 공적연금을 목표의 2배로 → 65세부터 큰 잉여
    const rich = { ...DEFAULT_RETIREMENT, publicMonthly: DEFAULT_RETIREMENT.targetMonthly * 2 }
    const a = adviseRetirement({ retirement: rich, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES, housePrice: 50000 })
    expect(a.some((x) => x.text.includes('잉여 합계'))).toBe(true)
    expect(a.some((x) => x.text.includes('주택연금 개시'))).toBe(true)
    // 스윕을 이미 켰으면 잉여 제안 없음
    const b = adviseRetirement({ retirement: { ...rich, sweepSurplus: true }, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES })
    expect(b.some((x) => x.text.includes('잉여 합계'))).toBe(false)
  })
  it('주택연금 개시 나이가 시뮬 범위 밖(55세 등)이어도 크래시 없이 동작', () => {
    for (const hs of [55, 61, 95, 96]) {
      const r = { ...DEFAULT_RETIREMENT, housingStartAge: hs }
      expect(() => adviseRetirement({ retirement: r, incomeSources: [], mutualAidTotal: 0, payoutRatePct: 3.8, rules: RULES, housePrice: 90000 })).not.toThrow()
    }
  })
})
