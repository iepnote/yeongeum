import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import salaryJson from '../../rules/salary-teacher-2026.json'
import type { Rules } from '../types'
import { baseSalaryOf, estimateTeacherPension, type SalaryTable } from '../pension/teacher'

const RULES = (rulesJson as unknown as Rules).publicPensionTeacher
const SALARY = salaryJson as SalaryTable

describe('teacher — 2026 실제 봉급표 (별표 11)', () => {
  it('표 무결성: 40개 호봉, 단조 증가', () => {
    expect(SALARY.grades).toHaveLength(40)
    for (let i = 1; i < SALARY.grades.length; i++) {
      expect(SALARY.grades[i].monthly, `호봉 ${i + 1}`).toBeGreaterThan(SALARY.grades[i - 1].monthly)
    }
    expect(baseSalaryOf(1, SALARY)).toBe(2_041_500)
    expect(baseSalaryOf(25, SALARY)).toBe(4_129_400)
    expect(baseSalaryOf(40, SALARY)).toBe(6_205_700)
  })

  it('M3 완료 기준 — 앨리스 보정 케이스: 추정 연금이 현금흐름표 가정(257만)의 ±10% 내', () => {
    const est = estimateTeacherPension(
      {
        appointedDate: '2014-02-01',
        retireDate: '2038-08-31',
        currentGrade: 25,
        asOfDate: '2026-08-01',
        allowanceFactor: 1.35,
        pensionCalibration: { queriedAt: '2026-08-01', serviceMonths: 150, monthlyPension: 1_271_000 },
      },
      SALARY,
      RULES,
    )
    expect(est.calibratedByQuery).toBe(true)
    expect(est.openAge).toBe(65) // 2038 퇴직 → 65세
    // 조회 12.5년 역산 평균 ≈ 598만 → 미래 호봉 상승 반영 혼합 평균
    expect(est.avgIncomeMonthly).toBeGreaterThan(5_981_000)
    // 대시보드 v4·현금흐름표의 공적연금 가정 257만/월 대비 ±10%
    const target = 2_570_000
    expect(Math.abs(est.pensionMonthly - target) / target).toBeLessThan(0.1)
  })

  it('보정 없이 봉급표만으로도 같은 자릿수 추정 (±20% 밴드)', () => {
    const est = estimateTeacherPension(
      { appointedDate: '2014-02-01', retireDate: '2038-08-31', currentGrade: 25, asOfDate: '2026-08-01', allowanceFactor: 1.35 },
      SALARY,
      RULES,
    )
    expect(est.pensionMonthly).toBeGreaterThan(2_570_000 * 0.8)
    expect(est.pensionMonthly).toBeLessThan(2_570_000 * 1.2)
  })

  it('결과 스냅샷 (앨리스 기본값)', () => {
    const est = estimateTeacherPension(
      { appointedDate: '2014-02-01', retireDate: '2038-08-31', currentGrade: 25, asOfDate: '2026-08-01', allowanceFactor: 1.35 },
      SALARY,
      RULES,
    )
    expect({
      serviceYears: +est.serviceYears.toFixed(2),
      currentBaseSalary: est.currentBaseSalary,
      currentIncomeMonthly: Math.round(est.currentIncomeMonthly),
      contributionMonthly: Math.round(est.contributionMonthly),
      avgIncomeMonthly: Math.round(est.avgIncomeMonthly),
      pensionMonthly: Math.round(est.pensionMonthly),
      openAge: est.openAge,
    }).toMatchSnapshot()
  })
})
