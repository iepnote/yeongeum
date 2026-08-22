import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Rules } from '../types'
import { DEFAULT_RETIREMENT } from './fixtures'
import { simulateRetirement } from '../pension/retirement'

const RULES = rulesJson as Rules

describe('simulateRetirement — 수령기 시뮬레이터 (v4 rtSim 이식, §9 충당 순서)', () => {
  const r = simulateRetirement(DEFAULT_RETIREMENT, RULES)

  it('63세(공백기): 공적 0 · 사적 세후 118.125만 · 주택 168만 · 부족분은 예비 풀', () => {
    const row = r.rows[0]
    expect(row.age).toBe(63)
    expect(row.pub).toBe(0)
    expect(row.priv).toBeCloseTo((1500 * (1 - 0.055)) / 12, 5)
    expect(row.hpm).toBe(168)
    expect(row.pub + row.priv + row.hpm + row.poolDraw).toBeCloseTo(row.tgt, 5)
  })

  it('sweepSurplus: 목표 초과 수입을 예비 풀에 적립 — 켜면 풀이 더 오래 간다', () => {
    const rich = { ...DEFAULT_RETIREMENT, publicMonthly: DEFAULT_RETIREMENT.targetMonthly * 2 }
    const off = simulateRetirement(rich, RULES)
    const on = simulateRetirement({ ...rich, sweepSurplus: true }, RULES)
    expect(on.poolEnd).toBeGreaterThan(off.poolEnd)
    // 기본(잉여 없는 케이스)은 스윕을 켜도 동일 — 기존 동작 불변
    const b1 = simulateRetirement(DEFAULT_RETIREMENT, RULES)
    const b2 = simulateRetirement({ ...DEFAULT_RETIREMENT, sweepSurplus: true }, RULES)
    expect(b2.uncoveredAge).toBe(b1.uncoveredAge)
  })

  it('privateStartAge: 개시 전에는 인출 없이 운용만 — 개시 후 첫해 인출이 기본 시나리오보다 큼', () => {
    const late = simulateRetirement({ ...DEFAULT_RETIREMENT, privateStartAge: 66 }, RULES)
    for (const row of late.rows.filter((x) => x.age < 66)) expect(row.priv).toBe(0)
    expect(late.rows.find((x) => x.age === 66)!.priv).toBeGreaterThan(0)
  })

  it('publicStartAge: 개시연령을 입력하면 룰 기본(65) 대신 그 나이부터 공적연금 지급', () => {
    const r62 = simulateRetirement({ ...DEFAULT_RETIREMENT, publicStartAge: 62 }, RULES)
    const row63 = r62.rows[0]
    expect(row63.pub).toBeCloseTo(257 * 1.025 ** 0, 5) // 63세인데 이미 개시(62~) — 첫 행부터 지급
    const r67 = simulateRetirement({ ...DEFAULT_RETIREMENT, publicStartAge: 67 }, RULES)
    expect(r67.rows.find((x) => x.age === 66)!.pub).toBe(0)
    expect(r67.rows.find((x) => x.age === 67)!.pub).toBeGreaterThan(0)
  })

  it('65세: 공적연금 개시, 물가연동 반영', () => {
    const row = r.rows.find((x) => x.age === 65)!
    expect(row.pub).toBeCloseTo(257 * 1.025 ** 2, 5)
  })

  it('70세: 저율 구간 전환(4.4%) 반영 — 풀 생존 중이므로 한도 내 인출만', () => {
    const row = r.rows.find((x) => x.age === 70)!
    expect(row.priv).toBeCloseTo((1500 * (1 - 0.044)) / 12, 1)
  })

  it('전체 결과 스냅샷 (63~95세)', () => {
    expect({
      poolOutAge: r.poolOutAge,
      uncoveredAge: r.uncoveredAge,
      bal85: r.bal85 === null ? null : Math.round(r.bal85),
      potEnd: Math.round(r.potEnd),
      poolEnd: Math.round(r.poolEnd),
      rows: r.rows.map((x) => ({
        age: x.age,
        tgt: +x.tgt.toFixed(1),
        pub: +x.pub.toFixed(1),
        priv: +x.priv.toFixed(1),
        hpm: x.hpm,
        poolDraw: +x.poolDraw.toFixed(1),
      })),
    }).toMatchSnapshot()
  })
})
