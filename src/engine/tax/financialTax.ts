import type { Rules } from '../types'
import { basicIncomeTax } from './comprehensive'

export interface FinancialTaxResult {
  comprehensiveApplied: boolean // 2,000만 초과 여부
  tax: number // 지방소득세 포함 총 세액
  effectiveRate: number
}

// 금융소득(이자·배당) 세액 — 2,000만 이하 원천 분리(14%+지방), 초과 시 비교과세:
// max( 기본세율(다른과표+초과분) + 문턱×14%, 기본세율(다른과표) + 전액×14% ) × 1.1
export function financialIncomeTax(financialAnnual: number, otherTaxable: number, rules: Rules): FinancialTaxResult {
  const f = rules.tax.financialIncome
  const surtax = 1 + rules.tax.comprehensive.localSurtax
  const w = f.withholdingRate
  let gross: number
  let comprehensiveApplied = false
  if (financialAnnual <= f.comprehensiveThreshold) {
    gross = financialAnnual * w
  } else {
    comprehensiveApplied = true
    const excess = financialAnnual - f.comprehensiveThreshold
    const totalTax = Math.max(
      basicIncomeTax(otherTaxable + excess, rules) + f.comprehensiveThreshold * w,
      basicIncomeTax(otherTaxable, rules) + financialAnnual * w,
    )
    gross = totalTax - basicIncomeTax(otherTaxable, rules) // 금융소득 몫만 반환
  }
  const tax = gross * surtax
  return { comprehensiveApplied, tax, effectiveRate: financialAnnual > 0 ? tax / financialAnnual : 0 }
}
