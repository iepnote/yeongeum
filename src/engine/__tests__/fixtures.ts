// 테스트 픽스처 — 배포 기본값(defaults.ts)과 분리. 기본값을 일반 예시로 바꿔도 테스트 기대값은 불변
import type { Holding, RetirementInput } from '../types'

export const AS_OF_SEED = '2026-08-07T00:00:00.000Z'

export const HOLD_NOW: Holding[] = [
  { acct: '연금저축', name: 'TIGER 미국S&P500', cls: 'eq', amt: 1000, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: '연금저축', name: '현금(예수금)', cls: 'safe', amt: 2000, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'KODEX 미국나스닥100', cls: 'eq', amt: 750, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'KODEX TRF3070', cls: 'trf', amt: 322, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: '현금성(예수금)', cls: 'safe', amt: 1800, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
]

export const HOLD_PLAN: Holding[] = [
  { acct: '연금저축', name: 'TIGER 미국S&P500', cls: 'eq', amt: 2400, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: '연금저축', name: 'TIGER 미국배당다우존스', cls: 'eq', amt: 600, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: '나스닥100(KODEX+TIGER)', cls: 'eq', amt: 1170, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'TIGER 미국S&P500', cls: 'eq', amt: 540, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'KODEX TRF3070', cls: 'trf', amt: 322, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: '현금성(파킹/예금)', cls: 'safe', amt: 840, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
]

export const DEFAULT_RETIREMENT: RetirementInput = {
  startAge: 63,
  endAge: 95,
  targetMonthly: 500, // 2038년(은퇴년) 가치 — 원칙 문서 §1
  targetMonthlyToday: 372, // ≈ 500 ÷ 1.025^12 (현재 가치 환산)
  inflFactorToRetire: 1.3449, // 1.025^12 (2026→2038) — UI가 물가·은퇴연도 변경 시 재동기화
  inflation: 2.5,
  publicMonthly: 257,
  potInitial: 30000,
  privateAnnual: 1500,
  potReturn: 4,
  housingMonthly: 168,
  housingStartAge: 63,
  reservePool: 18400,
}
