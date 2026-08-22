import type { Rules } from '../types'
import { basicIncomeTax, pensionIncomeDeduction } from './comprehensive'

// 사적연금 저율 분리과세 (한도 이하): 나이별 5.5 → 4.4 → 3.3% (지방소득세 포함)
export function privatePensionTaxRate(age: number, rules: Rules): number {
  for (const b of rules.tax.privatePension.lowRateByAge) if (age >= b.minAge) return b.rate
  return rules.tax.privatePension.lowRateByAge[rules.tax.privatePension.lowRateByAge.length - 1].rate
}

// 한도 이하 연 수령액의 세후 월 수령액 (금액 단위 무관 — 만원 넣으면 만원)
export function privatePensionMonthlyNet(annualGross: number, age: number, rules: Rules): number {
  return (annualGross * (1 - privatePensionTaxRate(age, rules))) / 12
}

export interface PrivatePensionTaxResult {
  mode: 'low' | 'over'
  tax: number // 선택지 중 최소 세액
  lowRateTax?: number // 한도 이하일 때
  separateTax?: number // 한도 초과: 전액 16.5% 분리
  comprehensiveTax?: number // 한도 초과: 전액 종합과세 (근사)
  chosen?: 'separate' | 'comprehensive'
}

// 사적연금 연간 세액 (원 단위 입력 권장).
// 한도 초과 시 전액 분리(16.5%) vs 전액 종합과세를 비교해 유리한 쪽 선택 (F-6).
// 종합 근사: 연금소득공제 적용, otherComprehensiveTaxable(다른 종합소득 과표)이 있으면 한계 증가분으로 계산,
// 없으면 본인 기본공제만 차감. 다른 공제·세액공제는 미반영 — 정보 제공용 근사.
export function privatePensionTax(
  annualGross: number,
  age: number,
  rules: Rules,
  otherComprehensiveTaxable = 0,
): PrivatePensionTaxResult {
  const p = rules.tax.privatePension
  if (annualGross <= p.annualLimit) {
    const tax = annualGross * privatePensionTaxRate(age, rules)
    return { mode: 'low', tax, lowRateTax: tax }
  }
  const separateTax = annualGross * p.overLimitRate
  const surtax = 1 + rules.tax.comprehensive.localSurtax
  const pensionTaxable = annualGross - pensionIncomeDeduction(annualGross, rules)
  const comprehensiveTax =
    otherComprehensiveTaxable > 0
      ? (basicIncomeTax(otherComprehensiveTaxable + pensionTaxable, rules) -
          basicIncomeTax(otherComprehensiveTaxable, rules)) *
        surtax
      : basicIncomeTax(pensionTaxable - rules.tax.comprehensive.basicPersonalDeduction, rules) * surtax
  const chosen = separateTax <= comprehensiveTax ? 'separate' : 'comprehensive'
  return { mode: 'over', tax: Math.min(separateTax, comprehensiveTax), separateTax, comprehensiveTax, chosen }
}

// 수령액 증액 시 증액분 실효세율 — PRD 검증: 1,500→2,000만 (70대, 분리 선택 시) = 52.8% ≈ 53%
export function effectiveRateOnIncrease(
  fromAnnual: number,
  toAnnual: number,
  age: number,
  rules: Rules,
  mode: 'separate' | 'best' = 'separate',
): number {
  const taxOf = (g: number) => {
    const r = privatePensionTax(g, age, rules)
    return mode === 'separate' && r.mode === 'over' ? r.separateTax! : r.tax
  }
  return (taxOf(toAnnual) - taxOf(fromAnnual)) / (toAnnual - fromAnnual)
}
