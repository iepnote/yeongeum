// 교사(교육공무원) 프리셋 엔진 (F-2.2, M3)
// 연금 공식: 연금월액 = 평균기준소득월액 × 재직연수 × 지급률(1.7%/년)
// 평균기준소득월액의 재평가(보수인상률 현가화)는 "과거·미래 호봉을 현재 봉급표로 평가"로 근사 —
// 재평가율 ≈ 봉급 인상률 가정. 잔여 오차는 공단 조회값 보정(calibration)이 흡수한다.

import type { TeacherPensionRules } from '../types'

export interface SalaryTable {
  year: number
  grades: { grade: number; monthly: number }[] // 호봉별 월 본봉(원)
}

export interface TeacherInput {
  appointedDate: string // 임용일 ISO
  retireDate: string // 퇴직예정일 ISO
  currentGrade: number // 현재 호봉
  asOfDate: string // 현재 호봉 기준 시점
  allowanceFactor: number // 수당계수 (기본 1.35) — 기준소득월액 ≈ 본봉 × 계수
  monthlyContribution?: number // 일반기여금(원/월) — 입력 시 수당계수 역산 보정
  openAgeChosen?: number // 연금 개시 나이 — 법정 개시연령보다 이르면 조기퇴직연금 감액(연 5%, 최대 5년). 연기 제도 없음
  pensionCalibration?: {
    // basis: 공단 조회값이 어느 시점 기준인지 — 공제회와 동일한 이중 반영 함정 방지
    // 'current' = 현재까지 재직기간 기준 (재직월수로 역산 후 미래 구간 모델 혼합)
    // 'at-retirement' = 퇴직예정일까지 재직 가정한 공단 추정 (그대로 사용, 재계산 없음)
    basis?: 'current' | 'at-retirement'
    // at-retirement일 때 금액의 화폐 기준: 'today' = 현재가치(공단 기본 조회 — 보수·물가 인상 미반영,
    // 반영 버튼이 물가 환산) / 'nominal' = 개시년 명목(공단 시뮬레이션에 임금인상률 적용된 값 —
    // 반영 시 환산 생략, 이중 인상 방지)
    valueBasis?: 'today' | 'nominal'
    queriedAt: string // 공단 조회일
    serviceMonths: number // 조회 시점 재직월수 (basis='current'일 때만 사용)
    monthlyPension: number // 조회된 예상 연금월액(원)
  }
}

export interface TeacherEstimate {
  serviceYears: number // 임용~퇴직 (년, 소수)
  countedYears: number // 산입 상한 적용 후
  allowanceFactorUsed: number
  calibratedByContribution: boolean
  currentBaseSalary: number // 현재 호봉 본봉
  currentIncomeMonthly: number // 현재 기준소득월액 추정
  contributionMonthly: number // 기여금(9%) — 명세서 대조용
  avgIncomeMonthly: number // 평균기준소득월액 (현재가치)
  calibratedByQuery: boolean
  pensionMonthly: number // 예상 연금월액 (현재가치, 조기 감액 반영)
  openAge: number // 적용된 수급 개시연령 (선택값)
  statutoryOpenAge: number // 법정 개시연령
  earlyReductionPct: number // 조기 수령 감액률 % (0 = 감액 없음)
}

// 날짜는 UTC 기준 (년×12+월) 정수 인덱스로만 다룬다 — 로컬 타임존 섞임 방지
const ymIndex = (iso: string) => {
  const d = new Date(iso)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}
const yearOf = (iso: string) => new Date(iso).getUTCFullYear()

export function monthsBetween(fromIso: string, toIso: string): number {
  return ymIndex(toIso) - ymIndex(fromIso)
}

export function baseSalaryOf(grade: number, table: SalaryTable): number {
  const g = Math.min(Math.max(Math.round(grade), table.grades[0].grade), table.grades[table.grades.length - 1].grade)
  const row = table.grades.find((r) => r.grade === g)
  if (!row) throw new Error(`호봉 ${g} 없음 (봉급표 ${table.year})`)
  return row.monthly
}

export function openAgeOf(retireYear: number, rules: TeacherPensionRules): number {
  for (const r of rules.openAgeByRetireYear) if (retireYear >= r.retireYearFrom) return r.age
  return rules.openAgeByRetireYear[rules.openAgeByRetireYear.length - 1].age
}

