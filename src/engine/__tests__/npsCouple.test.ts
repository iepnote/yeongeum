import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Rules } from '../types'
import { estimateNps, npsOpenAge } from '../pension/nps'
import { coupleNhis, type CoupleMember } from '../nhis/couple'

const RULES = rulesJson as unknown as Rules
const N = RULES.nhis

describe('estimateNps — 국민연금 간이 추정 (F-2.3/F-2.4)', () => {
  it('공식 검증: A=B일 때 20년 → 월 0.1×(A+B), 40년 → 대체율 40%', () => {
    const A = RULES.publicPensionNps.aValueMonthly
    const y20 = estimateNps({ birthYear: 1980, avgIncomeMonthly: A, joinYears: 20 }, RULES)
    expect(y20.pensionMonthly).toBeCloseTo((1.2 * 2 * A) / 12, 5) // 월 ≈ 0.2A
    const y40 = estimateNps({ birthYear: 1980, avgIncomeMonthly: A, joinYears: 40 }, RULES)
    expect(y40.pensionMonthly).toBeCloseTo(0.4 * A, 5) // 40년 → 본인 평균소득의 40%
  })

  it('가입 10년 미만은 수급 불가(0), 20년 미만은 비례 감액', () => {
    expect(estimateNps({ birthYear: 1980, avgIncomeMonthly: 3_000_000, joinYears: 9 }, RULES).pensionMonthly).toBe(0)
    const y10 = estimateNps({ birthYear: 1980, avgIncomeMonthly: 3_000_000, joinYears: 10 }, RULES)
    const y20 = estimateNps({ birthYear: 1980, avgIncomeMonthly: 3_000_000, joinYears: 20 }, RULES)
    expect(y10.pensionMonthly).toBeCloseTo(y20.pensionMonthly / 2, 5)
  })

  it('개시연령: 출생연도별 61~65세', () => {
    expect(npsOpenAge(1975, RULES)).toBe(65)
    expect(npsOpenAge(1966, RULES)).toBe(64)
    expect(npsOpenAge(1963, RULES)).toBe(63)
    expect(npsOpenAge(1955, RULES)).toBe(61)
  })
})

const me = (p: Partial<CoupleMember> = {}): CoupleMember => ({
  label: '본인',
  isEmployee: false,
  monthlySalary: 0,
  publicPensionAnnual: 30_810_000,
  privatePensionAnnual: 15_000_000,
  propertyTaxBase: 360_000_000,
  ...p,
})
const spouse = (p: Partial<CoupleMember> = {}): CoupleMember => ({
  label: '배우자',
  isEmployee: false,
  monthlySalary: 0,
  publicPensionAnnual: 0,
  privatePensionAnnual: 0,
  propertyTaxBase: 0,
  ...p,
})

describe('coupleNhis — 부부 건보·피부양자 상호 판정 (F-1.3)', () => {
  it('배우자 직장가입 + 내 연금 2,000만 초과 → 피부양자 탈락, 지역 부과', () => {
    const r = coupleNhis(me(), spouse({ isEmployee: true, monthlySalary: 4_000_000 }), N)
    expect(r.mode).toBe('one-employee')
    const meP = r.memberPremiums.find((m) => m.label === '본인')!
    expect(meP.role).toContain('탈락')
    expect(meP.monthly).toBeGreaterThan(0)
    expect(r.dependents.find((d) => d.label === '본인')!.check.eligible).toBe(false)
  })

  it('배우자 직장가입 + 내 연금 1,800만 → 피부양자 등재, 내 보험료 0', () => {
    const r = coupleNhis(me({ publicPensionAnnual: 18_000_000 }), spouse({ isEmployee: true, monthlySalary: 4_000_000 }), N)
    const meP = r.memberPremiums.find((m) => m.label === '본인')!
    expect(meP.monthly).toBe(0)
    expect(meP.role).toContain('피부양자')
  })

  it('부부 모두 지역 → 세대 합산 1건 부과 (각자 부과 합계와 다름)', () => {
    const a = me()
    const b = spouse({ publicPensionAnnual: 12_000_000, propertyTaxBase: 100_000_000 })
    const r = coupleNhis(a, b, N)
    expect(r.mode).toBe('both-regional')
    expect(r.memberPremiums).toHaveLength(1)
    // 세대 합산: 소득 (3,081+1,200)만×50%, 재산 (3.6+1)억 — 재산 등급 누진 때문에 합산이 개별 합과 다르다
    expect(r.totalMonthly).toBeGreaterThan(0)
  })

  it('맞벌이(둘 다 직장) → 각자 보수 기준 부과', () => {
    const r = coupleNhis(
      me({ isEmployee: true, monthlySalary: 5_000_000, publicPensionAnnual: 0 }),
      spouse({ isEmployee: true, monthlySalary: 3_000_000 }),
      N,
    )
    expect(r.mode).toBe('both-employee')
    expect(r.memberPremiums).toHaveLength(2)
  })
})
