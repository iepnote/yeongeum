import type { AssetMix } from '../types'
import { normWeights } from './montecarlo'

// 대시보드 v4에서 이식 — 원화 기준 근사 충격 (환율 완충 포함), 프리셋별 %
export const STRESS: Record<string, { label: string; eq: Record<string, number> }> = {
  '2022': {
    label: '2022년형 금리 급등',
    eq: { '미국 S&P500': -12, '미국 나스닥100': -26, '미국 배당다우존스': 3, '선진국 MSCI World': -11, '신흥국/인도': -15, '금 현물': 5, 'TRF3070(주식30)': -7, '국내 종합채권': -5, '현금성(파킹/예금)': 2, '직접 입력': -12 },
  },
  '2008': {
    label: '2008년형 금융위기',
    eq: { '미국 S&P500': -25, '미국 나스닥100': -30, '미국 배당다우존스': -20, '선진국 MSCI World': -28, '신흥국/인도': -40, '금 현물': 10, 'TRF3070(주식30)': -4, '국내 종합채권': 5, '현금성(파킹/예금)': 3, '직접 입력': -25 },
  },
  '2020': {
    label: '2020년형 팬데믹 급락(저점)',
    eq: { '미국 S&P500': -22, '미국 나스닥100': -18, '미국 배당다우존스': -25, '선진국 MSCI World': -24, '신흥국/인도': -25, '금 현물': 3, 'TRF3070(주식30)': -6, '국내 종합채권': 1, '현금성(파킹/예금)': 1, '직접 입력': -22 },
  },
}

export function applyStress(assets: AssetMix[], init: number, scenario: keyof typeof STRESS) {
  const sc = STRESS[scenario]
  const wn = normWeights(assets)
  let shock = 0
  assets.forEach((a, i) => {
    shock += wn[i] * ((sc.eq[a.preset] ?? -15) / 100)
  })
  return { label: sc.label, shockPct: shock * 100, loss: init * shock }
}
