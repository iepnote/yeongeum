import type { NhisRules } from '../types'

// 건강보험료 엔진 (F-7, M2) — nhis_검증케이스_v1.json C1~C6이 완료 기준.
// 모든 월 금액은 원 단위 반올림. 합계는 반올림된 구성요소의 합(고지서 방식).
const r0 = Math.round

/* ── 지역가입자 ── */
export interface RegionalInput {
  publicPensionAnnual?: number
  workIncomeAnnual?: number
  privatePensionAnnual?: number // 현행 규칙상 미반영 (rules로 제어)
  housingPensionAnnual?: number // 현행 규칙상 미반영
  financialIncomeAnnual?: number // 문턱 초과 시 전액 반영 (절벽)
  propertyTaxBase?: number // 재산세 과세표준 (원)
}

export interface RegionalResult {
  recognizedIncomeAnnual: number
  financialIncomeCounted: number
  incomePremiumMonthly: number
  propertyAfterDeduction: number
  propertyPoints: number
  propertyPremiumMonthly: number
  healthMonthly: number
  ltcMonthly: number
  totalMonthly: number
}

export function countedFinancialIncome(financialAnnual: number, n: NhisRules): number {
  return financialAnnual > n.regional.financialIncomeThreshold ? financialAnnual : 0
}

export function recognizedRegionalIncome(inp: RegionalInput, n: NhisRules): number {
  const rg = n.regional
  let income =
    (inp.publicPensionAnnual ?? 0) * rg.pensionIncomeRatio + (inp.workIncomeAnnual ?? 0) * rg.workIncomeRatio
  if (rg.privatePensionIncluded) income += inp.privatePensionAnnual ?? 0
  if (rg.housingPensionIncluded) income += inp.housingPensionAnnual ?? 0
  income += countedFinancialIncome(inp.financialIncomeAnnual ?? 0, n)
  return income
}

// 재산분: 기본공제 후 금액을 등급표에 대입 (공단 방식)
export function propertyPointsOf(propertyTaxBase: number, n: NhisRules): { afterDeduction: number; points: number } {
  const rg = n.regional
  const afterDeduction = Math.max(propertyTaxBase - rg.propertyBasicDeduction, 0)
  if (afterDeduction <= 0) return { afterDeduction, points: 0 }
  for (const g of rg.propertyGrades) {
    if (g.maxTaxBase === null || afterDeduction <= g.maxTaxBase) return { afterDeduction, points: g.points }
  }
  return { afterDeduction, points: rg.propertyGrades[rg.propertyGrades.length - 1].points }
}

export function regionalPremium(inp: RegionalInput, n: NhisRules): RegionalResult {
  const recognizedIncomeAnnual = recognizedRegionalIncome(inp, n)
  const incomePremiumMonthly = r0((recognizedIncomeAnnual * n.healthRate) / 12)
  const { afterDeduction, points } = propertyPointsOf(inp.propertyTaxBase ?? 0, n)
  const propertyPremiumMonthly = r0(points * n.regional.pointValueKRW)
  const healthMonthly = incomePremiumMonthly + propertyPremiumMonthly
  const ltcMonthly = r0(healthMonthly * n.ltcRateOfHealth)
  return {
    recognizedIncomeAnnual,
    financialIncomeCounted: countedFinancialIncome(inp.financialIncomeAnnual ?? 0, n),
    incomePremiumMonthly,
    propertyAfterDeduction: afterDeduction,
    propertyPoints: points,
    propertyPremiumMonthly,
    healthMonthly,
    ltcMonthly,
    totalMonthly: healthMonthly + ltcMonthly,
  }
}

/* ── 직장가입자 ── */
export interface EmployeeInput {
  monthlySalary: number
  publicPensionAnnual?: number
  otherSideIncomeAnnual?: number // 연금 외 보수외소득 (전액 반영)
  propertyTaxBase?: number // 재산 미부과 확인용 — 계산에 미사용
}

