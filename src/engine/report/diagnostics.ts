import type { Holding, IncomeSource, RetirementInput, Rules } from '../types'
import { summarizeHoldings } from '../pension/holdings'
import { regionalPremium, voluntaryPremium, dependentCheck } from '../nhis'
import type { RetirementResult } from '../pension/retirement'

// 규칙 기반 진단 (F-9, M5) — 경고 6종 + 액션 아이템. 화면·PDF 공용 데이터
export type Severity = 'crit' | 'warn' | 'info' | 'ok'
export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
  action?: string
}

export interface DiagnoseInput {
  holdings: Holding[]
  retirement: RetirementInput
  retirementResult: RetirementResult
  incomeSources: IncomeSource[]
  financialIncomeAnnual: number // 일반계좌 금융소득 만원/년 (모르면 0)
  propertyTaxBase: number // 재산세 과표 만원
  voluntaryBaseSalary?: number // 퇴직 전 보수월액 근사 (원/월) — 임의계속 비교용
  retireDate?: string
  housePrice?: number // 주택 시세 만원 — 주택연금 상한(12억) 초과 판정용
  // 현재→은퇴년 물가 배율 (기본 1). 공적연금 입력이 '은퇴년 명목'이므로, 현행 문턱(피부양자
  // 2,000만 등)과 비교하는 판정에서는 이 배율로 나눠 현재가치로 환산한다 (문턱 물가연동 가정)
  inflFactorToRetire?: number
}

const fmtMan = (v: number) => Math.round(v).toLocaleString('ko-KR') + '만'

