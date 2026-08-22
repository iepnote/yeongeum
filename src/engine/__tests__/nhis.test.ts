import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import fixture from '../nhis/fixtures/nhis_검증케이스_v1.json'
import type { Rules } from '../types'
import { dependentCheck, employeePremium, regionalPremium, voluntaryPremium } from '../nhis'

const RULES = rulesJson as unknown as Rules
const N = RULES.nhis

interface FixtureCase {
  id: string
  name: string
  input: { type: string } & Record<string, unknown>
  expected: Record<string, unknown>
}

function runCase(c: FixtureCase): Record<string, unknown> {
  const input = c.input as unknown
  switch (c.input.type) {
    case 'regional':
      return regionalPremium(input as Parameters<typeof regionalPremium>[0], N) as unknown as Record<string, unknown>
    case 'employee':
      return employeePremium(input as Parameters<typeof employeePremium>[0], N) as unknown as Record<string, unknown>
    case 'voluntary':
      return voluntaryPremium(Number(c.input.avgSalaryLast12m), N) as unknown as Record<string, unknown>
    case 'dependentCheck':
      return dependentCheck(input as Parameters<typeof dependentCheck>[0], N) as unknown as Record<string, unknown>
    default:
      throw new Error(`unknown case type: ${c.input.type}`)
  }
}

// 산문 필드는 비교 대상 아님 (숫자·불리언만 검증)
const PROSE = new Set(['assertAlso', 'note', 'reason', 'sideIncomeReason', 'propertyNote'])

describe('nhis — 검증케이스 C1~C6 (M2 완료 기준)', () => {
  for (const c of fixture.cases as unknown as FixtureCase[]) {
    it(`${c.id}: ${c.name}`, () => {
      const out = runCase(c)
      for (const [k, v] of Object.entries(c.expected)) {
        if (PROSE.has(k)) continue
        expect(out[k], `${c.id}.${k}`).toBe(v)
      }
    })
  }
})

describe('nhis — 룰 파라미터 역산 불변식 (등급표 교체와 무관)', () => {
  it('지역 소득분: 공적연금 3,081만 × 50% × 7.19% ÷ 12 = 92,302원', () => {
    const r = regionalPremium({ publicPensionAnnual: 30_810_000 }, N)
    expect(r.recognizedIncomeAnnual).toBe(15_405_000)
    expect(r.incomePremiumMonthly).toBe(92_302)
  })

  it('사적연금·주택연금은 지역 부과에 0원 기여 (C6 구조 확인)', () => {
    const base = regionalPremium({ publicPensionAnnual: 30_810_000, propertyTaxBase: 360_000_000 }, N)
    const withPrivate = regionalPremium(
      { publicPensionAnnual: 30_810_000, privatePensionAnnual: 30_000_000, housingPensionAnnual: 20_160_000, propertyTaxBase: 360_000_000 },
      N,
    )
    expect(withPrivate.totalMonthly).toBe(base.totalMonthly)
  })

  it('금융소득 절벽: 문턱 1,000만 — 990만은 0원, 1,010만은 전액 반영 → 연 +80만 이상 (F-9 경고 조건)', () => {
    const under = regionalPremium({ publicPensionAnnual: 30_810_000, financialIncomeAnnual: 9_900_000, propertyTaxBase: 360_000_000 }, N)
    const over = regionalPremium({ publicPensionAnnual: 30_810_000, financialIncomeAnnual: 10_100_000, propertyTaxBase: 360_000_000 }, N)
    expect(under.financialIncomeCounted).toBe(0)
    expect(over.financialIncomeCounted).toBe(10_100_000)
    expect((over.totalMonthly - under.totalMonthly) * 12).toBeGreaterThan(800_000)
  })

  it('직장가입자: 재산 미부과, 보수 100만 → 총 40,674원', () => {
    const e = employeePremium({ monthlySalary: 1_000_000, publicPensionAnnual: 30_810_000, propertyTaxBase: 360_000_000 }, N)
    expect(e.propertyPremiumMonthly).toBe(0)
    expect(e.payrollHealthMonthly).toBe(35_950)
    expect(e.totalMonthly).toBe(40_674)
    // 같은 사람이 지역가입자면 재산분이 붙어 더 비싸다 (C2 assertAlso의 구조)
    const r = regionalPremium({ publicPensionAnnual: 30_810_000, propertyTaxBase: 360_000_000 }, N)
    expect(r.totalMonthly).toBeGreaterThan(e.totalMonthly)
  })

  it('직장 소득월액: 보수외소득 문턱 초과분에만 부과', () => {
    const e = employeePremium({ monthlySalary: 1_000_000, publicPensionAnnual: 30_810_000, otherSideIncomeAnnual: 10_000_000 }, N)
    expect(e.sideIncomeRecognized).toBe(25_405_000)
    expect(e.sideIncomePremiumMonthly).toBe(Math.round((5_405_000 * N.healthRate) / 12))
  })

  it('임의계속: 평균 보수 550만 기준 223,706원 — 지역(C1)보다 유리 (배지 조건)', () => {
    const v = voluntaryPremium(5_500_000, N)
    expect(v.totalMonthly).toBe(223_706)
    const r = regionalPremium({ publicPensionAnnual: 30_810_000, privatePensionAnnual: 15_000_000, housingPensionAnnual: 20_160_000, propertyTaxBase: 360_000_000 }, N)
    expect(v.totalMonthly).toBeLessThan(r.totalMonthly)
  })

  it('피부양자 판정 100% vs 부과 50% — 같은 연금이 판정에선 탈락, 부과 반영은 절반', () => {
    const d = dependentCheck({ publicPensionAnnual: 24_360_000, privatePensionAnnual: 15_000_000, propertyTaxBase: 360_000_000 }, N)
    expect(d.dependentIncomeCounted).toBe(24_360_000) // 100% 반영
    expect(d.eligible).toBe(false)
    const r = regionalPremium({ publicPensionAnnual: 24_360_000 }, N)
    expect(r.recognizedIncomeAnnual).toBe(12_180_000) // 부과는 50% 반영
  })

  it('피부양자: 소득 충족 시 재산 한도 5.4억 판정', () => {
    expect(dependentCheck({ publicPensionAnnual: 19_000_000, propertyTaxBase: 360_000_000 }, N).eligible).toBe(true)
    expect(dependentCheck({ publicPensionAnnual: 19_000_000, propertyTaxBase: 600_000_000 }, N).eligible).toBe(false)
  })
})

describe('nhis — 픽스처 룰과 앱 룰 동기화', () => {
  it('rules-2026.json nhis 파라미터가 픽스처 rules_2026과 일치', () => {
    const f = fixture.rules_2026 as unknown as Record<string, never>
    expect(N.healthRate).toBe(f['healthRate'])
    expect(N.ltcRateOfHealth).toBe(f['ltcRateOfHealth'])
    const fr = (f['regional'] ?? {}) as Record<string, unknown>
    expect(N.regional.pointValueKRW).toBe(fr['pointValueKRW'])
    expect(N.regional.propertyBasicDeduction).toBe(fr['propertyBasicDeduction'])
    expect(N.regional.financialIncomeThreshold).toBe(fr['financialIncomeThreshold'])
    const fixtureGrades = (fr['propertyGrades'] ?? fr['propertyGrades_sample']) as { maxTaxBase: number | null; points: number }[]
    expect(N.regional.propertyGrades.map((g) => [g.maxTaxBase, g.points])).toEqual(
      fixtureGrades.map((g) => [g.maxTaxBase, g.points]),
    )
  })
})
