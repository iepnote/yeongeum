import { useMemo } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { Rules } from '../engine/types'
import { simulateRetirement } from '../engine/pension/retirement'
import { estimateTeacherPension } from '../engine/pension/teacher'
import { separateTaxGuide } from '../engine/report/diagnostics'
import { salaryTableFor } from '../rules/salaryTables'
import { useStore } from '../store/useStore'

const RULES = rulesJson as unknown as Rules

// 분리과세 활용 가이드 — 독립 탭 (수령기 과세 트랙 요약 + 절세 포인트)
export function TaxGuideCard() {
  const { holdings, retirement, incomeSources, teacher, financialIncomeAnnual, propertyTaxBase, preset, officialRank } = useStore()
  const guide = useMemo(() => {
    const result = simulateRetirement(retirement, RULES, incomeSources)
    const teacherEst = estimateTeacherPension(teacher, salaryTableFor(preset, officialRank), RULES.publicPensionTeacher)
    return separateTaxGuide(
      {
        holdings, retirement, retirementResult: result, incomeSources, financialIncomeAnnual, propertyTaxBase,
        voluntaryBaseSalary: teacherEst.currentIncomeMonthly, retireDate: teacher.retireDate,
      },
      RULES,
    )
  }, [holdings, retirement, incomeSources, teacher, financialIncomeAnnual, propertyTaxBase])

  return (
    <div className="card" style={{ borderColor: 'var(--s1)' }}>
      <h2 style={{ color: 'var(--s1)' }}>
        분리과세 활용 가이드
        <span className="hint">수령기 과세 트랙 요약 — 종합과세에 합산되지 않는 재원을 아는 것이 절세 설계의 핵심</span>
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>재원</th>
              <th>과세 방식</th>
              <th>현재 설정</th>
              <th>절세 포인트</th>
            </tr>
          </thead>
          <tbody>
            {guide.map((g) => (
              <tr key={g.name}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{g.name}</td>
                <td style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{g.track}</td>
                <td style={{ whiteSpace: 'nowrap', color: g.ok ? 'var(--good)' : 'var(--crit)', fontSize: 12.5 }}>{g.status}</td>
                <td style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{g.tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note">
        핵심 구조: 사적연금(한도 내)·공제회·주택연금·ISA는 종합과세와 건보 부과 소득 어디에도 합산되지 않는 "분리
        트랙"이고, 공적연금만 종합 트랙입니다. 분리 트랙을 넓게 유지할수록 세금·건보료가 함께 관리됩니다. 정보 제공용
        규칙 기반 안내이며 투자자문·세무대리가 아닙니다 — 실행 전 세무 상담을 권합니다. (룰 기준연도 {RULES.year})
      </div>
    </div>
  )
}
