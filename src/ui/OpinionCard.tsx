import { useMemo } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { Rules } from '../engine/types'
import { retentionProbability, simulateRetirement } from '../engine/pension/retirement'
import { mutualAidFvAtRetire } from '../engine/pension/mutualAidFund'
import { monthsBetween } from '../engine/pension/teacher'
import { adviseRetirement } from '../engine/report/advisor'
import { useStore } from '../store/useStore'
import { fmt만 } from './fmt'

const RULES = rulesJson as unknown as Rules

// 종합 의견 — 독립 탭. 대안을 실제 계산해 비교한 제안을 쉬운 말로 그룹핑해 보여준다
export function OpinionCard() {
  const { retirement, incomeSources, teacher, mutualAid, housePrice } = useStore()

  const base = useMemo(() => simulateRetirement(retirement, RULES, incomeSources), [retirement, incomeSources])
  const retention = useMemo(() => retentionProbability(retirement, RULES, incomeSources, {}), [retirement, incomeSources])
  const advices = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    return adviseRetirement({
      retirement,
      incomeSources,
      mutualAidTotal: mutualAidFvAtRetire(mutualAid, teacher.retireDate, todayIso),
      payoutRatePct: mutualAid.payoutRatePct,
      rules: RULES,
      housePrice,
      mutualAidPlan: {
        monthsToRetire: Math.max(monthsBetween(todayIso, teacher.retireDate), 0),
        accrualRatePct: mutualAid.accrualRatePct,
        currentMonthly: mutualAid.monthlyContribution,
      },
    })
  }, [retirement, incomeSources, mutualAid, teacher.retireDate, housePrice])

  const actions = advices.filter((a) => a.kind === 'action')
  const goods = advices.filter((a) => a.kind === 'good')
  const infos = advices.filter((a) => a.kind === 'info')

  const statusColor = base.uncoveredAge ? 'var(--crit)' : base.poolOutAge ? 'var(--s4)' : 'var(--good)'
  const statusText = base.uncoveredAge
    ? `지금 가정대로면 ${base.uncoveredAge}세부터 목표 생활비가 부족해집니다.`
    : base.poolOutAge
      ? `목표는 ${retirement.endAge}세까지 채워지지만, 예비 풀이 ${base.poolOutAge}세에 바닥납니다.`
      : `지금 가정대로면 ${retirement.endAge}세까지 목표 생활비를 채울 수 있습니다.`

  const Section = ({ title, items, color }: { title: string; items: typeof advices; color: string }) =>
    items.length === 0 ? null : (
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ color }}>{title}</h2>
        <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
          {items.map((a, i) => (
            <li key={i} style={{ marginBottom: 10, fontSize: 14, lineHeight: 1.6, color: 'var(--ink2)', borderLeft: `3px solid ${color}`, paddingLeft: 12 }}>
              {a.text}
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <div className="card">
      <h2>
        종합 의견
        <span className="hint">가정을 실제로 바꿔 계산해 본 결과에 근거한 제안 — 정보 제공용이며 투자자문이 아닙니다</span>
      </h2>
      <div className="tile" style={{ marginBottom: 16 }}>
        <div className="k">지금 상태 한 줄 요약</div>
        <div className="v" style={{ fontSize: 17, color: statusColor }}>{statusText}</div>
        <div className="d">
          목표 월 {fmt만(retirement.targetMonthly)}({retirement.startAge}세 기준, 현재 가치로 {fmt만(retirement.targetMonthlyToday ?? retirement.targetMonthly)}) ·{' '}
          {retirement.endAge}세까지 유지 확률 {retention.probRetained.toFixed(0)}% (수익률 변동 반영 시)
        </div>
      </div>
      <Section title="이렇게 바꿔보세요" items={actions} color="var(--s1)" />
      <Section title="잘 되어 있어요" items={goods} color="var(--good)" />
      <Section title="알아두세요" items={infos} color="var(--muted)" />
      <div className="note">
        각 제안은 해당 가정만 바꾼 시뮬레이션을 돌려 현재 설정과 비교한 결과입니다. 실행 전 공단·공제회 확인과 전문가
        상담을 권하며, 자산 배분 변경은 원칙 문서 개정 절차(연 1회 리밸런싱일)를 따르는 것이 좋습니다.
      </div>
    </div>
  )
}
