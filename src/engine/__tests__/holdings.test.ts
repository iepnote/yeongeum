import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Rules } from '../types'
import { HOLD_NOW, HOLD_PLAN } from './fixtures'
import { costAmt, effAmt, isComputed, retOf, summarizeHoldings } from '../pension/holdings'

const RULES = rulesJson as Rules

describe('holdings — 계좌별 보유 + IRP 한도 (대시보드 v4 이식)', () => {
  it('주수·현재가 입력 시 평가액 자동 계산 (만원)', () => {
    const h = { ...HOLD_NOW[0], sh: 10, buy: 14000, cur: 15000 }
    expect(isComputed(h)).toBe(true)
    expect(effAmt(h)).toBe(15)
    expect(costAmt(h)).toBe(14)
    expect(retOf(h)).toBeCloseTo(15 / 14 - 1, 10)
  })

  it('주수 없으면 직접 입력 금액 사용', () => {
    expect(isComputed(HOLD_NOW[0])).toBe(false)
    expect(effAmt(HOLD_NOW[0])).toBe(1000)
    expect(retOf(HOLD_NOW[0])).toBeNull()
  })

  it('현재 보유(2026-08) 요약 — IRP 70% 한도 검사', () => {
    const s = summarizeHoldings(HOLD_NOW, RULES)
    expect(s.tot).toBe(5872)
    expect(s.irpTot).toBe(2872)
    expect(s.irpRisk).toBe(750)
    expect(s.irpRatio).toBeCloseTo(750 / 2872, 10)
    expect(s.irpRoom).toBeCloseTo(0.7 * 2872 - 750, 10)
    expect(s).toMatchSnapshot()
  })

  it('실행안 완료 후 상태 요약 스냅샷', () => {
    expect(summarizeHoldings(HOLD_PLAN, RULES)).toMatchSnapshot()
  })
})
