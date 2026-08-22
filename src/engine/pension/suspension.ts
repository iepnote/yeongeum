import type { PensionSuspensionRules } from '../types'
import { marginalAccum } from '../tax/comprehensive'

// 공무원연금 지급정지(소득심사, 법 제50조③): 근로·사업 소득월액이 전년도 평균연금월액을
// 초과하면 초과소득월액에 구간별 누진 정지율 적용, 상한은 연금월액 × maxRatio(1/2). 단위: 원/월
export function suspendedPension(pensionMonthly: number, incomeMonthly: number, rules: PensionSuspensionRules): number {
  const excess = Math.max(incomeMonthly - rules.avgPensionMonthly, 0)
  if (excess <= 0 || pensionMonthly <= 0) return 0
  return Math.min(marginalAccum(excess, rules.brackets), pensionMonthly * rules.maxRatio)
}
