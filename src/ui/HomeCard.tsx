import { useMemo } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { Rules } from '../engine/types'
import { summarizeHoldings } from '../engine/pension/holdings'
import { retentionProbability, simulateRetirement } from '../engine/pension/retirement'
import { estimateTeacherPension } from '../engine/pension/teacher'
import { diagnose } from '../engine/report/diagnostics'
import { salaryTableFor } from '../rules/salaryTables'
import { useStore } from '../store/useStore'
import { fmt만 } from './fmt'

const RULES = rulesJson as unknown as Rules

// 요약 홈 — 애플식 풀블리드 타일 스택 (light ↔ dark 교차, 색 전환이 곧 구분선)
export function HomeCard({ goTab }: { goTab: (tab: number) => void }) {
  const { holdings, retirement, incomeSources, teacher, financialIncomeAnnual, propertyTaxBase, housePrice, preset, officialRank } = useStore()

  const s = useMemo(() => summarizeHoldings(holdings, RULES), [holdings])
  const result = useMemo(() => simulateRetirement(retirement, RULES, incomeSources), [retirement, incomeSources])
  const retention = useMemo(() => retentionProbability(retirement, RULES, incomeSources, {}), [retirement, incomeSources])
  const issues = useMemo(() => {
    const teacherEst = estimateTeacherPension(teacher, salaryTableFor(preset, officialRank), RULES.publicPensionTeacher)
    return diagnose(
      {
        holdings, retirement, retirementResult: result, incomeSources, financialIncomeAnnual, propertyTaxBase,
        voluntaryBaseSalary: teacherEst.currentIncomeMonthly, retireDate: teacher.retireDate, housePrice,
      },
      RULES,
    ).filter((f) => f.severity === 'crit' || f.severity === 'warn')
  }, [holdings, retirement, result, incomeSources, financialIncomeAnnual, propertyTaxBase, housePrice, teacher, preset, officialRank])

  const r0 = result.rows[0]
  const firstIncome = r0.pub + r0.extraPublic + r0.priv + r0.hpm + r0.mutualAid + r0.extra + r0.poolDraw
  const retColor = retention.probRetained >= 80 ? 'var(--good)' : retention.probRetained >= 60 ? 'var(--s4)' : 'var(--crit)'

  return (
    <div className="hero-stack">
      <section className="hero-tile">
        <div className="hero-label">연금계좌 총자산</div>
        <div className="hero-value">{fmt만(s.tot)}원</div>
        <div className="hero-sub">
          연금저축 {fmt만(s.pensionSavings)} · IRP {fmt만(s.irpTot)} · IRP 위험 {(s.irpRatio * 100).toFixed(0)}%
          {s.irpRatio > RULES.account.irpRiskLimit ? ' ⚠' : ' ✓'}
        </div>
        <button className="primary" onClick={() => goTab(1)}>사적연금 보기</button>
      </section>

      <section className="hero-tile dark">
        <div className="hero-label">은퇴 후 월수입 ({retirement.startAge}세~)</div>
        <div className="hero-value">{fmt만(firstIncome)}</div>
        <div className="hero-sub">
          목표 {fmt만(r0.tgt)} · 공적연금 {fmt만(retirement.publicMonthly)} ({RULES.pensionOpenAge.publicPension}세~)
        </div>
        <button className="primary" onClick={() => goTab(2)}>은퇴 설계 보기</button>
      </section>

      <section className="hero-tile parchment">
        <div className="hero-label">{retirement.endAge}세 목표 유지 확률</div>
        <div className="hero-value" style={{ color: retColor }}>
          {retention.probRetained.toFixed(0)}%
        </div>
        <div className="hero-sub">
          {result.poolOutAge ? `예비 풀 ${result.poolOutAge}세 고갈` : '예비 풀 유지'} ·{' '}
          {result.uncoveredAge ? `${result.uncoveredAge}세부터 목표 미달` : '목표 충당'}
        </div>
        <button className="primary" onClick={() => goTab(2)}>민감도 확인</button>
      </section>

      <section className="hero-tile dark2">
        <div className="hero-label">다음 할 일</div>
        <div className="hero-value" style={{ color: issues.length ? 'var(--s4)' : 'var(--good)' }}>
          {issues.length ? `${issues.length}건` : '없음'}
        </div>
        <div className="hero-sub">{issues.length ? issues[0].title : '경고·주의 항목이 없습니다'}</div>
        <button className="primary" onClick={() => goTab(3)}>진단 리포트 열기</button>
      </section>
    </div>
  )
}
