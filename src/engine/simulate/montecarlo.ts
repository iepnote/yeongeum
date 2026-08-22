import type { AssetMix } from '../types'

// 대시보드 v4에서 이식 — 자산 프리셋 (기대수익·변동성·상관 그룹)
export type AssetType = 'eq' | 'alt' | 'mix' | 'safe'
export const PRESETS: Record<string, { mu: number; vol: number; type: AssetType }> = {
  '미국 S&P500': { mu: 9, vol: 16, type: 'eq' },
  '미국 나스닥100': { mu: 10.5, vol: 20, type: 'eq' },
  '미국 배당다우존스': { mu: 8, vol: 13, type: 'eq' },
  '선진국 MSCI World': { mu: 8, vol: 15, type: 'eq' },
  '신흥국/인도': { mu: 9, vol: 22, type: 'eq' },
  '금 현물': { mu: 6, vol: 15, type: 'alt' },
  'TRF3070(주식30)': { mu: 4.8, vol: 5.5, type: 'mix' },
  '국내 종합채권': { mu: 3.5, vol: 5, type: 'safe' },
  '현금성(파킹/예금)': { mu: 3, vol: 0.5, type: 'safe' },
  '직접 입력': { mu: 7, vol: 12, type: 'eq' },
}

export function normWeights(assets: AssetMix[]): number[] {
  const s = assets.reduce((a, x) => a + +x.w, 0) || 1
  return assets.map((x) => x.w / s)
}

function typeOf(a: AssetMix): AssetType {
  return (PRESETS[a.preset] ?? { type: 'eq' as const }).type
}

function corrOf(t1: AssetType, t2: AssetType): number {
  if (t1 === 'eq' && t2 === 'eq') return 0.85
  if ((t1 === 'eq' && t2 === 'mix') || (t1 === 'mix' && t2 === 'eq')) return 0.6
  if (t1 === 'alt' || t2 === 'alt') return 0.1
  if (t1 === 'safe' || t2 === 'safe') return 0.1
  return 0.5
}

export function portfolioParams(assets: AssetMix[]): { mu: number; sd: number } {
  const wn = normWeights(assets)
  let mu = 0
  assets.forEach((a, i) => {
    mu += wn[i] * (a.mu / 100)
  })
  let v = 0
  for (let i = 0; i < assets.length; i++)
    for (let j = 0; j < assets.length; j++) {
      const rho = i === j ? 1 : corrOf(typeOf(assets[i]), typeOf(assets[j]))
      v += wn[i] * wn[j] * rho * (assets[i].vol / 100) * (assets[j].vol / 100)
    }
  return { mu, sd: Math.sqrt(v) }
}

// v4와 동일한 LCG — seed 고정 시 결과 재현 가능 (스냅샷 테스트 근거)
export function makeRng(seed: number) {
  let s = seed >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const randn = () => {
    let u = 0
    let v = 0
    while (u === 0) u = rnd()
    while (v === 0) v = rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  return { rnd, randn }
}

export interface GrowthBands {
  p5: number[]
  p25: number[]
  p50: number[]
  p75: number[]
  p95: number[]
  principal: number[]
}
export interface GrowthResult {
  years: number
  bands: GrowthBands
  probLoss: number // 원금 손실 확률 %
  mu: number
  sd: number
}

export function simulateGrowth(
  assets: AssetMix[],
  init: number,
  monthly: number,
  years: number,
  runs = 2000,
  seed = 12345,
): GrowthResult {
  const { mu, sd } = portfolioParams(assets)
  const { randn } = makeRng(seed)
  const M = years * 12
  const muM = Math.pow(1 + mu, 1 / 12) - 1
  const sdM = sd / Math.sqrt(12)
  const yearly = Array.from({ length: years + 1 }, () => new Float64Array(runs))
  for (let n = 0; n < runs; n++) {
    let v = init
    yearly[0][n] = v
    for (let m = 1; m <= M; m++) {
      v *= 1 + muM + sdM * randn()
      v += monthly
      if (m % 12 === 0) yearly[m / 12][n] = v
    }
  }
  const pct = (arr: Float64Array, q: number) => {
    const s = Float64Array.from(arr).sort()
    const idx = (s.length - 1) * q
    const lo = Math.floor(idx)
    const hi = s[Math.min(lo + 1, s.length - 1)]
    return s[lo] + (hi - s[lo]) * (idx - lo)
  }
  const bands: GrowthBands = { p5: [], p25: [], p50: [], p75: [], p95: [], principal: [] }
  for (let y = 0; y <= years; y++) {
    bands.p5.push(pct(yearly[y], 0.05))
    bands.p25.push(pct(yearly[y], 0.25))
    bands.p50.push(pct(yearly[y], 0.5))
    bands.p75.push(pct(yearly[y], 0.75))
    bands.p95.push(pct(yearly[y], 0.95))
    bands.principal.push(init + monthly * 12 * y)
  }
  let below = 0
  for (const v of yearly[years]) if (v < bands.principal[years]) below++
  return { years, bands, probLoss: (below / runs) * 100, mu, sd }
}