export function diagnose(inp: DiagnoseInput, rules: Rules): Finding[] {
  const f: Finding[] = []
  const won = 10000

  // ① IRP 위험자산 70% 한도 (원칙 §3: 여유 5%p 이상 유지)
  const s = summarizeHoldings(inp.holdings, rules)
  const limit = rules.account.irpRiskLimit
  if (s.irpTot > 0) {
    if (s.irpRatio > limit)
      f.push({
        id: 'irp-limit', severity: 'crit', title: 'IRP 위험자산 한도 초과',
        detail: `위험자산 ${(s.irpRatio * 100).toFixed(1)}% > ${limit * 100}% — 신규 위험자산 매수 불가 상태 (${fmtMan(-s.irpRoom)}원 초과)`,
        action: '다음 납입을 안전자산으로 돌리거나 리밸런싱일에 조정',
      })
    else if (s.irpRatio > limit - 0.05)
      f.push({
        id: 'irp-limit', severity: 'warn', title: 'IRP 한도 여유 5%p 미만',
        detail: `위험자산 ${(s.irpRatio * 100).toFixed(1)}% — 원칙 문서 §3의 여유(5%p) 미달. 평가액 변동으로 초과될 수 있음`,
        action: '위험자산 추가 매수 전 증권사 앱에서 한도 확인',
      })
    else f.push({ id: 'irp-limit', severity: 'ok', title: 'IRP 한도 여유 충분', detail: `위험자산 ${(s.irpRatio * 100).toFixed(1)}% (여력 ${fmtMan(s.irpRoom)}원)` })
  }

  // ② 사적연금 1,500만 한도 초과
  const privLimit = rules.tax.privatePension.annualLimit / won
  if (inp.retirement.privateAnnual > privLimit)
    f.push({
      id: 'priv-limit', severity: 'crit', title: `사적연금 연 수령이 한도(${fmtMan(privLimit)}) 초과`,
      detail: `연 ${fmtMan(inp.retirement.privateAnnual)} 설정 — 전액 ${rules.tax.privatePension.overLimitRate * 100}% 분리 vs 종합과세 대상 (증액분 실효 ~53%)`,
      action: `연 수령을 ${fmtMan(privLimit)} 이하로 낮추고 부족분은 예비 풀에서 충당 (원칙 §9)`,
    })
  else if (inp.retirementResult.poolOutAge !== null)
    f.push({
      id: 'priv-limit', severity: 'warn', title: `${inp.retirementResult.poolOutAge}세부터 한도 초과 인출 예상`,
      detail: '예비 풀 고갈 후 부족분을 사적연금 한도 초과 인출(16.5%)로 충당하게 됨',
      action: '75·80·85세 관문 점검에서 지출 조정 또는 재원 보강 검토 (원칙 §9)',
    })
  else f.push({ id: 'priv-limit', severity: 'ok', title: '사적연금 한도 내 수령 유지', detail: `연 ${fmtMan(inp.retirement.privateAnnual)} ≤ ${fmtMan(privLimit)}, ${inp.retirement.endAge}세까지 초과 인출 없음` })

  // ③ 금융소득 문턱 2종 (건보 1,000만 절벽 · 종합과세 2,000만)
  const fin = inp.financialIncomeAnnual
  const nhisThr = (rules.nhis.regional.financialIncomeThreshold as number) / won
  const taxThr = rules.tax.financialIncome.comprehensiveThreshold / won
  if (fin > taxThr)
    f.push({ id: 'fin-threshold', severity: 'crit', title: `금융소득 ${fmtMan(taxThr)} 초과 — 종합과세`, detail: `일반계좌 금융소득 연 ${fmtMan(fin)}`, action: '배당·이자 자산을 연금계좌·ISA로 이전 (원칙 §3)' })
  else if (fin > nhisThr)
    f.push({ id: 'fin-threshold', severity: 'crit', title: `금융소득 ${fmtMan(nhisThr)} 초과 — 건보료 전액 반영 절벽`, detail: `연 ${fmtMan(fin)} 전액이 지역 건보 소득에 반영됨 (문턱 이하면 0원)`, action: '문턱 아래로 관리: 예금 만기·배당 시점 분산, 연금계좌·ISA 활용' })
  else if (fin > nhisThr * 0.9)
    f.push({ id: 'fin-threshold', severity: 'warn', title: '금융소득이 건보 문턱에 근접', detail: `연 ${fmtMan(fin)} — ${fmtMan(nhisThr)} 초과 시 전액 반영 절벽 (연 +80만원대 보험료)`, action: '이자·배당 예상액 점검' })
  else f.push({ id: 'fin-threshold', severity: 'ok', title: '금융소득 문턱 여유', detail: `연 ${fmtMan(fin)} < 건보 ${fmtMan(nhisThr)} · 종합 ${fmtMan(taxThr)}` })

  // ④ 피부양자 요건 (판정: 연금 100% 반영) — 국민연금 등 추가 공적연금(public-extra)도 판정 소득에 포함
  // 공적연금 값은 은퇴년 명목이므로 현재가치로 환산해 현행 한도와 비교 (판정 기준 일치)
  const deflate = 1 / (inp.inflFactorToRetire ?? inp.retirement.inflFactorToRetire ?? 1)
  const extraPublicAnnual = inp.incomeSources
    .filter((s) => s.kind === 'public-extra')
    .reduce((a, s) => a + s.monthlyAmount * 12, 0)
  const publicAnnualToday = (inp.retirement.publicMonthly * 12 + extraPublicAnnual) * deflate
  const dep = dependentCheck(
    { publicPensionAnnual: publicAnnualToday * won, propertyTaxBase: inp.propertyTaxBase * won },
    rules.nhis,
  )
  f.push(
    dep.eligible
      ? { id: 'dependent', severity: 'info', title: '피부양자 요건 충족 (현재 가정 기준)', detail: dep.reason }
      : { id: 'dependent', severity: 'warn', title: '피부양자 등재 불가 — 지역가입 대비 필요', detail: dep.reason, action: '수령기 건보료를 지역가입 기준으로 계획 (임의계속 3년 활용 검토)' },
  )

  // ⑤ 분배금·현금 방치 (원칙 §4: 분배금 즉시 재투자, 방치 = 10년 -231만)
  const hasDist = inp.holdings.some((h) => h.name.includes('배당'))
  const safeShare = s.tot > 0 ? inp.holdings.filter((h) => h.cls === 'safe').reduce((a, h) => a + (h.sh > 0 && h.cur > 0 ? (h.sh * h.cur) / won : h.amt), 0) / s.tot : 0
  if (safeShare > 0.35)
    f.push({
      id: 'idle-cash', severity: 'warn', title: '현금성 비중 과다 — 배치 미완료 가능성',
      detail: `현금·예수금류 ${(safeShare * 100).toFixed(0)}% (목표 안전자산 20%). 분배금·납입금 방치는 10년 약 -231만 (원칙 §4)`,
      action: '초기 배치 실행표 확인, 분배금 입금 시 즉시 같은 ETF 매수',
    })
  else if (hasDist)
    f.push({ id: 'idle-cash', severity: 'info', title: '분배형 ETF 보유 — 분기 분배금 재투자 루틴 확인', detail: '배당다우존스 등 분배금은 입금 확인 즉시 그 달 납입분과 합쳐 매수 (원칙 §4)' })
  else f.push({ id: 'idle-cash', severity: 'ok', title: '현금 방치 신호 없음', detail: `현금성 ${(safeShare * 100).toFixed(0)}%` })

  // ⑥ 임의계속가입 — 신청기한 + 유불리
  if (inp.voluntaryBaseSalary && inp.voluntaryBaseSalary > 0) {
    const vol = voluntaryPremium(inp.voluntaryBaseSalary, rules.nhis)
    const reg = regionalPremium(
      { publicPensionAnnual: publicAnnualToday * won, propertyTaxBase: inp.propertyTaxBase * won }, // 현재가치 기준 비교
      rules.nhis,
    )
    const better = vol.totalMonthly < reg.totalMonthly
    const retireNote = inp.retireDate ? `퇴직(${inp.retireDate.slice(0, 7)}) 후 ` : ''
    f.push({
      id: 'voluntary', severity: better ? 'warn' : 'info',
      title: better ? `임의계속가입 유리 — 신청기한 놓치지 말 것` : '임의계속가입 불리 (지역가입 유지)',
      detail: `임의계속 월 ${fmtMan(vol.totalMonthly / won)} vs 지역 월 ${fmtMan(reg.totalMonthly / won)} (최대 ${rules.nhis.voluntaryContinuation.maxMonths}개월)`,
      action: better ? `${retireNote}지역보험료 최초 고지서의 납부기한 2개월 이내 신청 필수` : undefined,
    })
  }

  // ⑦ 주택연금 가격 상한 — 시세가 상한을 넘으면 초과분은 월지급금에 전혀 반영되지 않음
  const capMan = rules.housingPension.priceEok[rules.housingPension.priceEok.length - 1] * won
  if (inp.housePrice && inp.housePrice > capMan) {
    const excess = inp.housePrice - capMan
    f.push({
      id: 'housing-cap', severity: 'warn', title: `주택 시세가 주택연금 상한(${capMan / won}억) 초과`,
      detail: `시세 ${(inp.housePrice / won).toFixed(1)}억 중 초과분 ${(excess / won).toFixed(1)}억은 월지급금 산정에 반영되지 않는 잠긴 자산`,
      action: `${capMan / won}억 이하 주택으로 이주하면 월지급금은 같고 차액 약 ${fmtMan(excess)}원을 목돈화 가능 — 취득세·중개비·양도세(12억 초과 양도차익 과세) 감안해 종합 의견 탭의 비교 참고`,
    })
  }

  return f
}

