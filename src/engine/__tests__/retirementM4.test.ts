import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { IncomeSource, Rules } from '../types'
import { DEFAULT_RETIREMENT } from './fixtures'
import { compareHousingPension, deflateResult, simulateRetirement } from '../pension/retirement'
import { suspendedPension } from '../pension/suspension'
import { earnedIncomeAfterDeduction } from '../tax/comprehensive'
import { netFactorOf } from '../tax/incomeSourceTax'

const RULES = rulesJson as unknown as Rules

const src = (p: Partial<IncomeSource>): IncomeSource => ({
  id: 't',
  label: 'test',
  kind: 'rent-housing',
  monthlyAmount: 0,
  startAge: 63,
  endAge: null,
  inflationLinked: false,
  ...p,
})

describe('지급정지 (공무원연금법 제50조③)', () => {
  const S = RULES.pensionSuspension
  it('공단 예시: 초과소득월액 120만 → 정지 45만', () => {
    // 연금 충분히 커서 상한 미적용 가정
    expect(suspendedPension(3_000_000, S.avgPensionMonthly + 1_200_000, S)).toBe(450_000)
  })
  it('초과 없으면 정지 0', () => {
    expect(suspendedPension(3_000_000, S.avgPensionMonthly, S)).toBe(0)
    expect(suspendedPension(3_000_000, 0, S)).toBe(0)
  })
  it('상한: 연금월액의 1/2', () => {
    expect(suspendedPension(600_000, S.avgPensionMonthly + 10_000_000, S)).toBe(300_000)
  })
  it('근로소득공제: 총급여 4,800만 → 공제 1,215만(1,200만+4,500만 초과분 5%) → 근로소득금액 3,585만', () => {
    expect(earnedIncomeAfterDeduction(48_000_000, RULES)).toBe(35_850_000)
  })
})

describe('수입원 세후 계수 (F-5)', () => {
  it('임대(주택) 경비 50% 후 15.4% → 계수 0.923', () => {
    expect(netFactorOf('rent-housing', RULES)).toBeCloseTo(1 - 0.5 * 0.154, 10)
  })
  it('기타소득 경비 60% 후 22% → 계수 0.912', () => {
    expect(netFactorOf('other', RULES)).toBeCloseTo(1 - 0.4 * 0.22, 10)
  })
  it('근로·추가 공적연금·공제회는 계수 1 (세전≈세후 근사)', () => {
    expect(netFactorOf('work', RULES)).toBe(1)
    expect(netFactorOf('public-extra', RULES)).toBe(1)
    expect(netFactorOf('mutual-aid', RULES)).toBe(1)
  })

  it('국민연금 병행(public-extra): 별도 층(extraPublic)으로 개시연령부터 물가연동 반영', () => {
    const r = simulateRetirement(DEFAULT_RETIREMENT, RULES, [
      src({ kind: 'public-extra', monthlyAmount: 30, startAge: 65, inflationLinked: true }),
    ])
    expect(r.rows[0].extraPublic).toBe(0) // 63세: 개시 전
    const r65 = r.rows.find((x) => x.age === 65)!
    expect(r65.extraPublic).toBeCloseTo(30 * 1.025 ** 2, 5) // 물가연동
    expect(r65.extra).toBe(0) // 일반 추가 층에는 미포함 (차트 분리)
    expect(r65.suspended).toBe(0) // 국민연금은 공무원연금 지급정지 소득이 아님
  })

  it('공제회 분할급여액: annuity 공식 (총액·기간·급여율 → 월액)', async () => {
    const { annuityMonthly } = await import('../pension/annuity')
    // 급여율 0 → 단순 균등 분할
    expect(annuityMonthly(12000, 0, 10)).toBeCloseTo(100, 10)
    // 1.84억, 10년, 3.8%: 월이율 적용 원리금 균등 — 단순 분할(153.3만)보다 커야 하고 손계산치와 일치
    const m = annuityMonthly(18400, 3.8, 10)
    expect(m).toBeGreaterThan(18400 / 120)
    const i = 3.8 / 100 / 12
    expect(m).toBeCloseTo((18400 * i) / (1 - Math.pow(1 + i, -120)), 8)
    // 기간을 늘리면 월액 감소
    expect(annuityMonthly(18400, 3.8, 15)).toBeLessThan(m)
  })

  it('공제회 적립 추정: 복리 FV (급여율 0이면 단순 합)', async () => {
    const { projectMutualAid } = await import('../pension/mutualAidFund')
    expect(projectMutualAid(10000, 36, 0, 144)).toBeCloseTo(10000 + 36 * 144, 10)
    const i = 3.8 / 100 / 12
    const g = Math.pow(1 + i, 144)
    expect(projectMutualAid(10000, 36, 3.8, 144)).toBeCloseTo(10000 * g + 36 * ((g - 1) / i), 6)
    expect(projectMutualAid(10000, 36, 3.8, 144)).toBeGreaterThan(projectMutualAid(10000, 36, 0, 144))
  })

  it('공제회 분할급여(mutual-aid): 기간 지정형, 전용 층(mutualAid)으로 분리', () => {
    const r = simulateRetirement(DEFAULT_RETIREMENT, RULES, [
      src({ kind: 'mutual-aid', monthlyAmount: 50, startAge: 63, endAge: 72, inflationLinked: false }),
    ])
    expect(r.rows[0].mutualAid).toBe(50)
    expect(r.rows[0].extra).toBe(0) // 일반 추가 층과 분리 (차트 별도 색)
    expect(r.rows.find((x) => x.age === 72)!.mutualAid).toBe(50)
    expect(r.rows.find((x) => x.age === 73)!.mutualAid).toBe(0) // 기간 종료
  })
})

