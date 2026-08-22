import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Rules } from '../types'
import { privatePensionMonthlyNet, privatePensionTaxRate } from '../tax/pensionTax'

const RULES = rulesJson as Rules

describe('사적연금 저율 분리과세 (rules-2026)', () => {
  it('나이별 세율 구간: 5.5 → 4.4 → 3.3%', () => {
    expect(privatePensionTaxRate(55, RULES)).toBe(0.055)
    expect(privatePensionTaxRate(69, RULES)).toBe(0.055)
    expect(privatePensionTaxRate(70, RULES)).toBe(0.044)
    expect(privatePensionTaxRate(79, RULES)).toBe(0.044)
    expect(privatePensionTaxRate(80, RULES)).toBe(0.033)
  })

  it('PRD F-6 검증값: 사적 1,500만 세후 월 118/120/121만', () => {
    expect(Math.round(privatePensionMonthlyNet(1500, 65, RULES))).toBe(118)
    expect(Math.round(privatePensionMonthlyNet(1500, 75, RULES))).toBe(120)
    expect(Math.round(privatePensionMonthlyNet(1500, 85, RULES))).toBe(121)
  })
})
