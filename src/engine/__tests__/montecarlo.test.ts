import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSETS } from '../defaults'
import { normWeights, portfolioParams, simulateGrowth } from '../simulate/montecarlo'

const round = (xs: number[]) => xs.map((x) => Math.round(x))

describe('simulateGrowth — 자산구성 몬테카를로 (대시보드 v4 이식)', () => {
  it('가중치 정규화', () => {
    expect(normWeights(DEFAULT_ASSETS)).toEqual([0.5, 0.2, 0.1, 0.2])
  })

  it('포트폴리오 파라미터', () => {
    const { mu, sd } = portfolioParams(DEFAULT_ASSETS)
    expect(mu).toBeCloseTo(0.5 * 0.09 + 0.2 * 0.105 + 0.1 * 0.08 + 0.2 * 0.032, 10)
    expect(sd).toBeGreaterThan(0.1)
    expect(sd).toBeLessThan(0.2)
  })

  it('시드 고정 → 결정적 결과 (v4 기본 입력 스냅샷)', () => {
    const r = simulateGrowth(DEFAULT_ASSETS, 5872, 75, 10)
    expect(r.bands.principal[10]).toBe(5872 + 75 * 120)
    expect({
      probLoss: r.probLoss,
      p5: round(r.bands.p5),
      p50: round(r.bands.p50),
      p95: round(r.bands.p95),
    }).toMatchSnapshot()
  })

  it('같은 시드 → 같은 결과', () => {
    const a = simulateGrowth(DEFAULT_ASSETS, 1000, 10, 5)
    const b = simulateGrowth(DEFAULT_ASSETS, 1000, 10, 5)
    expect(a.bands.p50).toEqual(b.bands.p50)
  })
})
