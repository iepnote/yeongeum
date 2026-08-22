import type { Holding, Rules } from '../types'

// 대시보드 v4에서 이식 — 주수·현재가 있으면 평가액 자동 계산, 없으면 직접 입력 금액
export function isComputed(h: Holding): boolean {
  return h.sh > 0 && h.cur > 0
}
export function effAmt(h: Holding): number {
  return isComputed(h) ? (h.sh * h.cur) / 10000 : +h.amt // 만원
}
export function costAmt(h: Holding): number | null {
  return h.sh > 0 && h.buy > 0 ? (h.sh * h.buy) / 10000 : null
}
export function retOf(h: Holding): number | null {
  const c = costAmt(h)
  return c && isComputed(h) ? effAmt(h) / c - 1 : null
}

// 계좌 단위 보유 병합 (KIS 동기화용): 해당 계좌 행만 교체, 나머지 계좌는 유지
export function mergeHoldingsByAccount(current: Holding[], acct: Holding['acct'], rows: Holding[]): Holding[] {
  return [...current.filter((h) => h.acct !== acct), ...rows]
}

export interface HoldingsSummary {
  tot: number
  pensionSavings: number // 연금저축 합계
  irpTot: number
  irpRisk: number // IRP 내 주식형(eq) 평가액
  irpRatio: number // 위험자산 비율
  irpRoom: number // 한도까지 위험자산 추가 매수 여력 (음수 = 초과)
  eqEffPct: number // 유효 주식 비중 % (TRF는 환산 계수 적용)
  costSum: number
  valSum: number
  totPL: number
  totRet: number | null
}

export function summarizeHoldings(holdings: Holding[], rules: Rules): HoldingsSummary {
  const eqFactor: Record<Holding['cls'], number> = { eq: 1, trf: rules.account.trfEquityFactor, safe: 0 }
  const tot = holdings.reduce((a, h) => a + effAmt(h), 0)
  const eqEff = holdings.reduce((a, h) => a + effAmt(h) * eqFactor[h.cls], 0)
  const irp = holdings.filter((h) => h.acct === 'IRP')
  const irpTot = irp.reduce((a, h) => a + effAmt(h), 0)
  const irpRisk = irp.filter((h) => h.cls === 'eq').reduce((a, h) => a + effAmt(h), 0)
  const pensionSavings = holdings.filter((h) => h.acct === '연금저축').reduce((a, h) => a + effAmt(h), 0)
  let costSum = 0
  let valSum = 0
  holdings.forEach((h) => {
    const c = costAmt(h)
    if (c && isComputed(h)) {
      costSum += c
      valSum += effAmt(h)
    }
  })
  const totPL = valSum - costSum
  return {
    tot,
    pensionSavings,
    irpTot,
    irpRisk,
    irpRatio: irpTot > 0 ? irpRisk / irpTot : 0,
    irpRoom: rules.account.irpRiskLimit * irpTot - irpRisk,
    eqEffPct: tot ? (eqEff / tot) * 100 : 0,
    costSum,
    valSum,
    totPL,
    totRet: costSum > 0 ? totPL / costSum : null,
  }
}
