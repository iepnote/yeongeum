import type { AssetMix, Holding, RetirementInput } from './types'
import type { TeacherInput } from './pension/teacher'

// 일반 예시 기본값 — 공유용 가상 프로필 (특정인의 실데이터 아님). 사용자가 입력하면 localStorage 값이 우선
export const AS_OF_SEED = '2026-08-07T00:00:00.000Z'

// 예시: 2005년 임용, 2035년 8월 정년, 현재 20호봉인 가상의 교사
export const DEFAULT_TEACHER: TeacherInput = {
  appointedDate: '2005-03-01',
  retireDate: '2035-08-31',
  currentGrade: 20,
  asOfDate: AS_OF_SEED,
  allowanceFactor: 1.35,
}

export const DEFAULT_ASSETS: AssetMix[] = [
  { name: 'TIGER 미국S&P500', preset: '미국 S&P500', w: 50, mu: 9, vol: 16 },
  { name: 'TIGER 미국나스닥100', preset: '미국 나스닥100', w: 20, mu: 10.5, vol: 20 },
  { name: 'TIGER 미국배당다우존스', preset: '미국 배당다우존스', w: 10, mu: 8, vol: 13 },
  { name: '안전자산(TRF+현금성)', preset: '현금성(파킹/예금)', w: 20, mu: 3.2, vol: 2 },
]

export const HOLD_NOW: Holding[] = [
  { acct: '연금저축', name: 'TIGER 미국S&P500', cls: 'eq', amt: 500, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: '연금저축', name: '현금(예수금)', cls: 'safe', amt: 500, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'KODEX 미국나스닥100', cls: 'eq', amt: 300, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'KODEX TRF3070', cls: 'trf', amt: 200, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: '현금성(예수금)', cls: 'safe', amt: 500, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
]

export const HOLD_PLAN: Holding[] = [
  { acct: '연금저축', name: 'TIGER 미국S&P500', cls: 'eq', amt: 800, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: '연금저축', name: '현금(예수금)', cls: 'safe', amt: 200, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'KODEX 미국나스닥100', cls: 'eq', amt: 500, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: 'KODEX TRF3070', cls: 'trf', amt: 200, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
  { acct: 'IRP', name: '현금성(파킹/예금)', cls: 'safe', amt: 300, sh: 0, buy: 0, cur: 0, asOf: AS_OF_SEED },
]

// 예시: 1970년생, 65세(2035년) 은퇴, 목표 생활비 현재 300만/월 가정
export const DEFAULT_RETIREMENT: RetirementInput = {
  startAge: 65,
  endAge: 95,
  targetMonthly: 375, // 은퇴년(2035) 명목 ≈ 300 × 1.025^9
  targetMonthlyToday: 300,
  inflFactorToRetire: 1.2489, // 1.025^9 (2026→2035) — UI가 물가·은퇴연도 변경 시 재동기화
  inflation: 2.5,
  publicMonthly: 250,
  potInitial: 20000,
  privateAnnual: 1200,
  potReturn: 4,
  housingMonthly: 0,
  housingStartAge: 65,
  reservePool: 10000,
}
