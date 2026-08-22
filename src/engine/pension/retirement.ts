import type { IncomeSource, RetirementInput, Rules } from '../types'
import { makeRng } from '../simulate/montecarlo'
import { privatePensionTaxRate } from '../tax/pensionTax'
import { earnedIncomeAfterDeduction } from '../tax/comprehensive'
import { netFactorOf } from '../tax/incomeSourceTax'
import { suspendedPension } from './suspension'

// 대시보드 v4 rtSim 이식 + M4 확장: 수입원 5속성 모델(임대·기타·재취업)과 공무원연금 지급정지
// 충당 순서(원칙 문서 v2 §9): ① 예비 풀(비과세) ③ 사적연금 한도 초과 인출(전액 16.5%)
// ponytail: §9 ②(세액공제 미적용 원금 비과세 인출) 미모델 — M5 이후 필요 시 추가
export interface RetirementRow {
  age: number
  tgt: number // 목표 생활비 (명목 월)
  pub: number // 공적연금 (물가연동, 지급정지 감액 반영)
  extraPublic: number // 국민연금 등 병행 공적연금 (물가연동) — 차트에서 공적 옆에 별도 층
  priv: number // 사적연금 세후 월
  hpm: number // 주택연금 월 (비과세)
  mutualAid: number // 공제회 분할급여 세후 월 — 차트에서 별도 층
  extra: number // 그 외 추가 수입원 세후 합 (임대·근로·기타)
  suspended: number // 지급정지 감액분 (표시용)
  poolDraw: number // 예비 풀 인출 월
}
export interface RetirementResult {
  rows: RetirementRow[]
  poolOutAge: number | null
  uncoveredAge: number | null
  bal85: number | null
  potEnd: number
  poolEnd: number
  suspendedTotal: number // 전 기간 지급정지 감액 합 (만원)
}

// 특정 나이의 추가 수입원 세후 합 (만원/월). f = 물가 누적계수
// publicNet: 국민연금 등 공적 병행분 (별도 층), net: 그 외, workGross: 지급정지 판정용 근로 세전
export function extrasAt(age: number, f: number, extras: IncomeSource[], rules: Rules) {
  let net = 0
  let publicNet = 0
  let mutualAid = 0
  let workGross = 0
  for (const s of extras) {
    if (age < s.startAge || (s.endAge !== null && age > s.endAge) || s.monthlyAmount <= 0) continue
    const gross = s.monthlyAmount * (s.inflationLinked ? f : 1)
    if (s.kind === 'public-extra') publicNet += gross * netFactorOf(s.kind, rules)
    else if (s.kind === 'mutual-aid') mutualAid += gross * netFactorOf(s.kind, rules)
    else net += gross * netFactorOf(s.kind, rules)
    if (s.kind === 'work') workGross += gross
  }
  return { net, publicNet, mutualAid, workGross }
}

