import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AssetMix, Holding, IncomeSource, RetirementInput } from '../engine/types'
import type { TeacherInput } from '../engine/pension/teacher'
import { AS_OF_SEED, DEFAULT_ASSETS, DEFAULT_RETIREMENT, DEFAULT_TEACHER, HOLD_NOW } from '../engine/defaults'
import { mergeHoldingsByAccount } from '../engine/pension/holdings'

export const now = () => new Date().toISOString()

interface AppState {
  assets: AssetMix[]
  assetsAsOf: string
  init: number
  monthly: number
  years: number
  simAsOf: string
  holdings: Holding[]
  retirement: RetirementInput
  retirementAsOf: string
  teacher: TeacherInput
  teacherAsOf: string
  incomeSources: IncomeSource[]
  incomeSourcesAsOf: string
  scenarios: SavedScenario[]
  financialIncomeAnnual: number // 일반계좌 금융소득 만원/년 (진단·건보용)
  housePrice: number // 주택 시세 만원 (주택연금 월지급금 추정용)
  propertyTaxBase: number // 재산세 과표 만원 (건보·피부양자·재취업 손익 공용)
  diagAsOf: string
  ruleCheckOptIn: boolean // NF-1: 룰 저장소 버전 체크 — 기본 꺼짐, 명시적 활성화
  preset: 'teacher' | 'official' | 'employee' | 'self' // 직업 프리셋 (F-2)
  officialRank: number // 일반직 공무원 계급 (1~9급, preset='official'일 때)
  birthYear: number
  onboarded: boolean // 온보딩 마법사 완료/건너뜀 (F-1.2)
  nps: { avgIncomeMonthly: number; joinYears: number } // 국민연금 간이 추정 입력 (만원/월, 년)
  spouse: SpouseState // 부부 모드 (F-1.3)
  mutualAid: MutualAidState // 교직원 공제회 (전용 탭)
  mutualAidAsOf: string
  setAssets: (a: AssetMix[]) => void
  resetAssets: () => void
  setSim: (p: Partial<Pick<AppState, 'init' | 'monthly' | 'years'>>) => void
  setHoldings: (h: Holding[]) => void
  patchHolding: (i: number, p: Partial<Holding>) => void
  setRetirement: (p: Partial<RetirementInput>) => void
  setTeacher: (p: Partial<TeacherInput>) => void
  setIncomeSources: (s: IncomeSource[]) => void
  setDiag: (p: Partial<Pick<AppState, 'financialIncomeAnnual' | 'propertyTaxBase' | 'housePrice'>>) => void
  setRuleCheckOptIn: (v: boolean) => void
  setProfile: (p: Partial<Pick<AppState, 'preset' | 'officialRank' | 'birthYear' | 'onboarded'>>) => void
  setNps: (p: Partial<AppState['nps']>) => void
  setSpouse: (p: Partial<SpouseState>) => void
  setMutualAid: (p: Partial<MutualAidState>) => void
  saveScenario: (name: string) => void
  loadScenario: (id: string) => void
  deleteScenario: (id: string) => void
}

export interface MutualAidState {
  queriedTotal: number // The-K 조회 예상 총 급여금 세후 (만) — 원금+이자−세금 포함된 값
  queriedBaseDate: string // 조회의 '추정 기준일' (그 시점까지 납입 가정한 추정)
  monthlyContribution: number // 계획 월 납입 (만) — 앞으로 낼 금액
  queriedMonthlyContribution?: number // 조회 당시 월 납입 (만) — The-K 추정이 가정한 납입액. 계획과 다르면 차액을 반영
  accrualRatePct: number // 적립 급여율 (연 %, 변동) — 연장 구간 계산용
  payoutYears: number // 분할급여 수령 기간 (년)
  payoutRatePct: number // 분할급여율 (연 %, 변동)
}

export interface SpouseState {
  enabled: boolean
  isEmployee: boolean // 배우자 직장가입(재직) 여부
  monthlySalary: number // 만원/월 (직장일 때)
  publicPensionAnnual: number // 만원/년
  privatePensionAnnual: number // 만원/년
  propertyTaxBase: number // 만원 (배우자 명의 재산 과표)
}

export interface SavedScenario {
  id: string
  name: string
  savedAt: string
  retirement: RetirementInput
  incomeSources: IncomeSource[]
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      assets: structuredClone(DEFAULT_ASSETS),
      assetsAsOf: AS_OF_SEED,
      init: 1000,
      monthly: 50,
      years: 10,
      simAsOf: AS_OF_SEED,
      holdings: structuredClone(HOLD_NOW),
      retirement: structuredClone(DEFAULT_RETIREMENT),
      retirementAsOf: AS_OF_SEED,
      teacher: structuredClone(DEFAULT_TEACHER),
      teacherAsOf: AS_OF_SEED,
      setAssets: (assets) => set({ assets, assetsAsOf: now() }),
      resetAssets: () =>
        set({ assets: structuredClone(DEFAULT_ASSETS), init: 1000, monthly: 50, years: 10, assetsAsOf: now() }),
      setSim: (p) => set({ ...p, simAsOf: now() }),
      setHoldings: (holdings) => set({ holdings }),
      patchHolding: (i, p) =>
        set((s) => ({
          holdings: s.holdings.map((h, j) => (j === i ? { ...h, ...p, asOf: now() } : h)),
        })),
      setRetirement: (p) =>
        set((s) => ({ retirement: { ...s.retirement, ...p }, retirementAsOf: now() })),
      setTeacher: (p) => set((s) => ({ teacher: { ...s.teacher, ...p }, teacherAsOf: now() })),
      incomeSources: [],
      incomeSourcesAsOf: AS_OF_SEED,
      scenarios: [],
      financialIncomeAnnual: 0,
      propertyTaxBase: 20000,
      housePrice: 0, // 주택 시세 (만) — 주택연금 월지급금 추정용

