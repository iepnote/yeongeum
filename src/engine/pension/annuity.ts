// 공제회 분할급여금 등 원리금 균등 분할 수령액 계산 (월 단위 annuity)
// 잔액에 급여율(연 복리)이 붙으며 기간 동안 균등 지급: M = P·i / (1 − (1+i)^−n), i = 연율/12
// 단위 무관 — 만원을 넣으면 만원. 급여율 0이면 단순 균등 분할
export function annuityMonthly(principal: number, annualRatePct: number, years: number): number {
  const n = Math.max(Math.round(years * 12), 1)
  if (principal <= 0) return 0
  if (annualRatePct === 0) return principal / n
  const i = annualRatePct / 100 / 12
  return (principal * i) / (1 - Math.pow(1 + i, -n))
}
