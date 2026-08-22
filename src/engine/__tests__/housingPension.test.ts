import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Rules } from '../types'
import { estimateHousingPension } from '../pension/housingPension'

const RULES = rulesJson as unknown as Rules

describe('estimateHousingPension — 백문백답 예시표 보간 (종신 정액형)', () => {
  it('격자점: 백문백답 산문 검증값과 일치 (65세·3억→75.8만, 70세·5억→153.9만)', () => {
    expect(estimateHousingPension(30000, 65, RULES)).toBeCloseTo(75.8, 5)
    expect(estimateHousingPension(50000, 70, RULES)).toBeCloseTo(153.9, 5)
    expect(estimateHousingPension(10000, 55, RULES)).toBeCloseTo(15.6, 5)
    expect(estimateHousingPension(120000, 80, RULES)).toBeCloseTo(406.0, 5)
  })

  it('가격 보간: 70세·4억 = 3억(92.3)과 5억(153.9)의 중간', () => {
    expect(estimateHousingPension(40000, 70, RULES)).toBeCloseTo((92.3 + 153.9) / 2, 5)
  })

  it('연령 보간: 63세·3억 = 60세(63.2)와 65세(75.8) 사이 60% 지점', () => {
    expect(estimateHousingPension(30000, 63, RULES)).toBeCloseTo(63.2 + (75.8 - 63.2) * 0.6, 5)
  })

  it('경계: 12억 초과 캡, 1억 미만 비례, 55세 미만·80세 초과 클램프', () => {
    expect(estimateHousingPension(150000, 70, RULES)).toBeCloseTo(estimateHousingPension(120000, 70, RULES), 10)
    expect(estimateHousingPension(5000, 70, RULES)).toBeCloseTo(30.7 / 2, 5) // 0.5억 = 1억의 절반
    expect(estimateHousingPension(30000, 50, RULES)).toBeCloseTo(estimateHousingPension(30000, 55, RULES), 10)
    expect(estimateHousingPension(30000, 90, RULES)).toBeCloseTo(estimateHousingPension(30000, 80, RULES), 10)
    expect(estimateHousingPension(0, 70, RULES)).toBe(0)
  })

  it('앨리스 케이스 참고: 63세 개시·시세 6억 → 대시보드 가정 168만과 같은 자릿수', () => {
    const v = estimateHousingPension(60000, 63, RULES)
    expect(v).toBeGreaterThan(120)
    expect(v).toBeLessThan(220)
  })
})