      diagAsOf: AS_OF_SEED,
      setIncomeSources: (incomeSources) => set({ incomeSources, incomeSourcesAsOf: now() }),
      setDiag: (p) => set({ ...p, diagAsOf: now() }),
      ruleCheckOptIn: false,
      setRuleCheckOptIn: (ruleCheckOptIn) => set({ ruleCheckOptIn }),
      preset: 'teacher',
      officialRank: 7,
      birthYear: 1970,
      onboarded: false,
      nps: { avgIncomeMonthly: 300, joinYears: 20 },
      spouse: { enabled: false, isEmployee: false, monthlySalary: 0, publicPensionAnnual: 0, privatePensionAnnual: 0, propertyTaxBase: 0 },
      setProfile: (p) => set(p),
      setNps: (p) => set((s) => ({ nps: { ...s.nps, ...p } })),
      setSpouse: (p) => set((s) => ({ spouse: { ...s.spouse, ...p } })),
      // accrualRatePct는 변동금리 — The-K 공시 장기저축급여율로 갱신할 것. 분할급여율(payoutRatePct)과 별개
      mutualAid: { queriedTotal: 0, queriedBaseDate: '', monthlyContribution: 30, accrualRatePct: 4.95, payoutYears: 10, payoutRatePct: 3.8 },
      mutualAidAsOf: AS_OF_SEED,
      setMutualAid: (p) => set((s) => ({ mutualAid: { ...s.mutualAid, ...p }, mutualAidAsOf: now() })),
      saveScenario: (name) =>
        set((s) => ({
          scenarios: [
            ...s.scenarios,
            {
              id: crypto.randomUUID(),
              name,
              savedAt: now(),
              retirement: structuredClone(s.retirement),
              incomeSources: structuredClone(s.incomeSources),
            },
          ],
        })),
      loadScenario: (id) =>
        set((s) => {
          const sc = s.scenarios.find((x) => x.id === id)
          if (!sc) return {}
          return {
            retirement: structuredClone(sc.retirement),
            incomeSources: structuredClone(sc.incomeSources),
            retirementAsOf: now(),
            incomeSourcesAsOf: now(),
          }
        }),
      deleteScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),
    }),
    { name: 'pension-compass-v1' },
  ),
)

// JSON 내보내기/가져오기 — 개인 데이터는 파일로만 이동 (외부 전송 없음, NF-1)
export function exportJSON(): string {
  const s = useStore.getState()
  return JSON.stringify(
    {
      app: 'pension-compass',
      schema: 1,
      exportedAt: now(),
      data: {
        assets: s.assets,
        assetsAsOf: s.assetsAsOf,
        init: s.init,
        monthly: s.monthly,
        years: s.years,
        simAsOf: s.simAsOf,
        holdings: s.holdings,
        retirement: s.retirement,
        retirementAsOf: s.retirementAsOf,
        teacher: s.teacher,
        teacherAsOf: s.teacherAsOf,
        incomeSources: s.incomeSources,
        incomeSourcesAsOf: s.incomeSourcesAsOf,
        scenarios: s.scenarios,
        financialIncomeAnnual: s.financialIncomeAnnual,
        housePrice: s.housePrice,
        propertyTaxBase: s.propertyTaxBase,
        diagAsOf: s.diagAsOf,
        preset: s.preset,
        officialRank: s.officialRank,
        birthYear: s.birthYear,
        onboarded: s.onboarded,
        nps: s.nps,
        spouse: s.spouse,
        mutualAid: s.mutualAid,
        mutualAidAsOf: s.mutualAidAsOf,
      },
    },
    null,
    2,
  )
}

export function importJSON(text: string): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.app !== 'pension-compass' || !parsed?.data)
      return { ok: false, error: '연금나침반 내보내기 파일이 아닙니다' }
    const d = parsed.data
    // 부분 가져오기: 동기화 스크립트가 만든 계좌 단위 병합 파일
    if (d.holdingsMerge) {
      const m = d.holdingsMerge as { acct: Holding['acct']; rows: Holding[] }[]
      if (!Array.isArray(m)) return { ok: false, error: 'holdingsMerge 구조 오류' }
      let holdings = useStore.getState().holdings
      for (const g of m) holdings = mergeHoldingsByAccount(holdings, g.acct, g.rows)
      useStore.setState({ holdings })
      return { ok: true }
    }
    if (!Array.isArray(d.assets) || !Array.isArray(d.holdings) || typeof d.retirement !== 'object')
      return { ok: false, error: '파일 구조가 올바르지 않습니다' }
    useStore.setState(d)
    return { ok: true }
  } catch {
    return { ok: false, error: 'JSON 파싱 실패' }
  }
}
