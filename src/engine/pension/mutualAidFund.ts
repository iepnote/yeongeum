// 교직원공제회 장기저축급여 적립 추정 (F-2.2 "월 구좌 입력 시 급여율 복리 추정"의 금액 기반 버전)
// FV = 현재 적립금×(1+i)^m + 월 납입×((1+i)^m − 1)/i, i = 급여율/12 (월복리 근사)
// 실제 공제회는 연 단위 부가 방식·구좌제이지만, 적립금(원리금) 조회값에서 출발하면 오차가 작다.
// 급여율은 변동금리(공제회 고시) — 파라미터로 받는다. 단위 무관 (만원 넣으면 만원)
import { monthsBetween } from './teacher'

// The-K 조회값(추정 기준일 시점 총액)을 퇴직예정일 시점으로 연장 (기준일 ≥ 퇴직일이면 그대로).
// 조회값은 '조회 당시 월 납입 유지' 가정의 추정이므로, 계획 납입이 다르면
// 오늘→기준일 구간의 차액 적립분을 가감한다 (queriedMonthlyContribution 입력 시)
export function mutualAidFvAtRetire(
  m: { queriedTotal: number; queriedBaseDate: string; monthlyContribution: number; queriedMonthlyContribution?: number; accrualRatePct: number },
  retireDateIso: string,
  todayIso: string,
): number {
  const base = m.queriedBaseDate || todayIso
  const delta = m.queriedMonthlyContribution != null ? m.monthlyContribution - m.queriedMonthlyContribution : 0
  const adjusted =
    (m.queriedTotal ?? 0) +
    (delta !== 0 ? projectMutualAid(0, delta, m.accrualRatePct, Math.max(monthsBetween(todayIso, base), 0)) : 0)
  const months = Math.max(monthsBetween(base, retireDateIso), 0)
  return projectMutualAid(adjusted, m.monthlyContribution, m.accrualRatePct, months)
}

export function projectMutualAid(
  currentBalance: number,
  monthlyContribution: number,
  annualRatePct: number,
  months: number,
): number {
  const m = Math.max(Math.round(months), 0)
  if (annualRatePct === 0) return currentBalance + monthlyContribution * m
  const i = annualRatePct / 100 / 12
  const growth = Math.pow(1 + i, m)
  return currentBalance * growth + monthlyContribution * ((growth - 1) / i)
}
