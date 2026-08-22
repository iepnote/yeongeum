import { describe, expect, it } from 'vitest'
import type { TeacherPensionRules } from '../types'
import { baseSalaryOf, estimateTeacherPension, gradeAtYear, monthsBetween, openAgeOf, type SalaryTable, type TeacherInput } from '../pension/teacher'

// 합성 봉급표: 1호봉 200만, 호봉당 +10만 (실표는 rules/salary-teacher-2026.json — 별도 테스트)
const LINEAR: SalaryTable = {
  year: 2026,
  grades: Array.from({ length: 40 }, (_, i) => ({ grade: i + 1, monthly: 2_000_000 + i * 100_000 })),
}
const FLAT: SalaryTable = {
  year: 2026,
  grades: Array.from({ length: 40 }, (_, i) => ({ grade: i + 1, monthly: 4_000_000 })),
}
const RULES: TeacherPensionRules = {
  accrualRatePerYear: 0.017,
  contributionRate: 0.09,
  serviceYearsCap: 36,
  openAgeByRetireYear: [
    { retireYearFrom: 2033, age: 65 },
    { retireYearFrom: 2030, age: 64 },
    { retireYearFrom: 2027, age: 63 },
    { retireYearFrom: 2024, age: 62 },
    { retireYearFrom: 2022, age: 61 },
    { retireYearFrom: 0, age: 60 },
  ],
}

const base: TeacherInput = {
  appointedDate: '2014-03-01',
  retireDate: '2038-03-01',
  currentGrade: 25,
  asOfDate: '2026-08-01',
  allowanceFactor: 1.35,
}