// 분리과세 활용 가이드 (F-9 확장) — 수령기 과세 트랙별 현황 + 절세 포인트. 규칙 기반 정보 제공용
export interface TaxTrackItem {
  name: string
  track: string // 과세 방식 요약
  status: string // 현재 설정 기준 상태
  ok: boolean // 현재 설정이 유리한 상태인지
  tip: string
}

export function separateTaxGuide(inp: DiagnoseInput, rules: Rules): TaxTrackItem[] {
  const privLimit = rules.tax.privatePension.annualLimit / 10000
  const withinLimit = inp.retirement.privateAnnual <= privLimit
  const hasNps = inp.incomeSources.some((s) => s.kind === 'public-extra' && s.monthlyAmount > 0)
  const hasAid = inp.incomeSources.some((s) => s.kind === 'mutual-aid' && s.monthlyAmount > 0)
  const housingOn = inp.retirement.housingMonthly > 0
  return [
    {
      name: '사적연금 (연금저축·IRP)',
      track: `연 ${fmtMan(privLimit)} 이하 저율 분리과세 5.5→4.4→3.3% · 초과 시 전액 16.5% 분리 vs 종합 선택`,
      status: withinLimit
        ? `연 ${fmtMan(inp.retirement.privateAnnual)} — 한도 내 저율 적용 ✓`
        : `연 ${fmtMan(inp.retirement.privateAnnual)} — 한도 초과 ⚠ (증액분 실효 ~53%)`,
      ok: withinLimit,
      tip: withinLimit
        ? '한도를 절대 넘기지 않기 (원칙 §9). 부족분은 예비 풀 → 비과세 원금 순서로'
        : `연 수령을 ${fmtMan(privLimit)} 이하로 낮추고 부족분은 예비 풀에서 충당`,
    },
    {
      name: '퇴직수당 → IRP 연금 수령',
      track: '퇴직소득 분류과세(종합 무관) + 연금 수령 시 퇴직소득세 30% 감면 (11년차부터 40%)',
      status: '2038 퇴직 시 적용 예정',
      ok: true,
      tip: '퇴직수당은 일시금 대신 IRP 이전 후 연금으로 — 세액 30~40% 감면 (원칙 §8 로드맵)',
    },
    {
      name: '국민연금·공무원연금 (공적)',
      track: '분리과세 선택지 없음 — 종합과세 트랙 (연금소득공제 적용, 2002년 이후 납입분 과세)',
      status: hasNps ? '공무원연금 + 국민연금 병행 반영 중' : '공무원연금만 반영 중',
      ok: true,
      tip: '다른 종합소득이 없으면 연금소득공제로 실효세율이 낮음. 사적연금 1,500만 한도와 별개 트랙이라 공적연금 때문에 사적 수령을 줄일 필요는 없음',
    },
    {
      name: '교직원공제회 급여금 (분할급여 포함)',
      track: '공제회법상 저율 분리과세 — 금융소득 종합과세(2,000만)·건보 소득(1,000만 문턱)에 미포함',
      status: hasAid ? '분할급여 수입원 등록됨 ✓' : '수입원 미등록 — 예비 풀로만 반영 중',
      ok: true,
      tip: '같은 이자라도 일반 예금은 금융소득 문턱에 포함, 공제회는 제외 — 목돈은 공제회 유지가 문턱 관리에 유리',
    },
    {
      name: 'ISA',
      track: '만기 시 이익 200만(서민형 400만) 비과세 + 초과분 9.9% 분리과세',
      status: '예비 풀에 포함 가정',
      ok: true,
      tip: '만기 자금을 연금저축으로 이전하면 이전액의 10% 추가 세액공제 (3년 사이클, 원칙 §3)',
    },
    {
      name: '주택연금',
      track: '비과세 (대출 성격) — 소득세·건보료 모두 무관',
      status: housingOn ? `월 ${fmtMan(inp.retirement.housingMonthly)} 반영 중 ✓` : '미사용',
      ok: true,
      tip: '수령액이 늘어도 세금·건보에 영향 없음 — 조기 개시 방침(원칙 §9)의 근거 중 하나',
    },
  ]
}

// 갭 분석 요약 (액션 아이템 상단 표시용)
export function gapSummary(r: RetirementResult, endAge: number): string {
  if (r.uncoveredAge) return `${r.uncoveredAge}세부터 목표 생활비 미달 — 재원 부족`
  if (r.poolOutAge) return `${r.poolOutAge}세 예비 풀 고갈, 이후 한도 초과 인출로 충당 (${endAge}세까지 목표는 달성)`
  return `${endAge}세까지 목표 생활비 충당 — 갭 없음`
}
