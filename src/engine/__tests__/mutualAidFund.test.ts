import { describe, expect, it } from 'vitest'
import { mutualAidFvAtRetire, projectMutualAid } from '../pension/mutualAidFund'

describe('mutualAidFvAtRetire — The-K 조회값 연장 + 납입 계획 변경 반영', () => {
  const base = { queriedTotal: 10000, queriedBaseDate: '2027-01-01', monthlyContribution: 36, accrualRatePct: 0 }

  it('조회 시 납입 미입력이면 기존 동작: 기준일→퇴직일 연장만', () => {
    // 기준일 = 퇴직일 → 조회값 그대로 (앨리스 케이스: 연장 0)
    expect(mutualAidFvAtRetire(base, '2027-01-01', '2026-01-01')).toBe(10000)
    // 기준일 이후 12개월 연장 (이율 0): +36×12
    expect(mutualAidFvAtRetire(base, '2028-01-01', '2026-01-01')).toBe(10000 + 36 * 12)
  })

  it('계획 납입이 조회 가정과 다르면 오늘→기준일 구간 차액을 가감', () => {
    // 이율 0, 오늘→기준일 12개월, 36→56만 증액: +20×12
    const up = { ...base, queriedMonthlyContribution: 36, monthlyContribution: 56 }
    expect(mutualAidFvAtRetire(up, '2027-01-01', '2026-01-01')).toBe(10000 + 20 * 12)
    // 감액도 대칭
    const down = { ...base, queriedMonthlyContribution: 36, monthlyContribution: 16 }
    expect(mutualAidFvAtRetire(down, '2027-01-01', '2026-01-01')).toBe(10000 - 20 * 12)
    // 이율 > 0이면 단순 합보다 큼 (복리)
    const upR = { ...up, accrualRatePct: 4.95 }
    expect(mutualAidFvAtRetire(upR, '2027-01-01', '2026-01-01')).toBeGreaterThan(10000 + 20 * 12)
  })

  it('projectMutualAid: 이율 0이면 단순 합', () => {
    expect(projectMutualAid(100, 10, 0, 12)).toBe(220)
  })
})
