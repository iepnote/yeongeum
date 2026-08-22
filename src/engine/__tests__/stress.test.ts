import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSETS } from '../defaults'
import { applyStress } from '../simulate/stress'

describe('applyStress — 스트레스 테스트 (대시보드 v4 이식)', () => {
  it('2022년형: 기본 배분 충격 -10.5%', () => {
    const r = applyStress(DEFAULT_ASSETS, 5872, '2022')
    expect(r.shockPct).toBeCloseTo(-10.5, 5)
    expect(r.loss).toBeCloseTo(5872 * -0.105, 2)
  })

  it('시나리오 3종 스냅샷', () => {
    expect(
      (['2022', '2008', '2020'] as const).map((k) => {
        const r = applyStress(DEFAULT_ASSETS, 5872, k)
        return { ...r, shockPct: +r.shockPct.toFixed(2), loss: Math.round(r.loss) }
      }),
    ).toMatchSnapshot()
  })
})
