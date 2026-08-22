import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Rules } from '../types'
import { basicIncomeTax, pensionIncomeDeduction } from '../tax/comprehensive'
import { effectiveRateOnIncrease, privatePensionTax } from '../tax/pensionTax'
import { financialIncomeTax } from '../tax/financialTax'

const RULES = rulesJson as unknown as Rules

describe('tax — 종합소득세·연금소득공제 헬퍼', () => {
  it('기본세율 산출세액 (지방 미포함)', () => {
    expect(basicIncomeTax(14_000_000, RULES)).toBe(840_000)
    expect(basicIncomeTax(50_000_000, RULES)).toBe(6_240_000)
    expect(basicIncomeTax(60_000_000, RULES)).toBe(8_640_000)
  })

  it('연금소득공제: 350만 전액 → 40/20/10% 체감, 한도 900만', () => {
    expect(pensionIncomeDeduction(3_000_000, RULES)).toBe(3_000_000)
    expect(pensionIncomeDeduction(20_000_000, RULES)).toBe(6_900_000)
    expect(pensionIncomeDeduction(50_000_000, RULES)).toBe(9_000_000) // cap
  })
})

describe('tax — 사적연금 한도 초과 (F-6)', () => {
  it('한도 이하: 저율 분리 (1,500만 × 5.5% = 82.5만)', () => {
    const r = privatePensionTax(15_000_000, 65, RULES)
    expect(r.mode).toBe('low')
    expect(r.tax).toBe(825_000)
  })

  it('PRD 검증값: 1,500→2,000만 증액 시 증액분 실효 53% (70대, 분리 기준)', () => {
    const rate = effectiveRateOnIncrease(15_000_000, 20_000_000, 75, RULES, 'separate')
    expect(rate).toBeCloseTo(0.528, 5) // (330만 - 66만) / 500만
    expect(Math.round(rate * 100)).toBe(53)
  })

  it('한도 초과 시 16.5% vs 종합 비교 — 연금소득만 있으면 종합이 유리', () => {
    const r = privatePensionTax(20_000_000, 75, RULES)
    expect(r.mode).toBe('over')
    expect(r.separateTax).toBe(3_300_000)
    // 종합: 2,000만 - 공제 690만 - 기본공제 150만 = 과표 1,160만 → 6% × 1.1 = 765,600
    expect(r.comprehensiveTax).toBeCloseTo(765_600, 0)
    expect(r.chosen).toBe('comprehensive')
    expect(r.tax).toBeCloseTo(765_600, 0)
  })

  it('다른 종합소득 과표 1억이면 분리 16.5%가 유리', () => {
    const r = privatePensionTax(20_000_000, 75, RULES, 100_000_000)
    // 종합 증가분: (basicTax(1.131억) - basicTax(1억)) × 1.1 = 458.5만 × 1.1 = 504.35만 > 330만
    expect(r.comprehensiveTax).toBeCloseTo(5_043_500, 0)
    expect(r.chosen).toBe('separate')
    expect(r.tax).toBe(3_300_000)
  })
})

describe('tax — 금융소득 2,000만 비교과세 (F-6)', () => {
  it('문턱 이하: 원천 15.4% 고정', () => {
    const r = financialIncomeTax(10_000_000, 0, RULES)
    expect(r.comprehensiveApplied).toBe(false)
    expect(r.tax).toBeCloseTo(1_540_000, 0)
    expect(financialIncomeTax(20_000_000, 0, RULES).tax).toBeCloseTo(3_080_000, 0)
  })

  it('문턱 살짝 초과 + 다른 소득 없음: 비교과세 하한(원천세) 유지 — 절벽 없음', () => {
    const r = financialIncomeTax(21_000_000, 0, RULES)
    expect(r.comprehensiveApplied).toBe(true)
    // max(기본세율(100만)+2,000만×14%, 2,100만×14%) = max(286만, 294만) = 294만 × 1.1
    expect(r.tax).toBeCloseTo(3_234_000, 0)
    expect(r.effectiveRate).toBeCloseTo(0.154, 5)
  })

  it('다른 과표 5,000만 + 금융소득 3,000만: 초과분 누진 적용', () => {
    const r = financialIncomeTax(30_000_000, 50_000_000, RULES)
    // max(basicTax(6,000만)+280만, basicTax(5,000만)+420만) - basicTax(5,000만) = (1,144만-624만) = 520만 × 1.1
    expect(r.tax).toBeCloseTo(5_720_000, 0)
    expect(r.comprehensiveApplied).toBe(true)
  })
})