describe('teacher — 호봉표 엔진 (F-2.2)', () => {
  it('월수 계산·호봉 승급·봉급 조회', () => {
    expect(monthsBetween('2014-03-01', '2038-03-01')).toBe(288) // 24년
    expect(gradeAtYear(base, 2026)).toBe(25)
    expect(gradeAtYear(base, 2014)).toBe(13) // 임용 시점 역산
    expect(gradeAtYear(base, 2037)).toBe(36)
    expect(baseSalaryOf(25, LINEAR)).toBe(4_400_000)
    expect(baseSalaryOf(99, LINEAR)).toBe(LINEAR.grades[39].monthly) // 상한 클램프
  })

  it('현재 기준소득월액 = 본봉 × 수당계수, 기여금 = 9%', () => {
    const e = estimateTeacherPension(base, LINEAR, RULES)
    expect(e.currentBaseSalary).toBe(4_400_000)
    expect(e.currentIncomeMonthly).toBeCloseTo(4_400_000 * 1.35, 5) // 594만
    expect(e.contributionMonthly).toBeCloseTo(5_940_000 * 0.09, 5) // 53.46만
    expect(e.calibratedByContribution).toBe(false)
  })

  it('일반기여금 입력 시 기준소득월액 역산 → 수당계수 보정', () => {
    const e = estimateTeacherPension({ ...base, monthlyContribution: 594_000 }, LINEAR, RULES)
    expect(e.calibratedByContribution).toBe(true)
    expect(e.currentIncomeMonthly).toBeCloseTo(594_000 / 0.09, 5) // 660만
    expect(e.allowanceFactorUsed).toBeCloseTo(6_600_000 / 4_400_000, 10) // 1.5
  })

  it('평균기준소득월액: 2년 재직 손계산 케이스', () => {
    const short: TeacherInput = {
      appointedDate: '2026-01-01',
      retireDate: '2028-01-01',
      currentGrade: 10,
      asOfDate: '2026-01-01',
      allowanceFactor: 1.35,
    }
    const e = estimateTeacherPension(short, LINEAR, RULES)
    // 2026년 12개월 10호봉(290만) + 2027년 12개월 11호봉(300만) → 평균 본봉 295만 × 1.35
    expect(e.avgIncomeMonthly).toBeCloseTo(2_950_000 * 1.35, 5)
    expect(e.serviceYears).toBe(2)
    expect(e.pensionMonthly).toBeCloseTo(2_950_000 * 1.35 * 2 * 0.017, 5) // 135,405
  })

  it('공단 조회값 보정: 과거 실측 + 미래 모델 혼합 (앨리스 형태)', () => {
    const cal: TeacherInput = {
      appointedDate: '2014-02-01',
      retireDate: '2038-08-01',
      currentGrade: 25,
      asOfDate: '2026-08-01',
      allowanceFactor: 1.35,
      pensionCalibration: { queriedAt: '2026-08-01', serviceMonths: 150, monthlyPension: 1_271_000 },
    }
    const e = estimateTeacherPension(cal, FLAT, RULES) // FLAT: 미래 평균 = 400만×1.35 = 540만 확정
    expect(e.calibratedByQuery).toBe(true)
    const impliedPast = 1_271_000 / ((150 / 12) * 0.017) // 5,981,176.47 — 조회 12.5년 역산
    const expectedAvg = (impliedPast * 150 + 5_400_000 * 144) / 294 // 총 294개월(24.5년)
    expect(e.avgIncomeMonthly).toBeCloseTo(expectedAvg, 0)
    expect(e.pensionMonthly).toBeCloseTo(expectedAvg * 24.5 * 0.017, 0)
    // PRD 앨리스 환산(평균 고정 가정 20년 → 203.4만)과 같은 자릿수의 결과인지 sanity
    expect(e.pensionMonthly).toBeGreaterThan(2_000_000)
    expect(e.pensionMonthly).toBeLessThan(3_000_000)
  })

  it('보정(퇴직 시점 기준): 공단 추정을 그대로 사용 — 이중 반영 없음', () => {
    const cal: TeacherInput = {
      ...base,
      pensionCalibration: { basis: 'at-retirement', queriedAt: '2026-08-01', serviceMonths: 0, monthlyPension: 2_330_000 },
    }
    const e = estimateTeacherPension(cal, LINEAR, RULES)
    expect(e.calibratedByQuery).toBe(true)
    expect(e.pensionMonthly).toBe(2_330_000) // 조회값 그대로 (재계산 없음)
    expect(e.avgIncomeMonthly).toBeCloseTo(2_330_000 / (24 * 0.017), 5)
    // 같은 값을 '현재 기준'으로 잘못 해석하면 크게 과대추정된다 (함정 검증)
    const wrong = estimateTeacherPension(
      { ...base, pensionCalibration: { basis: 'current', queriedAt: '2026-08-01', serviceMonths: 150, monthlyPension: 2_330_000 } },
      LINEAR,
      RULES,
    )
    expect(wrong.pensionMonthly).toBeGreaterThan(e.pensionMonthly * 1.5)
  })

  it('개시연령표와 산입 상한', () => {
    expect(openAgeOf(2038, RULES)).toBe(65)
    expect(openAgeOf(2028, RULES)).toBe(63)
    expect(openAgeOf(2020, RULES)).toBe(60)
    const long = estimateTeacherPension({ ...base, appointedDate: '1998-03-01' }, LINEAR, RULES)
    expect(long.serviceYears).toBe(40)
    expect(long.countedYears).toBe(36) // 상한
  })
  it('연금 개시 나이 조기 선택: 연 5% 감액, 법정-5년 하한(최대 25%)', () => {
    const normal = estimateTeacherPension(base, LINEAR, RULES)
    expect(normal.openAge).toBe(normal.statutoryOpenAge)
    expect(normal.earlyReductionPct).toBe(0)
    const early2 = estimateTeacherPension({ ...base, openAgeChosen: normal.statutoryOpenAge - 2 }, LINEAR, RULES)
    expect(early2.earlyReductionPct).toBe(10)
    expect(early2.pensionMonthly).toBeCloseTo(normal.pensionMonthly * 0.9, 5)
    // 법정-5년 아래로는 클램프 (법 §43② — 미달연수 최대 5년)
    const tooEarly = estimateTeacherPension({ ...base, openAgeChosen: normal.statutoryOpenAge - 10 }, LINEAR, RULES)
    expect(tooEarly.openAge).toBe(normal.statutoryOpenAge - 5)
    expect(tooEarly.earlyReductionPct).toBe(25)
    expect(tooEarly.pensionMonthly).toBeCloseTo(normal.pensionMonthly * 0.75, 5)
  })
})
