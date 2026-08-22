import type { Rules } from '../types'

// 국민연금 간이 추정 (F-2.3/F-2.4 — 회사원·자영업 프리셋)
// 기본연금액(연) = 상수(1.2, 소득대체율 40% 기준) × (A + B) × (1 + 0.05 × 20년 초과 가입월수/12)
// A = 전체 가입자 평균소득월액(연 1회 고시), B = 본인 가입기간 평균소득월액(재평가) — 현재 소득으로 근사
// 공단 예상연금 조회값이 있으면 그 값을 우선 사용 (이 추정은 미조회 시의 자리값)
export interface NpsInput {
  birthYear: number
  avgIncomeMonthly: number // B값 근사 (원/월)
  joinYears: number // 총 가입 기간 (년)
}

export interface NpsEstimate {
  pensionMonthly: number // 현재가치 원/월
  openAge: number
}

export function estimateNps(inp: NpsInput, rules: Rules): NpsEstimate {
  const r = rules.publicPensionNps
  const months = Math.max(inp.joinYears, 0) * 12
  // 최소 가입 10년 미만은 연금 수급 불가 (일시금) — 0 처리
  if (months < 120) return { pensionMonthly: 0, openAge: npsOpenAge(inp.birthYear, rules) }
  const base = r.replacementConstant * (r.aValueMonthly + inp.avgIncomeMonthly)
  const bonus = 1 + (0.05 * Math.max(months - 240, 0)) / 12
  // 20년 미만은 240개월 기준액에서 미달 월수만큼 비례 감액
  const shortRatio = Math.min(months / 240, 1)
  return { pensionMonthly: (base * bonus * shortRatio) / 12, openAge: npsOpenAge(inp.birthYear, rules) }
}

export function npsOpenAge(birthYear: number, rules: Rules): number {
  for (const b of rules.publicPensionNps.openAgeByBirthYear) if (birthYear >= b.birthYearFrom) return b.age
  const last = rules.publicPensionNps.openAgeByBirthYear
  return last[last.length - 1].age
}