describe('수령기 시뮬 M4 확장', () => {
  it('임대소득 추가 시 예비 풀 수명 연장', () => {
    const base = simulateRetirement(DEFAULT_RETIREMENT, RULES)
    const withRent = simulateRetirement(DEFAULT_RETIREMENT, RULES, [
      src({ kind: 'rent-housing', monthlyAmount: 100, startAge: 63 }),
    ])
    expect(withRent.rows[0].extra).toBeCloseTo(100 * (1 - 0.5 * 0.154), 5)
    expect(withRent.poolOutAge ?? 99).toBeGreaterThan(base.poolOutAge ?? 0)
  })

  it('소액 재취업(월 200만)은 소득월액이 문턱 아래 → 지급정지 0', () => {
    const r = simulateRetirement(DEFAULT_RETIREMENT, RULES, [
      src({ kind: 'work', monthlyAmount: 200, startAge: 65, endAge: 70 }),
    ])
    const row65 = r.rows.find((x) => x.age === 65)!
    expect(row65.suspended).toBe(0)
    expect(r.suspendedTotal).toBe(0)
  })

  it('고액 재취업(월 500만, 명목 고정)의 감액: 현재가치로 판정 후 명목 복원 (문턱 물가연동 가정)', () => {
    const r = simulateRetirement(DEFAULT_RETIREMENT, RULES, [
      src({ kind: 'work', monthlyAmount: 500, startAge: 65, endAge: 70 }),
    ])
    const row65 = r.rows.find((x) => x.age === 65)!
    // 기대값을 동일 공식으로 재현: toToday = f(65) × 오늘→은퇴년 배율
    const f = 1.025 ** 2
    const toToday = f * DEFAULT_RETIREMENT.inflFactorToRetire!
    const pubNominal = 257 * f
    const incomeTodayMonthly = earnedIncomeAfterDeduction(((500 / toToday) * 10000 * 12), RULES) / 12
    const expected = (suspendedPension((pubNominal / toToday) * 10000, incomeTodayMonthly, RULES.pensionSuspension) / 10000) * toToday
    expect(row65.suspended).toBeCloseTo(expected, 5)
    expect(row65.pub).toBeCloseTo(pubNominal - expected, 5)
    // 월 500만(명목)의 현재가치는 354만, 근로소득공제 후 257만 < 문턱 280만 → 감액 없음
    // (명목 그대로 판정하던 이전 방식은 41.9만 과대 감액 — 이 개선 자체가 검증 대상)
    expect(expected).toBe(0)

    // 월 700만이면 공제 후 현재가치가 문턱을 넘어 감액 발생 — 공식 재현값과 일치
    const r7 = simulateRetirement(DEFAULT_RETIREMENT, RULES, [
      src({ kind: 'work', monthlyAmount: 700, startAge: 65, endAge: 70 }),
    ])
    const row65b = r7.rows.find((x) => x.age === 65)!
    const income7 = earnedIncomeAfterDeduction(((700 / toToday) * 10000 * 12), RULES) / 12
    const expected7 = (suspendedPension((pubNominal / toToday) * 10000, income7, RULES.pensionSuspension) / 10000) * toToday
    expect(expected7).toBeGreaterThan(0)
    expect(row65b.suspended).toBeCloseTo(expected7, 5)
    // 66세 이후엔 명목 고정 급여의 실질가치가 줄어 감액도 감소
    const row66 = r7.rows.find((x) => x.age === 66)!
    expect(row66.suspended).toBeLessThanOrEqual(row65b.suspended)
  })

  it('실질가치 변환: 물가연동 항목은 평평, 명목 고정 항목은 침식', () => {
    const nominal = simulateRetirement(DEFAULT_RETIREMENT, RULES)
    const real = deflateResult(nominal, DEFAULT_RETIREMENT)
    const r63 = real.rows[0]
    const r80 = real.rows.find((x) => x.age === 80)!
    // 목표·공적(물가연동)은 실질 일정
    expect(r80.tgt).toBeCloseTo(r63.tgt, 5)
    expect(r80.tgt).toBeCloseTo(DEFAULT_RETIREMENT.targetMonthly, 5)
    const r65 = real.rows.find((x) => x.age === 65)!
    expect(r80.pub).toBeCloseTo(r65.pub, 5)
    // 주택연금(명목 고정)은 실질 침식
    expect(r80.hpm).toBeLessThan(r63.hpm * 0.7)
    // 시작 연도는 변환 전후 동일 (f=1)
    expect(r63.tgt).toBeCloseTo(nominal.rows[0].tgt, 10)
  })

  it('주택연금 O/X 비교: X면 예비 풀이 먼저 고갈', () => {
    const { on, off } = compareHousingPension(DEFAULT_RETIREMENT, RULES)
    expect(off.poolOutAge ?? 99).toBeLessThan(on.poolOutAge ?? 99)
    expect(on.rows[0].hpm).toBe(168)
    expect(off.rows[0].hpm).toBe(0)
  })
})
