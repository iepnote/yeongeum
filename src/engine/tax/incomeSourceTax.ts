import type { IncomeKind, Rules } from '../types'

// 수입원 종류별 세후 계수 (근사, F-5). 금액 단위 무관.
// - rent: 분리과세 근사 (수입 − 필요경비) × 15.4%
// - work: 재취업 파트타임 소액 전제 — 근로소득공제로 실효세율 ≈ 0 근사
// - other: 기타소득 필요경비 60% 후 22% 원천
export function netFactorOf(kind: IncomeKind, rules: Rules): number {
  switch (kind) {
    case 'rent-housing': {
      const r = rules.tax.rent
      return 1 - (1 - r.housingExpenseRatio) * r.rate
    }
    case 'rent-commercial': {
      const r = rules.tax.rent
      return 1 - (1 - r.commercialExpenseRatio) * r.rate
    }
    case 'work':
      return 1
    case 'public-extra':
      return 1 // 공적연금 세전≈세후 근사 (PRD F-5 공적연금 처리와 동일)
    case 'mutual-aid':
      return 1 // 공제회 분할급여 — 저율(0~3%대) 비과세 근사 (원칙 문서 §9 예비 풀과 동일 취급)
    case 'other': {
      const o = rules.tax.otherIncome
      return 1 - (1 - o.expenseRatio) * o.rate
    }
  }
}
