import { useMemo } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { Rules } from '../engine/types'
import { simulateRetirement } from '../engine/pension/retirement'
import { estimateTeacherPension } from '../engine/pension/teacher'
import { diagnose, gapSummary, type Severity } from '../engine/report/diagnostics'
import { computeFreshness, updateChecklist } from '../engine/freshness'
import { coupleNhis } from '../engine/nhis/couple'
import { salaryTableFor } from '../rules/salaryTables'
import { useStore } from '../store/useStore'
import { fmt만 } from './fmt'

const RULES = rulesJson as unknown as Rules

const SEV_STYLE: Record<Severity, { label: string; color: string }> = {
  crit: { label: '경고', color: 'var(--crit)' },
  warn: { label: '주의', color: 'var(--s4)' },
  info: { label: '참고', color: 'var(--s1)' },
  ok: { label: '양호', color: 'var(--good)' },
}

export function ReportCard() {
  const { holdings, retirement, incomeSources, teacher, financialIncomeAnnual, propertyTaxBase, housePrice, setDiag, spouse, setSpouse, preset, officialRank } = useStore()

  const result = useMemo(() => simulateRetirement(retirement, RULES, incomeSources), [retirement, incomeSources])
  const teacherEst = useMemo(() => estimateTeacherPension(teacher, salaryTableFor(preset, officialRank), RULES.publicPensionTeacher), [teacher, preset, officialRank])
  const findings = useMemo(
    () =>
      diagnose(
        {
          holdings,
          retirement,
          retirementResult: result,
          incomeSources,
          financialIncomeAnnual,
          propertyTaxBase,
          voluntaryBaseSalary: teacherEst.currentIncomeMonthly,
          retireDate: teacher.retireDate,
          housePrice,
        },
        RULES,
      ),
    [holdings, retirement, result, incomeSources, financialIncomeAnnual, propertyTaxBase, housePrice, teacherEst, teacher.retireDate],
  )

  const actions = findings.filter((x) => x.action)


  return (
    <div className="card" id="report">
      <h2>
        진단 리포트
        <span className="hint">규칙 기반 자동 진단 · 룰 {RULES.year} · 인쇄하면 PDF로 저장 가능</span>
      </h2>
      <div className="controls no-print" style={{ marginBottom: 14 }}>
        <div className="ctl">
          <label>일반계좌 금융소득 (만/년)</label>
          <input type="number" step={100} min={0} value={financialIncomeAnnual} onChange={(e) => setDiag({ financialIncomeAnnual: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>재산세 과표 (만원)</label>
          <input type="number" step={1000} min={0} value={propertyTaxBase} onChange={(e) => setDiag({ propertyTaxBase: +e.target.value })} />
        </div>
        <button onClick={() => window.print()}>리포트 인쇄 (PDF)</button>
      </div>

      <div className="tile" style={{ marginBottom: 12 }}>
        <div className="k">갭 분석</div>
        <div className="v" style={{ fontSize: 15 }}>{gapSummary(result, retirement.endAge)}</div>
        <div className="d">
          목표 {retirement.targetMonthly}만/월({retirement.startAge}세 기준) · 공적 {retirement.publicMonthly}만 · 사적 연{' '}
          {retirement.privateAnnual}만 · 주택 {retirement.housingMonthly}만 · 예비 풀 {retirement.reservePool.toLocaleString('ko-KR')}만
        </div>
      </div>

      <table style={{ marginBottom: 12 }}>
        <tbody>
          {findings.map((x) => (
            <tr key={x.id}>
              <td style={{ width: 52, whiteSpace: 'nowrap' }}>
                <span style={{ color: SEV_STYLE[x.severity].color, fontWeight: 700, fontSize: 12.5 }}>
                  {SEV_STYLE[x.severity].label}
                </span>
              </td>
              <td>
                <div style={{ fontWeight: 600 }}>{x.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{x.detail}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {actions.length > 0 && (
        <>
          <h2 style={{ marginBottom: 6 }}>액션 아이템</h2>
          <ul style={{ paddingLeft: 20, fontSize: 13, marginBottom: 10 }}>
            {actions.map((x) => (
              <li key={x.id} style={{ marginBottom: 4 }}>
                {x.action}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 style={{ marginBottom: 6 }}>
        부부 모드<span className="hint">배우자 정보 입력 시 건보료·피부양자 상호 판정 (F-1.3) — 수령기(은퇴 후) 기준</span>
      </h2>
      <div className="controls no-print" style={{ marginBottom: 10 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={spouse.enabled} onChange={(e) => setSpouse({ enabled: e.target.checked })} />
          부부 모드 사용
        </label>
        {spouse.enabled && (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={spouse.isEmployee} onChange={(e) => setSpouse({ isEmployee: e.target.checked })} />
              배우자 직장가입(재직)
            </label>
            {spouse.isEmployee && (
              <div className="ctl">
                <label>배우자 보수월액 (만)</label>
                <input type="number" step={10} value={spouse.monthlySalary} onChange={(e) => setSpouse({ monthlySalary: +e.target.value })} />
              </div>
            )}
            <div className="ctl">
              <label>배우자 공적연금 (만/년, 현재가치)</label>
              <input type="number" step={100} value={spouse.publicPensionAnnual} onChange={(e) => setSpouse({ publicPensionAnnual: +e.target.value })} />
            </div>
            <div className="ctl">
              <label>배우자 재산 과표 (만)</label>
              <input type="number" step={1000} value={spouse.propertyTaxBase} onChange={(e) => setSpouse({ propertyTaxBase: +e.target.value })} />
            </div>
          </>
        )}
      </div>
      {spouse.enabled &&
        (() => {
          const won = 10000
          const deflate = 1 / (retirement.inflFactorToRetire ?? 1) // 은퇴년 명목 → 현재가치 (현행 건보 룰과 기준 일치)
          const r = coupleNhis(
            {
              label: '본인',
              isEmployee: false,
              monthlySalary: 0,
              publicPensionAnnual: retirement.publicMonthly * 12 * deflate * won,
              privatePensionAnnual: retirement.privateAnnual * won,
              propertyTaxBase: propertyTaxBase * won,
            },
            {
              label: '배우자',
              isEmployee: spouse.isEmployee,
              monthlySalary: spouse.monthlySalary * won,
              publicPensionAnnual: spouse.publicPensionAnnual * won,
              privatePensionAnnual: spouse.privatePensionAnnual * won,
              propertyTaxBase: spouse.propertyTaxBase * won,
            },
            RULES.nhis,
          )
          return (
            <div style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>대상</th>
                    <th>부과 형태</th>
                    <th className="num">월 보험료</th>
                  </tr>
                </thead>
                <tbody>
                  {r.memberPremiums.map((m) => (
                    <tr key={m.label}>
                      <td>{m.label}</td>
                      <td>{m.role}</td>
                      <td className="num">{fmt만(m.monthly / won)}원</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 700 }}>가구 합계</td>
                    <td></td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {fmt만(r.totalMonthly / won)}원
                    </td>
                  </tr>
                </tbody>
              </table>
              {r.notes.map((n) => (
                <div key={n} style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 4 }}>
                  · {n}
                </div>
              ))}
            </div>
          )
        })()}

      <h2 style={{ marginBottom: 6 }}>
        연 1회 갱신 체크리스트<span className="hint">리밸런싱일(1월 둘째 주말) 점검용 — ⚠ = 신선도 초과 (F-10)</span>
      </h2>
      <ul style={{ paddingLeft: 20, fontSize: 13, marginBottom: 10 }}>
        {updateChecklist(
          computeFreshness({
            nowIso: new Date().toISOString(),
            holdings,
            pensionQueriedAt: teacher.pensionCalibration?.queriedAt,
            rulesYear: RULES.year,
          }),
        ).map((c) => (
          <li key={c.label} style={{ marginBottom: 4 }}>
            {c.urgent && <span style={{ color: 'var(--crit)', fontWeight: 700 }}>⚠ </span>}
            {c.label}{' '}
            <span style={{ color: 'var(--muted)' }}>
              —{' '}
              {c.url ? (
                <a href={c.url} target="_blank" rel="noreferrer" style={{ color: 'var(--s1)' }}>
                  {c.where}
                </a>
              ) : (
                c.where
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="note">
        정보 제공용 규칙 기반 진단이며 투자자문·세무대리가 아닙니다. 실제 고지·부과액과 다를 수 있으며, 중요한 결정 전에는
        공단 조회와 전문가 상담을 우선하세요. (룰 기준연도 {RULES.year})
      </div>
    </div>
  )
}
