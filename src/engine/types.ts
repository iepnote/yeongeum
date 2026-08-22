export interface AssetMix {
  name: string
  preset: string
  w: number // 비중 입력값 (합계 기준 자동 100% 환산)
  mu: number // 기대수익 %/년
  vol: number // 변동성 %/년
}

export type AcctKind = '연금저축' | 'IRP'
export type HoldingCls = 'eq' | 'trf' | 'safe'

export interface Holding {
  acct: AcctKind
  name: string
  cls: HoldingCls
  amt: number // 만원 — 주수·현재가 미입력 시 직접 입력값
  sh: number // 보유 주수 (0 = 금액 직접 입력 모드)
  buy: number // 평균단가(원)
  cur: number // 현재가(원)
  asOf: string // ISO 날짜 — F-10 신선도 시스템용
}

// 수입원 5속성 모델 (F-5): 종류/금액/기간/물가연동/과세유형(종류가 결정)
// public-extra: 국민연금 등 추가 공적연금 — 공무원연금과 병행 수령 (물가연동, 세전≈세후 근사)
// mutual-aid: 교직원 공제회 분할급여 — 저율·비과세 근사, 기간 지정형
export type IncomeKind = 'rent-housing' | 'rent-commercial' | 'work' | 'other' | 'public-extra' | 'mutual-aid'
export interface IncomeSource {
  id: string
  label: string
  kind: IncomeKind
  monthlyAmount: number // 만원/월, 세전, startAge 기준
  startAge: number
  endAge: number | null // null = 종신
  inflationLinked: boolean
}

export interface RetirementInput {
  startAge: number // 은퇴 나이 (63)
  endAge: number // 95
  targetMonthly: number // 목표 생활비 만원/월, startAge(은퇴년) 기준 — 엔진 사용값
  targetMonthlyToday?: number // 목표 생활비 만원/월, 현재(입력 시점) 기준 — UI 입력용, 물가 환산해 targetMonthly로 동기화
  inflFactorToRetire?: number // 현재→은퇴년 물가 배율 (판정용 현재가치 환산에 사용, 기본 1) — UI가 동기화
  publicStartAge?: number // 공적연금(주 재원) 개시 나이 — 미지정 시 rules.pensionOpenAge.publicPension
  privateStartAge?: number // 사적연금 인출 개시 나이 — 미지정 시 startAge(은퇴 즉시). 개시 전에는 운용만
  sweepSurplus?: boolean // 잉여 생활비(목표 초과 수입)를 예비 풀에 적립 — 기본 false(버리는 셈, 보수적)
  inflation: number // %/년
  publicMonthly: number // 공적연금 만원/월 (개시연령부터, 물가연동)
  potInitial: number // 사적연금 잔액 만원 (startAge 시점)
  privateAnnual: number // 사적 연수령 만원/년 (한도 이하 유지 전제)
  potReturn: number // 사적연금 운용 %/년
  housingMonthly: number // 주택연금 만원/월 (명목 고정)
  housingStartAge: number
  reservePool: number // 예비 풀(공제회+ISA) 만원
}

// 한계 구간표: 직전 구간 상한 초과 ~ upTo(null=무한대) 구간에 rate 적용 — 소득세율·연금소득공제 공용
export interface MarginalBracket {
  upTo: number | null
  rate: number
}

export interface PropertyGrade {
  maxTaxBase: number | null // 구간 상한(원) — 기본공제 후 금액 기준. null = 최종 등급
  points: number
}

export interface NhisRules {
  healthRate: number
  ltcRateOfHealth: number
  regional: {
    pensionIncomeRatio: number
    workIncomeRatio: number
    privatePensionIncluded: boolean
    housingPensionIncluded: boolean
    financialIncomeThreshold: number // 초과 시 전액 반영 (절벽)
    propertyBasicDeduction: number
    pointValueKRW: number
    propertyGrades: PropertyGrade[]
  }
  employee: {
    employeeShare: number
    propertyLevied: boolean
    sideIncomeThreshold: number // 보수외소득 문턱 — 초과분에만 소득월액보험료
    sideIncomePensionRatio: number
  }
  voluntaryContinuation: { maxMonths: number }
  dependent: {
    incomeLimit: number
    pensionCountRatio: number // 판정은 연금 100% 반영 (부과 시 50%와 다름 — 혼동 주의)
    propertyLimit: number
  }
}

export interface TeacherPensionRules {
  accrualRatePerYear: number // 지급률 0.017/년
  contributionRate: number // 일반기여금율 0.09
  serviceYearsCap: number // 재직기간 산입 상한 36년
  openAgeByRetireYear: { retireYearFrom: number; age: number }[] // retireYearFrom 내림차순
}

// 공무원연금 지급정지(소득심사) — 초과소득월액 구간별 정지율, 상한 = 연금월액 × maxRatio
export interface PensionSuspensionRules {
  avgPensionMonthly: number // 전년도 평균연금월액 (원, 연 1회 고시)
  brackets: MarginalBracket[] // 초과소득월액 누진 정지율 (원 단위)
  maxRatio: number // 0.5
}

export interface Rules {
  year: number
  tax: {
    privatePension: {
      annualLimit: number
      lowRateByAge: { minAge: number; rate: number }[] // minAge 내림차순, 지방소득세 포함
      overLimitRate: number // 지방소득세 포함 (16.5%)
    }
    financialIncome: { comprehensiveThreshold: number; withholdingRate: number } // 원천 14% (지방 별도 가산)
    comprehensive: {
      localSurtax: number // 지방소득세 가산율 (0.1)
      basicPersonalDeduction: number // 본인 기본공제 — 다른 종합소득 없을 때 근사용
      brackets: MarginalBracket[] // 종합소득세 기본세율 (지방 미포함)
    }
    pensionIncomeDeduction: { cap: number; brackets: MarginalBracket[] }
    rent: { housingExpenseRatio: number; commercialExpenseRatio: number; rate: number } // 분리과세 근사 (지방 포함)
    otherIncome: { expenseRatio: number; rate: number } // 기타소득 원천 22% (지방 포함), 필요경비 60%
    workIncomeDeduction: { brackets: MarginalBracket[] } // 근로소득공제 — 지급정지 소득월액 산정용
  }
  nhis: NhisRules
  pensionOpenAge: { publicPension: number; privatePensionEarliest: number }
  publicPensionNps: {
    aValueMonthly: number // 전체 가입자 평균소득월액 (연 1회 고시)
    replacementConstant: number // 1.2 (소득대체율 40% 기준)
    openAgeByBirthYear: { birthYearFrom: number; age: number }[] // 내림차순
  }
  publicPensionTeacher: TeacherPensionRules
  pensionSuspension: PensionSuspensionRules
  mutualAid: { defaultRatePct: number } // 공제회 분할급여율 기본값 (변동금리 — UI에서 수정 가능)
  housingPension: {
    ages: number[] // 오름차순 (부부 중 연소자 기준)
    priceEok: number[] // 주택가격 열 (억, 오름차순)
    monthlyThousandWon: number[][] // [ageIdx][priceIdx] 월지급금 (천원)
  }
  account: { irpRiskLimit: number; trfEquityFactor: number }
}
