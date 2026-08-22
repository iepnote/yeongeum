import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Holding, Rules } from '../types'
import { DEFAULT_RETIREMENT, HOLD_NOW } from './fixtures'
import { computeFreshness, daysSince, updateChecklist } from '../freshness'
import { retentionProbability, simulateRetirement } from '../pension/retirement'
import { mergeHoldingsByAccount } from '../pension/holdings'

const RULES = rulesJson as unknown as Rules
const NOW = '2026-08-08T00:00:00.000Z'

describe('freshness — F-10 신선도 (M4.5)', () => {
  it('daysSince: 기본 계산과 결측 처리', () => {
    expect(daysSince('2026-08-01T00:00:00.000Z', NOW)).toBe(7)
    expect(daysSince(undefined, NOW)).toBeNull()
    expect(daysSince('not-a-date', NOW)).toBeNull()
  })

  it('시세: 가장 오래된 보유 행 기준, 7일 초과 시 stale', () => {
    const fresh: Holding[] = HOLD_NOW.map((h) => ({ ...h, asOf: '2026-08-06T00:00:00.000Z' }))
    const items = computeFreshness({ nowIso: NOW, holdings: fresh, rulesYear: 2026 })
    expect(items.find((x) => x.id === 'price')!.stale).toBe(false)
    const mixed = [...fresh]
    mixed[0] = { ...mixed[0], asOf: '2026-07-01T00:00:00.000Z' } // 한 행만 낡아도 전체 stale
    expect(computeFreshness({ nowIso: NOW, holdings: mixed, rulesYear: 2026 }).find((x) => x.id === 'price')!.stale).toBe(true)
  })

  it('조회값 12개월·룰 연도 판정', () => {
    const items = computeFreshness({ nowIso: NOW, holdings: [], pensionQueriedAt: '2025-07-01', rulesYear: 2025 })
    expect(items.find((x) => x.id === 'query')!.stale).toBe(true) // 13개월
    expect(items.find((x) => x.id === 'rules')!.stale).toBe(true) // 2026 > 2025
    const ok = computeFreshness({ nowIso: NOW, holdings: [], pensionQueriedAt: '2026-06-01', rulesYear: 2026 })
    expect(ok.find((x) => x.id === 'query')!.stale).toBe(false)
    expect(ok.find((x) => x.id === 'rules')!.stale).toBe(false)
  })

  it('갱신 체크리스트: 6항목, stale 항목은 urgent (M4.5 완료 기준)', () => {
    const items = computeFreshness({ nowIso: NOW, holdings: HOLD_NOW, rulesYear: 2026 }) // seed asOf 8/7 → 시세 신선, 조회값 미입력
    const list = updateChecklist(items)
    expect(list).toHaveLength(6)
    expect(list.find((c) => c.label.includes('공무원연금'))!.urgent).toBe(true)
    expect(list.find((c) => c.label.includes('현재가'))!.urgent).toBe(false)
    expect(list.find((c) => c.label.includes('룰'))!.urgent).toBe(false)
  })
})

describe('holdings 계좌 단위 병합 (KIS 동기화)', () => {
  it('IRP만 교체, 연금저축 행 유지', () => {
    const synced: Holding[] = [
      { acct: 'IRP', name: 'TIGER 미국나스닥100', cls: 'eq', sh: 41, buy: 61810, cur: 184660, amt: 757.1, asOf: NOW },
    ]
    const merged = mergeHoldingsByAccount(HOLD_NOW, 'IRP', synced)
    expect(merged.filter((h) => h.acct === '연금저축')).toHaveLength(2) // 기존 유지
    expect(merged.filter((h) => h.acct === 'IRP')).toHaveLength(1) // 교체
    expect(merged.find((h) => h.acct === 'IRP')!.sh).toBe(41)
  })
})

describe('retentionProbability — 유지 확률 (F-8/M6)', () => {
  it('변동성 0이면 결정적 결과와 일치', () => {
    const det = simulateRetirement(DEFAULT_RETIREMENT, RULES)
    const r = retentionProbability(DEFAULT_RETIREMENT, RULES, [], { runs: 50, potVol: 0 })
    expect(r.probRetained).toBe(det.uncoveredAge === null ? 100 : 0)
  })

  it('시드 고정 → 재현 가능, 확률은 0~100', () => {
    const a = retentionProbability(DEFAULT_RETIREMENT, RULES, [], { runs: 300, potVol: 10 })
    const b = retentionProbability(DEFAULT_RETIREMENT, RULES, [], { runs: 300, potVol: 10 })
    expect(a.probRetained).toBe(b.probRetained)
    expect(a.probRetained).toBeGreaterThanOrEqual(0)
    expect(a.probRetained).toBeLessThanOrEqual(100)
  })

  it('목표를 낮추면 유지 확률 상승 (단조성)', () => {
    const hard = retentionProbability(DEFAULT_RETIREMENT, RULES, [], { runs: 300, potVol: 10 })
    const easy = retentionProbability({ ...DEFAULT_RETIREMENT, targetMonthly: 400 }, RULES, [], { runs: 300, potVol: 10 })
    expect(easy.probRetained).toBeGreaterThanOrEqual(hard.probRetained)
  })
})