export interface EmployeeResult {
  payrollHealthMonthly: number
  payrollLtcMonthly: number
  sideIncomeRecognized: number
  sideIncomePremiumMonthly: number // 문턱 초과분 건강보험료
  sideIncomeLtcMonthly: number
  propertyPremiumMonthly: 0 // 직장가입자는 재산 미부과
  totalMonthly: number
}

export function employeePremium(inp: EmployeeInput, n: NhisRules): EmployeeResult {
  const e = n.employee
  const payrollHealthMonthly = r0(inp.monthlySalary * n.healthRate * e.employeeShare)
  const payrollLtcMonthly = r0(payrollHealthMonthly * n.ltcRateOfHealth)
  const sideIncomeRecognized =
    (inp.publicPensionAnnual ?? 0) * e.sideIncomePensionRatio + (inp.otherSideIncomeAnnual ?? 0)
  const excess = Math.max(sideIncomeRecognized - e.sideIncomeThreshold, 0)
  const sideIncomePremiumMonthly = r0((excess * n.healthRate) / 12) // 소득월액보험료 (본인 전액)
  const sideIncomeLtcMonthly = r0(sideIncomePremiumMonthly * n.ltcRateOfHealth)
  return {
    payrollHealthMonthly,
    payrollLtcMonthly,
    sideIncomeRecognized,
    sideIncomePremiumMonthly,
    sideIncomeLtcMonthly,
    propertyPremiumMonthly: 0,
    totalMonthly: payrollHealthMonthly + payrollLtcMonthly + sideIncomePremiumMonthly + sideIncomeLtcMonthly,
  }
}

/* ── 임의계속가입 (퇴직 후 최대 maxMonths) ── */
export interface VoluntaryResult {
  healthMonthly: number
  ltcMonthly: number
  totalMonthly: number
}

// 기준: 퇴직 전 12개월 평균 보수월액의 본인부담분
export function voluntaryPremium(avgSalaryLast12m: number, n: NhisRules): VoluntaryResult {
  const healthMonthly = r0(avgSalaryLast12m * n.healthRate * n.employee.employeeShare)
  const ltcMonthly = r0(healthMonthly * n.ltcRateOfHealth)
  return { healthMonthly, ltcMonthly, totalMonthly: healthMonthly + ltcMonthly }
}

/* ── 피부양자 판정 — 부과(연금 50%)와 달리 판정은 연금 100% 반영 ── */
export interface DependentInput {
  publicPensionAnnual?: number
  privatePensionAnnual?: number // 판정 소득에 미포함 (현행)
  otherIncomeAnnual?: number
  propertyTaxBase?: number
}

export interface DependentResult {
  dependentIncomeCounted: number
  incomeOk: boolean
  propertyOk: boolean
  eligible: boolean
  reason: string
}

export function dependentCheck(inp: DependentInput, n: NhisRules): DependentResult {
  const d = n.dependent
  const dependentIncomeCounted = (inp.publicPensionAnnual ?? 0) * d.pensionCountRatio + (inp.otherIncomeAnnual ?? 0)
  const incomeOk = dependentIncomeCounted <= d.incomeLimit
  const propertyOk = (inp.propertyTaxBase ?? 0) <= d.propertyLimit
  const eligible = incomeOk && propertyOk
  const won억 = (v: number) => (v / 100000000).toFixed(1)
  const reason = !incomeOk
    ? `소득 ${Math.round(dependentIncomeCounted / 10000).toLocaleString('ko-KR')}만원 > 한도 ${(d.incomeLimit / 10000).toLocaleString('ko-KR')}만원 (연금 ${d.pensionCountRatio * 100}% 반영)`
    : !propertyOk
      ? `재산 과표 ${won억(inp.propertyTaxBase ?? 0)}억 > 한도 ${won억(d.propertyLimit)}억`
      : '소득·재산 요건 충족'
  return { dependentIncomeCounted, incomeOk, propertyOk, eligible, reason }
}
