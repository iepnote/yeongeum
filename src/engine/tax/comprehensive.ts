import type { MarginalBracket, Rules } from '../types'

// 한계 구간 누적 계산 — 종합소득세 산출세액과 연금소득공제가 같은 형태의 표를 공유
export function marginalAccum(amount: number, brackets: MarginalBracket[]): number {
  let acc = 0
  let prev = 0
  for (const b of brackets) {
    if (amount <= prev) break
    const upper = b.upTo === null ? amount : Math.min(amount, b.upTo)
    acc += (upper - prev) * b.rate
    prev = b.upTo ?? amount
  }
  return acc
}

// 종합소득세 기본세율 산출세액 (지방소득세 미포함, 과표 기준)
export function basicIncomeTax(taxable: number, rules: Rules): number {
  return marginalAccum(Math.max(taxable, 0), rules.tax.comprehensive.brackets)
}

// 연금소득공제 (총연금액 기준, 한도 900만)
export function pensionIncomeDeduction(pensionAnnual: number, rules: Rules): number {
  const d = rules.tax.pensionIncomeDeduction
  return Math.min(marginalAccum(Math.max(pensionAnnual, 0), d.brackets), d.cap)
}

// 근로소득금액 = 총급여 − 근로소득공제 (지급정지 소득월액 산정용)
export function earnedIncomeAfterDeduction(annualGross: number, rules: Rules): number {
  const g = Math.max(annualGross, 0)
  return g - marginalAccum(g, rules.tax.workIncomeDeduction.brackets)
}
