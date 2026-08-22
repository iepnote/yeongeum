import type { IncomeSource, RetirementInput, Rules } from '../types'
import { annuityMonthly } from '../pension/annuity'
import { projectMutualAid } from '../pension/mutualAidFund'
import { estimateHousingPension } from '../pension/housingPension'
import { retentionProbability, simulateRetirement, type RetirementResult } from '../pension/retirement'

// 종합 의견 (F-9 확장) — 대안 시나리오를 실제로 시뮬레이션해 수치 근거가 있는 제안을 생성.
// 규칙 기반 정보 제공용이며 투자자문이 아님. 조정 불가 항목(공적연금)과 조정 레버를 구분해 안내한다.
export interface Advice {
  kind: 'action' | 'good' | 'info'
  text: string
}

// 결과 우열 비교: 미달 없음 > 미달 늦음 > 풀 고갈 늦음 > 85세 잔여 큼
function score(r: RetirementResult): number {
  return (r.uncoveredAge ?? 200) * 1_000_000 + (r.poolOutAge ?? 200) * 1_000 + Math.min((r.bal85 ?? 0) / 1000, 999)
}

const ageText = (r: RetirementResult) => (r.uncoveredAge ? `${r.uncoveredAge}세부터 목표 미달` : '끝까지 목표 달성')

