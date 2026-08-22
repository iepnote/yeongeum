import type { Holding } from './types'

// F-10 데이터 신선도: 시세 7일 / 공단 조회값 12개월 / 룰 12개월 초과 시 stale
export interface FreshnessItem {
  id: 'price' | 'query' | 'rules'
  label: string
  ageDays: number | null // null = 데이터 없음
  limitDays: number
  stale: boolean
  detail: string
}

export function daysSince(iso: string | undefined | null, nowIso: string): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.parse(nowIso) - t) / 86_400_000))
}

export function computeFreshness(args: {
  nowIso: string
  holdings: Holding[]
  pensionQueriedAt?: string
  rulesYear: number
}): FreshnessItem[] {
  const { nowIso, holdings, pensionQueriedAt, rulesYear } = args
  // 시세: 가장 오래된 보유 행 기준 (가장 낡은 데이터가 전체를 결정)
  const oldest = holdings.reduce<number | null>((acc, h) => {
    const d = daysSince(h.asOf, nowIso)
    return d === null ? acc : Math.max(acc ?? 0, d)
  }, null)
  const priceStale = oldest === null || oldest > 7
  const queryAge = daysSince(pensionQueriedAt, nowIso)
  const queryStale = queryAge === null || queryAge > 365
  const nowYear = new Date(nowIso).getUTCFullYear()
  const rulesStale = nowYear > rulesYear
  return [
    {
      id: 'price', label: '시세', ageDays: oldest, limitDays: 7, stale: priceStale,
      detail: oldest === null ? '보유 없음' : `${oldest}일 전`,
    },
    {
      id: 'query', label: '연금 조회값', ageDays: queryAge, limitDays: 365, stale: queryStale,
      detail: queryAge === null ? '미입력' : queryAge < 31 ? `${queryAge}일 전` : `${Math.floor(queryAge / 30)}개월 전`,
    },
    {
      id: 'rules', label: `룰 ${rulesYear}`, ageDays: null, limitDays: 365, stale: rulesStale,
      detail: rulesStale ? `${nowYear}년 룰 확인 필요` : '최신',
    },
  ]
}

// 연 1회 갱신 체크리스트 (F-10 계층 4 완화 — M4.5 완료 기준)
export interface ChecklistEntry {
  label: string
  where: string
  url?: string
  urgent: boolean // stale 항목이면 true
}

export function updateChecklist(items: FreshnessItem[]): ChecklistEntry[] {
  const stale = (id: FreshnessItem['id']) => items.find((x) => x.id === id)?.stale ?? true
  return [
    { label: '보유 종목 현재가·평가액 갱신', where: '증권사 앱 잔고 화면 (또는 KIS 동기화 스크립트)', urgent: stale('price') },
    { label: '공무원연금 예상연금 재조회 → 교사 프리셋 보정 입력', where: '공무원연금공단 내연금보기', url: 'https://www.geps.or.kr', urgent: stale('query') },
    { label: '세법·건보 룰 기준연도 확인', where: '앱 룰 배지 / 저장소 룰 업데이트 확인', urgent: stale('rules') },
    { label: '주택 공시가격 확인 → 재산 과표 갱신', where: '부동산공시가격알리미', url: 'https://www.realtyprice.kr', urgent: false },
    { label: '주택연금 예상액 재조회', where: '한국주택금융공사 예상연금 조회', url: 'https://www.hf.go.kr', urgent: false },
    { label: '공제회 잔액·급여율 확인 → 예비 풀 갱신', where: '교직원공제회 앱', urgent: false },
  ]
}