// 특정 연도의 호봉 (매년 1호봉 승급, 연 단위 근사)
export function gradeAtYear(input: TeacherInput, year: number): number {
  return input.currentGrade + (year - yearOf(input.asOfDate))
}

// 재직 구간 [fromIso, toIso)의 기준소득월액 평균 (현재 봉급표 기준, 월수 가중)
function avgIncomeOver(input: TeacherInput, table: SalaryTable, factor: number, fromIso: string, toIso: string): number {
  const start = ymIndex(fromIso)
  const end = ymIndex(toIso)
  if (end <= start) return 0
  let sum = 0
  let m = start
  while (m < end) {
    const year = Math.floor(m / 12)
    const segEnd = Math.min((year + 1) * 12, end) // 연 경계 또는 구간 끝
    sum += baseSalaryOf(gradeAtYear(input, year), table) * factor * (segEnd - m)
    m = segEnd
  }
  return sum / (end - start)
}

export function estimateTeacherPension(
  input: TeacherInput,
  table: SalaryTable,
  rules: TeacherPensionRules,
): TeacherEstimate {
  const currentBaseSalary = baseSalaryOf(input.currentGrade, table)
  const calibratedByContribution = (input.monthlyContribution ?? 0) > 0
  const allowanceFactorUsed = calibratedByContribution
    ? input.monthlyContribution! / rules.contributionRate / currentBaseSalary
    : input.allowanceFactor
  const currentIncomeMonthly = currentBaseSalary * allowanceFactorUsed
  const contributionMonthly = currentIncomeMonthly * rules.contributionRate

  const totalMonths = monthsBetween(input.appointedDate, input.retireDate)
  const serviceYears = totalMonths / 12
  const countedYears = Math.min(serviceYears, rules.serviceYearsCap)
  const countedMonths = countedYears * 12

  // 개시연령: 법정(퇴직연도별) 기준, 조기 선택 시 연 5% 감액 (최대 5년·25%). 연기 제도는 없음
  const statutoryOpenAge = openAgeOf(yearOf(input.retireDate), rules)
  const chosenOpenAge = Math.min(Math.max(input.openAgeChosen ?? statutoryOpenAge, statutoryOpenAge - 5), statutoryOpenAge)
  const earlyReduction = 0.05 * (statutoryOpenAge - chosenOpenAge)

  let avgIncomeMonthly: number
  let calibratedByQuery = false
  const cal = input.pensionCalibration
  if (cal && cal.monthlyPension > 0 && cal.basis === 'at-retirement') {
    // 공단이 퇴직 시점까지 재직을 가정해 추정한 값 — 우리 모델보다 정확하므로 그대로 사용
    calibratedByQuery = true
    avgIncomeMonthly = cal.monthlyPension / (countedYears * rules.accrualRatePerYear)
  } else if (cal && cal.monthlyPension > 0 && cal.serviceMonths > 0) {
    calibratedByQuery = true
    // 조회값 역산: 과거 구간의 실측 평균기준소득월액
    const impliedPastAvg = cal.monthlyPension / ((cal.serviceMonths / 12) * rules.accrualRatePerYear)
    const pastMonths = Math.min(cal.serviceMonths, countedMonths)
    const futureMonths = Math.max(countedMonths - pastMonths, 0)
    const modelFutureAvg = avgIncomeOver(input, table, allowanceFactorUsed, cal.queriedAt, input.retireDate)
    avgIncomeMonthly = (impliedPastAvg * pastMonths + modelFutureAvg * futureMonths) / countedMonths
  } else {
    avgIncomeMonthly = avgIncomeOver(input, table, allowanceFactorUsed, input.appointedDate, input.retireDate)
  }

  return {
    serviceYears,
    countedYears,
    allowanceFactorUsed,
    calibratedByContribution,
    currentBaseSalary,
    currentIncomeMonthly,
    contributionMonthly,
    avgIncomeMonthly,
    calibratedByQuery,
    pensionMonthly: avgIncomeMonthly * countedYears * rules.accrualRatePerYear * (1 - earlyReduction),
    openAge: chosenOpenAge,
    statutoryOpenAge,
    earlyReductionPct: earlyReduction * 100,
  }
}
