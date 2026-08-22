import type { Rules } from '../types'

// 주택연금 월지급금 추정 — 백문백답 예시표(일반주택 종신지급 정액형)의 이중선형 보간
// 가격: 1억 미만은 0→1억 비례, 최고열(12억) 초과는 캡 (지급금 미증가)
// 연령: 표 범위(55~80)로 클램프 — 55세 미만은 가입 불가, 80세 초과는 80세 행 사용(보수적)
// 입력 priceMan: 시세 (만원), age: 부부 중 연소자 개시 연령. 반환: 만원/월
export function estimateHousingPension(priceMan: number, age: number, rules: Rules): number {
  const h = rules.housingPension
  if (priceMan <= 0) return 0
  const priceEokRaw = priceMan / 10000
  const price = Math.min(priceEokRaw, h.priceEok[h.priceEok.length - 1])
  const a = Math.min(Math.max(age, h.ages[0]), h.ages[h.ages.length - 1])

  // 연령 보간 인덱스
  let ai = h.ages.findIndex((x, i) => i === h.ages.length - 1 || (a >= x && a <= h.ages[i + 1]))
  if (ai >= h.ages.length - 1) ai = h.ages.length - 2
  const at = (a - h.ages[ai]) / (h.ages[ai + 1] - h.ages[ai])

  // 가격 축 값: 0원→0 가상점 포함
  const valueAt = (ageIdx: number): number => {
    const row = h.monthlyThousandWon[ageIdx]
    if (price <= h.priceEok[0]) return (row[0] * price) / h.priceEok[0] // 0~1억 비례
    let pi = h.priceEok.findIndex((x, i) => i === h.priceEok.length - 1 || (price >= x && price <= h.priceEok[i + 1]))
    if (pi >= h.priceEok.length - 1) pi = h.priceEok.length - 2
    const pt = (price - h.priceEok[pi]) / (h.priceEok[pi + 1] - h.priceEok[pi])
    return row[pi] + (row[pi + 1] - row[pi]) * pt
  }

  const thousandWon = valueAt(ai) + (valueAt(ai + 1) - valueAt(ai)) * at
  return thousandWon / 10 // 천원 → 만원
}