export function adviseRetirement(args: {
  retirement: RetirementInput
  incomeSources: IncomeSource[]
  mutualAidTotal: number // 퇴직 시 총 급여금 (만, 0 = 미설정)
  payoutRatePct: number
  rules: Rules
  // 재직 중 납입 증액 테스트용 (선택): 퇴직까지 남은 개월·적립 급여율
  mutualAidPlan?: { monthsToRetire: number; accrualRatePct: number; currentMonthly?: number }
  housePrice?: number // 주택 시세 (만) — 주택연금 상한 초과 시 이주 시나리오 비교용
}): Advice[] {
  const { retirement, incomeSources, mutualAidTotal, payoutRatePct, rules, mutualAidPlan, housePrice } = args
  const out: Advice[] = []
  const base = simulateRetirement(retirement, rules, incomeSources)
  const pubStart = retirement.publicStartAge ?? rules.pensionOpenAge.publicPension

  // 0. 프레이밍: 조정 불가 vs 조정 레버
  out.push({
    kind: 'info',
    text: `공무원연금·국민연금은 금액을 조정할 수 없는 고정 재원입니다. 설계에서 움직일 수 있는 레버는 ① 공제회 분할 기간 ② 사적연금 연 수령액(한도 내) ③ 주택연금 ④ 목표 생활비 — 아래 제안은 이 순서로 검토했습니다.`,
  })

  // 1. 공백기 구조
  const gapRows = base.rows.filter((r) => r.age < pubStart)
  if (gapRows.length) {
    const avgDraw = gapRows.reduce((a, r) => a + r.poolDraw, 0) / gapRows.length
    if (avgDraw > 1)
      out.push({
        kind: 'info',
        text: `공백기(${retirement.startAge}~${pubStart - 1}세)에는 공적연금이 없어 월평균 ${Math.round(avgDraw)}만원을 예비 풀에서 인출합니다. 공제회 분할급여가 이 구간을 받쳐줄수록 예비 풀이 오래 갑니다.`,
      })
  }

  // 1.5 잉여 구간 — 목표 초과 수입: 스윕을 켜지 않으면 시뮬은 남는 돈을 버리는 셈으로 계산한다
  const incomeOf = (r: RetirementResult['rows'][number]) => r.pub + r.extraPublic + r.priv + r.hpm + r.mutualAid + r.extra
  const surplusRows = base.rows.filter((r) => incomeOf(r) > r.tgt + 0.5)
  const totalSurplus = surplusRows.reduce((a, r) => a + (incomeOf(r) - r.tgt) * 12, 0)
  if (totalSurplus > 1000 && !retirement.sweepSurplus) {
    const alt = simulateRetirement({ ...retirement, sweepSurplus: true }, rules, incomeSources)
    out.push({
      kind: 'action',
      text: `${surplusRows[0].age}~${surplusRows[surplusRows.length - 1].age}세에는 월수입이 목표 생활비를 넘습니다 — 잉여 합계 약 ${Math.round(totalSurplus).toLocaleString('ko-KR')}만. 지금 시뮬레이션은 이 남는 돈을 전부 써버리는 것으로 가정하고 있어, 초반 현금흐름을 키우는 조치(공제회 증액·분할 단축 등)가 후반 부족 구간에 닿지 않는 것처럼 보입니다. 시뮬레이터의 "잉여 생활비를 예비 풀로 적립"을 켜면(남는 달 수입을 ISA 등 분리과세 계좌에 모으는 가정) "${ageText(base)}" → "${ageText(alt)}"${alt.poolOutAge !== base.poolOutAge ? ` (예비 풀 고갈 ${base.poolOutAge ?? '없음'} → ${alt.poolOutAge ?? '없음'}세)` : ''}. 실제로도 남는 달 수입은 ISA → 연금계좌 순서로 재투자하는 것이 원칙(§3)과 맞습니다.`,
    })
  }

  // 2. 공제회 분할 기간 스캔 (5/10/15/20년) — 총액이 설정된 경우
  if (mutualAidTotal > 0) {
    const current = incomeSources.find((s) => s.kind === 'mutual-aid')
    const currentYears = current && current.endAge !== null ? current.endAge - current.startAge + 1 : null
    const candidates = [5, 10, 15, 20]
    const results = candidates.map((y) => {
      const src: IncomeSource = {
        id: 'scan',
        label: '공제회',
        kind: 'mutual-aid',
        monthlyAmount: annuityMonthly(mutualAidTotal, payoutRatePct, y),
        startAge: retirement.startAge,
        endAge: retirement.startAge + y - 1,
        inflationLinked: false,
      }
      const extras = [...incomeSources.filter((s) => s.kind !== 'mutual-aid'), src]
      return {
        y,
        monthly: src.monthlyAmount,
        r: simulateRetirement(retirement, rules, extras),
        // 미달·고갈 동률일 때의 판정: 변동성 반영 유지 확률 (짧은 분할의 초기 현금흐름 방어 효과 포착)
        retained: retentionProbability(retirement, rules, extras, { runs: 400 }).probRetained,
      }
    })
    const best = results.reduce((a, b) =>
      score(b.r) > score(a.r) || (score(b.r) === score(a.r) && b.retained > a.retained) ? b : a,
    )
    const currentResult = currentYears ? results.find((x) => x.y === currentYears) : null
    if (currentYears === null)
      out.push({
        kind: 'action',
        text: `공제회 분할급여가 아직 수령기에 반영되지 않았습니다. 총 ${(mutualAidTotal / 10000).toFixed(2)}억을 ${best.y}년 분할(월 ${Math.round(best.monthly)}만)로 반영하면 ${ageText(best.r)} — 비교한 기간(5/10/15/20년) 중 가장 유리합니다.`,
      })
    else if (
      best.y !== currentYears &&
      currentResult &&
      (score(best.r) > score(currentResult.r) || (score(best.r) === score(currentResult.r) && best.retained > currentResult.retained + 1))
    )
      out.push({
        kind: 'action',
        text: `공제회 분할 기간을 ${currentYears}년 → ${best.y}년으로 바꾸면 월 ${Math.round(currentResult.monthly)}만 → ${Math.round(best.monthly)}만이 됩니다. 수령기 전체로는 "${ageText(currentResult.r)}" → "${ageText(best.r)}", ${retirement.endAge}세 유지 확률 ${currentResult.retained.toFixed(0)}% → ${best.retained.toFixed(0)}% (기간별: ${results.map((x) => `${x.y}년 ${x.retained.toFixed(0)}%`).join(' · ')}).`,
      })
    else
      out.push({
        kind: 'good',
        text: `공제회 분할 기간 ${currentYears}년은 비교한 대안 중 유리한 설정입니다 (${ageText(currentResult?.r ?? base)}, 유지 확률 기간별: ${results.map((x) => `${x.y}년 ${x.retained.toFixed(0)}%`).join(' · ')}).`,
      })
    // 명목 이자 착시 방지 프레이밍
    const realRatePct = ((1 + payoutRatePct / 100) / (1 + retirement.inflation / 100) - 1) * 100
    out.push({
      kind: 'info',
      text: `분할 기간이 길수록 명목 이자는 커 보이지만(20년 시 이자 ${Math.round(annuityMonthly(mutualAidTotal, payoutRatePct, 20) * 240 - mutualAidTotal).toLocaleString('ko-KR')}만), 물가를 빼면 실질 이율은 연 약 ${realRatePct.toFixed(1)}%입니다. 기간 선택은 이자 극대화가 아니라 초기 현금흐름(하락장 방어)과 문턱 관리 관점으로 하세요. 남는 현금의 재투자는 ISA 등 분리과세가 유지되는 계좌를 우선하고, 일반계좌 재투자는 금융소득 문턱(건보 1,000만·종합 2,000만)에 노출됩니다.`,
    })
  } else {
    out.push({ kind: 'info', text: '교직원 공제회 탭에서 The-K 조회 총 급여금을 입력하면 분할 기간별 비교 제안을 받을 수 있습니다.' })
  }

  // 3. 사적연금 한도 여유
  const privLimit = rules.tax.privatePension.annualLimit / 10000
  if (retirement.privateAnnual < privLimit) {
    const alt = simulateRetirement({ ...retirement, privateAnnual: privLimit }, rules, incomeSources)
    if (score(alt) > score(base))
      out.push({
        kind: 'action',
        text: `사적연금 연 수령이 ${retirement.privateAnnual.toLocaleString('ko-KR')}만으로 저율 한도(${privLimit.toLocaleString('ko-KR')}만)까지 ${(privLimit - retirement.privateAnnual).toLocaleString('ko-KR')}만 여유가 있습니다. 한도까지 올리면 "${ageText(base)}" → "${ageText(alt)}" (세율 증가 없음).`,
      })
  } else {
    out.push({ kind: 'good', text: `사적연금 연 수령 ${retirement.privateAnnual.toLocaleString('ko-KR')}만 — 저율 한도를 정확히 채워 쓰고 있습니다 (초과 시 16.5%라 더 올리는 것은 비추천).` })
  }

  // 3.5 사적연금 개시 시점 — 늦출수록 운용수익은 쌓이지만 공백기 예비 풀 소진과 맞바꿈: 실계산 비교
  const privStart = retirement.privateStartAge ?? retirement.startAge
  if (retirement.potInitial > 0 && privStart < pubStart) {
    const alt = simulateRetirement({ ...retirement, privateStartAge: pubStart }, rules, incomeSources)
    const better = score(alt) > score(base)
    out.push({
      kind: better ? 'action' : 'info',
      text: `사적연금 개시를 ${privStart}세 → ${pubStart}세(공적연금 개시)로 늦추는 경우를 계산해 보면: "${ageText(base)}" → "${ageText(alt)}"${base.poolOutAge || alt.poolOutAge ? ` (예비 풀 고갈 ${base.poolOutAge ?? '없음'} → ${alt.poolOutAge ?? '없음'}세)` : ''}. ${better ? '늦추는 동안 운용수익이 쌓여 현재 가정에서는 늦추는 쪽이 유리합니다.' : '늦추면 공백기를 예비 풀이 전부 떠받쳐야 해서 현재 가정에서는 유리하지 않습니다 — "늦게 꺼낼수록 좋다"는 운용수익률이 충분히 높고 공백기를 받칠 다른 재원이 있을 때만 성립합니다.'} 저율 한도(연 1,500만)는 늦춰도 그대로라, 너무 늦추면 잔액이 커져 한도 초과 인출(16.5%)이 생길 수 있는 점도 함께 보세요.`,
    })
  }

  // 4. 주택연금 미사용
  if (retirement.housingMonthly <= 0 && base.uncoveredAge)
    out.push({
      kind: 'action',
      text: `주택연금이 미사용 상태이고 ${base.uncoveredAge}세부터 목표 미달이 예상됩니다. 자가가 있다면 주택연금(비과세·종신)이 가장 큰 미활용 레버입니다 — 주택금융공사에서 예상액을 조회해 추가 수입원 탭에 넣어 보세요.`,
    })

  // 4.3 주택연금 가격 상한 초과 — 이주(다운사이징) 시나리오를 실계산해 비교
  const capMan = rules.housingPension.priceEok[rules.housingPension.priceEok.length - 1] * 10000
  if (housePrice && housePrice > capMan) {
    const excess = housePrice - capMan
    const freed = Math.round(excess * 0.9) // ponytail: 취득세·중개비·양도세 뭉뚱그려 10% 차감 — 정밀 계산은 세무 상담
    const alt = simulateRetirement({ ...retirement, reservePool: retirement.reservePool + freed }, rules, incomeSources)
    out.push({
      kind: score(alt) > score(base) ? 'action' : 'info',
      text: `지금 주택 시세(${(housePrice / 10000).toFixed(1)}억)가 주택연금 상한 ${capMan / 10000}억을 넘습니다. 초과분 ${(excess / 10000).toFixed(1)}억은 주택연금 월지급금을 한 푼도 늘리지 못하는 잠긴 자산입니다. ${capMan / 10000}억 이하 주택으로 옮기면 월지급금은 그대로 두고 차액을 목돈으로 꺼낼 수 있습니다 — 거래비용·세금을 10% 잡아 약 ${freed.toLocaleString('ko-KR')}만을 예비 풀에 넣는 것으로 계산하면 "${ageText(base)}" → "${ageText(alt)}"${alt.poolOutAge && base.poolOutAge ? ` (예비 풀 고갈 ${base.poolOutAge}세 → ${alt.poolOutAge}세)` : ''}. 단 실제로는 취득세·중개수수료·양도세(12억 초과 양도차익 과세)와 이사에 따른 생활 변화까지 따져야 하니, 방향 참고용으로만 쓰세요.`,
    })
    const finThr = Math.round((rules.nhis.regional.financialIncomeThreshold as number) / 10000)
    const compThr = Math.round(rules.tax.financialIncome.comprehensiveThreshold / 10000)
    out.push({
      kind: 'info',
      text: `이주로 생긴 목돈을 굴릴 때는 수익의 "형태"가 건보·세금을 결정합니다. 이자·배당은 합산 연 ${finThr.toLocaleString('ko-KR')}만 초과 시 전액이 지역건보 소득에 반영되는 절벽이고, ${compThr.toLocaleString('ko-KR')}만 초과분은 종합과세에 합산됩니다. 반면 주식·ETF 양도차익은 건보·종합과세 모두 무관하며(국내 상장주식 양도차익은 비과세), ISA 안의 수익·연금계좌 추가납입(연 1,800만)·공제회 증좌는 문턱 밖입니다. 순서는 ISA → 연금계좌 → 저분배(양도차익 중심) 상품이 문턱 관리에 유리하고, 이자·배당형만으로 수억대를 굴리면 두 문턱을 모두 건드리기 쉽습니다. 부동산 → 금융자산 전환은 지역건보 재산분 보험료를 낮추는 부수 효과도 있습니다. 진단 리포트의 "일반계좌 금융소득" 칸에 예상 이자·배당을 넣으면 문턱 경고가 자동으로 뜹니다.`,
    })
  }

  // 4.35 주택연금 개시 나이 스캔 — 늦게 가입할수록 월지급금이 커지지만(표), 명목 고정이라 물가 침식과
  // 잉여 적립(스윕) 여부에 따라 유불리가 갈린다. 판정은 공제회 스캔과 동일: score + 유지 확률 타이브레이크
  if (housePrice && housePrice > 0 && retirement.housingMonthly > 0) {
    // 현재 설정은 항상 비교 기준으로 포함 — 개시 나이가 시뮬 범위 밖(예: 55세)이어도 크래시 없이 동작
    const altAges = [retirement.startAge, 65, 70, 75].filter(
      (a, i, arr) => arr.indexOf(a) === i && a !== retirement.housingStartAge && a >= retirement.startAge && a < retirement.endAge,
    )
    const cands = [retirement.housingStartAge, ...altAges]
    const scanned = cands.map((age) => {
      const hpm = age === retirement.housingStartAge ? retirement.housingMonthly : Math.round(estimateHousingPension(housePrice, age, rules))
      const alt = { ...retirement, housingMonthly: hpm, housingStartAge: age }
      return {
        age, hpm,
        r: simulateRetirement(alt, rules, incomeSources),
        retained: retentionProbability(alt, rules, incomeSources, { runs: 400 }).probRetained,
      }
    })
    const curHp = scanned.find((x) => x.age === retirement.housingStartAge)!
    const bestHp = scanned.reduce((a, b) =>
      score(b.r) > score(a.r) || (score(b.r) === score(a.r) && b.retained > a.retained) ? b : a,
    )
    const byAge = scanned.map((x) => `${x.age}세 ${Math.round(x.hpm)}만·유지 ${x.retained.toFixed(0)}%`).join(' · ')
    // 개시 나이가 시뮬 시작보다 이르면: 지급은 어차피 시작 나이부터인데 월액만 이른 가입 기준으로 낮게 잡힌 상태
    const preStartNote =
      curHp.age < retirement.startAge
        ? ` 참고: 현재 개시 나이(${curHp.age}세)가 시뮬 시작(${retirement.startAge}세)보다 일러서, 시뮬에는 ${retirement.startAge}세부터 반영되면서 월지급금만 ${curHp.age}세 가입 기준으로 낮게 잡혀 있습니다. ${curHp.age}세부터의 수령을 실제로 보려면 시뮬 시작 나이를 낮추세요.`
        : ''
    if (bestHp.age !== curHp.age && (score(bestHp.r) > score(curHp.r) || bestHp.retained > curHp.retained + 1))
      out.push({
        kind: 'action',
        text: `주택연금 개시 나이를 ${curHp.age}세 → ${bestHp.age}세로 바꾸면 월지급금 ${Math.round(curHp.hpm)}만 → ${Math.round(bestHp.hpm)}만(시세 ${(housePrice / 10000).toFixed(1)}억 기준), 결과 "${ageText(curHp.r)}" → "${ageText(bestHp.r)}", ${retirement.endAge}세 유지 확률 ${curHp.retained.toFixed(0)}% → ${bestHp.retained.toFixed(0)}% (나이별: ${byAge}).${preStartNote} 늦출수록 표상 월액은 커지지만 명목 고정이라 물가에 깎이고, ${retirement.sweepSurplus ? '잉여 적립이 켜져 있어 일찍 받아 쌓는 효과도 함께 계산된 결과입니다' : '잉여 적립을 켜면 조기 개시의 남는 수입도 계산에 들어와 결과가 달라질 수 있습니다'}. 월지급금은 현재 시세·현행 표 기준 추정이라 실제 가입 시점에 재산출됩니다.`,
      })
    else if (scanned.length > 1)
      out.push({
        kind: 'good',
        text: `주택연금 개시 ${curHp.age}세는 비교한 개시 나이(${byAge}) 중 가장 유리한 설정입니다.${preStartNote}`,
      })
  }

  // 4.4 공백기 보조: 주택연금 조기 개시 실계산 — 공제회 분할과의 역할 구분 (시세 입력 시)
  if (housePrice && housePrice > 0 && retirement.housingMonthly <= 0) {
    const hpm = Math.round(estimateHousingPension(housePrice, retirement.startAge, rules))
    if (hpm > 0) {
      const withHp = simulateRetirement({ ...retirement, housingMonthly: hpm, housingStartAge: retirement.startAge }, rules, incomeSources)
      const maSrc = incomeSources.find((s) => s.kind === 'mutual-aid')
      out.push({
        kind: score(withHp) > score(base) ? 'action' : 'info',
        text: `퇴직 직후 부족분 보조 비교 — 지금 설계(${maSrc ? `공제회 분할 ${Math.round(maSrc.monthlyAmount)}만/월${maSrc.endAge !== null ? `, ${maSrc.endAge - maSrc.startAge + 1}년` : ''}` : '공제회 미반영'} · 주택연금 없음)는 "${ageText(base)}"${base.poolOutAge ? `, 예비 풀 ${base.poolOutAge}세 고갈` : ''}. 주택연금을 ${retirement.startAge}세에 개시하면(시세 ${(housePrice / 10000).toFixed(1)}억 기준 약 ${hpm}만/월, 비과세·종신) "${ageText(withHp)}"${withHp.poolOutAge ? `, 예비 풀 ${withHp.poolOutAge}세 고갈` : ', 예비 풀 유지'}. 공제회 분할은 기간이 유한하고 주택연금은 종신이라 서로 대체재가 아닙니다 — 공백기(${retirement.startAge}~${pubStart - 1}세)만 메우는 데는 분할 단축이 효율적이고, 90세 이후 장수 구간까지 보면 주택연금 조기 개시가 구조적으로 안전합니다.`,
      })
    }
  }

  // 4.5 재직 중 공제회 납입 증액 테스트 — +20만(온건)과 한도(월 150만 = 2,500구좌)까지 최대 증좌를 실계산
  if (mutualAidPlan && mutualAidPlan.monthsToRetire > 12 && mutualAidTotal > 0) {
    const current = incomeSources.find((s) => s.kind === 'mutual-aid')
    const years = current && current.endAge !== null ? current.endAge - current.startAge + 1 : 10
    const startA = current?.startAge ?? retirement.startAge
    const baseMonthly = annuityMonthly(mutualAidTotal, payoutRatePct, years)
    const test = (add: number) => {
      const extraFv = projectMutualAid(0, add, mutualAidPlan.accrualRatePct, mutualAidPlan.monthsToRetire)
      const newMonthly = annuityMonthly(mutualAidTotal + extraFv, payoutRatePct, years)
      const src: IncomeSource = {
        id: 'plus', label: '공제회', kind: 'mutual-aid', monthlyAmount: newMonthly,
        startAge: startA, endAge: startA + years - 1, inflationLinked: false,
      }
      const r = simulateRetirement(retirement, rules, [...incomeSources.filter((s) => s.kind !== 'mutual-aid'), src])
      return { add, extraFv, newMonthly, r }
    }
    const t20 = test(20)
    const capMonthly = 150 // 장기저축급여 한도: 2,500구좌 × 600원 = 월 150만 (변경 가능 — 공제회 확인)
    const cur = mutualAidPlan.currentMonthly ?? 0
    const tMax = cur < capMonthly ? test(capMonthly - cur) : null
    const improves = score(t20.r) > score(base) || (tMax !== null && score(tMax.r) > score(base))
    out.push({
      kind: improves ? 'action' : 'info',
      text: `재직 중 공제회 납입 증액(증좌) 효과${cur > 0 ? ` — 현재 월 ${cur}만 기준` : ''}: ① 월 +20만이면 퇴직 시 급여금이 약 ${Math.round(t20.extraFv).toLocaleString('ko-KR')}만 늘어 ${years}년 분할 월액 ${Math.round(baseMonthly)}만 → ${Math.round(t20.newMonthly)}만, 결과 "${ageText(t20.r)}".${tMax ? ` ② 한도(월 ${capMonthly}만, 2,500구좌)까지 올리면(+${capMonthly - cur}만) 급여금이 약 ${Math.round(tMax.extraFv).toLocaleString('ko-KR')}만 늘어 분할 월액 ${Math.round(tMax.newMonthly)}만, 결과 "${ageText(tMax.r)}"${tMax.r.poolOutAge !== base.poolOutAge ? ` (예비 풀 고갈 ${base.poolOutAge ?? '없음'} → ${tMax.r.poolOutAge ?? '없음'}세)` : ''}.` : ''}${totalSurplus > 1000 && !retirement.sweepSurplus ? ' 증액분이 초반 잉여 구간에 몰려 결과가 안 바뀌어 보인다면, 위의 잉여 적립을 먼저 켜거나 분할 기간을 늘려 후반으로 보내세요.' : ''} 공제회 저축은 저율 분리과세라 세금·건보 문턱에 안 잡히는 몇 안 되는 증액 채널입니다 — 다만 증액분은 퇴직 전 유동성이 묶이는 돈이니, 비상금·연금계좌 세액공제(연 900만) 먼저 채운 뒤의 여유 자금으로 하세요.`,
    })
  }

  // 4.7 여유 목돈(의료비 등) 채널 — 유동성 관점 조언
  const poolTight = base.poolOutAge !== null && base.poolOutAge < 85
  if (poolTight)
    out.push({
      kind: 'action',
      text: `예비 풀이 ${base.poolOutAge}세에 고갈되는 설계라 의료비 같은 갑작스러운 목돈에 취약합니다. 원칙 문서 §9의 목돈 순서(파킹·예금 → 공제회 → ISA)를 유지할 최소 잔고를 정해 두세요.`,
    })
  out.push({
    kind: 'info',
    text: `목돈이 필요해질 때 쓸 수 있는 채널들: ① 공제회 분할급여는 수령 중에도 잔여분 일시금 전환을 신청할 수 있습니다(가능 조건은 공제회 확인). ② 주택연금 가입자는 연금대출한도의 50% 이내에서 의료비 등 목돈을 수시 인출(개별인출)할 수 있습니다${retirement.housingMonthly <= 0 ? ' — 주택연금을 배제한 현재 설계에서는 이 채널도 함께 사라진다는 점을 감안하세요' : ''}. ③ 연금계좌는 3개월 이상 요양 등 부득이한 사유면 저율로 목돈 인출이 가능합니다(한도 초과 16.5% 아님).`,
  })

  // 5. 목표 생활비 민감도
  const lowered = Math.round(retirement.targetMonthly * 0.9)
  const retBase = retentionProbability(retirement, rules, incomeSources, { runs: 500 })
  const retLow = retentionProbability({ ...retirement, targetMonthly: lowered }, rules, incomeSources, { runs: 500 })
  if (retLow.probRetained - retBase.probRetained >= 10)
    out.push({
      kind: 'info',
      text: `목표 생활비를 10% 낮추면(월 ${retirement.targetMonthly.toLocaleString('ko-KR')}만 → ${lowered.toLocaleString('ko-KR')}만, 은퇴년 기준) ${retirement.endAge}세 유지 확률이 ${retBase.probRetained.toFixed(0)}% → ${retLow.probRetained.toFixed(0)}%로 크게 오릅니다. 재원 보강이 어렵다면 목표 조정이 가장 확실한 레버입니다.`,
    })

  // action 우선 정렬
  const order = { action: 0, good: 1, info: 2 }
  return out.sort((a, b) => order[a.kind] - order[b.kind])
}