// potReturns: 연도별 사적연금 수익률 %(길이 = endAge-startAge+1) — 몬테카를로용, 없으면 고정 potReturn
export function simulateRetirement(
  inp: RetirementInput,
  rules: Rules,
  extras: IncomeSource[] = [],
  potReturns?: number[],
): RetirementResult {
  const publicStart = inp.publicStartAge ?? rules.pensionOpenAge.publicPension
  const overNet = 1 - rules.tax.privatePension.overLimitRate
  let pot = inp.potInitial
  let pool = inp.reservePool
  const rows: RetirementRow[] = []
  let poolOutAge: number | null = null
  let uncoveredAge: number | null = null
  let bal85: number | null = null
  let suspendedTotal = 0
  for (let age = inp.startAge; age <= inp.endAge; age++) {
    const t = age - inp.startAge
    const f = Math.pow(1 + inp.inflation / 100, t)
    const tgt = inp.targetMonthly * f
    const { net: extra, publicNet: extraPublic, mutualAid, workGross } = extrasAt(age, f, extras, rules)
    const pubBase = age >= publicStart ? inp.publicMonthly * f : 0
    // 지급정지: 연금 수급 중 + 근로소득 존재 시. 소득월액 = 근로소득공제 차감 후 (공단 기준).
    // 문턱(평균연금월액 280만·구간표·근로소득공제)이 현행 고시라, 명목 금액을 오늘 기준
    // 현재가치(÷ 오늘→은퇴년 배율 ÷ f)로 환산해 판정 후 되돌림 — 문턱 물가연동 가정
    const toToday = f * (inp.inflFactorToRetire ?? 1)
    const suspended =
      pubBase > 0 && workGross > 0
        ? (suspendedPension(
            (pubBase / toToday) * 10000,
            earnedIncomeAfterDeduction((workGross / toToday) * 10000 * 12, rules) / 12,
            rules.pensionSuspension,
          ) /
            10000) *
          toToday
        : 0
    const pub = pubBase - suspended
    suspendedTotal += suspended * 12
    pot *= 1 + (potReturns?.[t] ?? inp.potReturn) / 100
    // 사적연금 개시 전에는 인출 없이 운용만 (개시 나이 미지정 시 은퇴 즉시)
    const wd = age >= (inp.privateStartAge ?? inp.startAge) ? Math.min(inp.privateAnnual, Math.max(pot, 0)) : 0
    pot -= wd
    let priv = (wd * (1 - privatePensionTaxRate(age, rules))) / 12
    const hpm = age >= inp.housingStartAge ? inp.housingMonthly : 0
    const income = pub + extraPublic + priv + hpm + mutualAid + extra
    const gap = Math.max(0, tgt - income)
    let poolDraw = 0
    // 잉여 스윕: 목표를 넘는 달 수입을 예비 풀(ISA 등)에 적립 — 켜지 않으면 잉여는 소비·증발로 간주
    if (gap <= 0 && inp.sweepSurplus) pool += (income - tgt) * 12
    if (gap > 0) {
      const need = gap * 12
      const fromPool = Math.min(need, Math.max(pool, 0))
      pool -= fromPool
      poolDraw = fromPool / 12
      if (fromPool < need) {
        if (poolOutAge === null) poolOutAge = age
        // 최후 수단: 한도 초과 인출 — 전액 16.5% 과세 근사 (순수령 83.5%)
        const rest = (need - fromPool) / overNet
        const extraWd = Math.min(rest, Math.max(pot, 0))
        pot -= extraWd
        priv += (extraWd * overNet) / 12
        if (extraWd < rest && uncoveredAge === null) uncoveredAge = age
      }
    }
    if (age === 85) bal85 = Math.max(pool, 0) + Math.max(pot, 0)
    rows.push({ age, tgt, pub, extraPublic, priv, hpm, mutualAid, extra, suspended, poolDraw })
  }
  return {
    rows,
    poolOutAge,
    uncoveredAge,
    bal85,
    potEnd: Math.max(pot, 0),
    poolEnd: Math.max(pool, 0),
    suspendedTotal,
  }
}

// 실질가치 변환: 각 연도 명목값을 은퇴년(startAge) 가치로 환산 — 물가 착시 제거 뷰
// 물가연동 항목(목표·공적)은 평평해지고, 명목 고정 항목(사적·주택)의 침식이 드러난다
export function deflateResult(r: RetirementResult, inp: RetirementInput): RetirementResult {
  const defl = (age: number) => Math.pow(1 + inp.inflation / 100, age - inp.startAge)
  const rows = r.rows.map((row) => {
    const f = defl(row.age)
    return {
      ...row,
      tgt: row.tgt / f,
      pub: row.pub / f,
      extraPublic: row.extraPublic / f,
      priv: row.priv / f,
      hpm: row.hpm / f,
      mutualAid: row.mutualAid / f,
      extra: row.extra / f,
      suspended: row.suspended / f,
      poolDraw: row.poolDraw / f,
    }
  })
  return {
    ...r,
    rows,
    bal85: r.bal85 === null ? null : r.bal85 / defl(85),
    potEnd: r.potEnd / defl(inp.endAge),
    poolEnd: r.poolEnd / defl(inp.endAge),
  }
}

// 주택연금 O/X 비교 (M4 완료 기준 화면의 데이터)
export function compareHousingPension(inp: RetirementInput, rules: Rules, extras: IncomeSource[] = []) {
  return {
    on: simulateRetirement(inp, rules, extras),
    off: simulateRetirement({ ...inp, housingMonthly: 0 }, rules, extras),
  }
}

// 95세(endAge)까지 목표 생활비 유지 확률 (F-8 몬테카를로 모드, M6)
// 사적연금 수익률만 랜덤(정규 근사) — 연 단위 1,000회면 수 ms라 Web Worker 불필요
export function retentionProbability(
  inp: RetirementInput,
  rules: Rules,
  extras: IncomeSource[] = [],
  opts: { runs?: number; potVol?: number; seed?: number } = {},
): { probRetained: number; runs: number } {
  const { runs = 1000, potVol = 10, seed = 12345 } = opts
  const years = inp.endAge - inp.startAge + 1
  const { randn } = makeRng(seed)
  let retained = 0
  for (let n = 0; n < runs; n++) {
    const seq = Array.from({ length: years }, () => inp.potReturn + potVol * randn())
    if (simulateRetirement(inp, rules, extras, seq).uncoveredAge === null) retained++
  }
  return { probRetained: (retained / runs) * 100, runs }
}
