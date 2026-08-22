import type { RetirementInput } from '../engine/types'

// 현재가치 ↔ 은퇴년 명목 환산 컨텍스트 (물가연동 재원 공용)
// 시뮬레이터의 명목 축은 은퇴년(startAge) 기준이므로, 물가연동 재원의 "현재가치" 조회·추정값은
// 은퇴년 명목으로 환산해 넣어야 목표 생활비(환산됨)와 같은 잣대가 된다.
export function retireContext(birthYear: number, retirement: RetirementInput) {
  const retireYear = birthYear + retirement.startAge // 만나이 근사
  const yearsToRetire = Math.max(retireYear - new Date().getFullYear(), 0)
  const inflFactor = Math.pow(1 + retirement.inflation / 100, yearsToRetire)
  return { retireYear, yearsToRetire, inflFactor }
}
