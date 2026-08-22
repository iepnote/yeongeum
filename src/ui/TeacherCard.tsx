import { useMemo } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { Rules } from '../engine/types'
import { estimateTeacherPension } from '../engine/pension/teacher'
import { OFFICIAL_RANKS, salaryTableFor } from '../rules/salaryTables'
import { useStore } from '../store/useStore'
import { retireContext } from './retireContext'
import { fmt만 } from './fmt'

const RULES = rulesJson as unknown as Rules

const fmt원 = (v: number) => Math.round(v).toLocaleString('ko-KR') + '원'

export function TeacherCard() {
  const { teacher, setTeacher, setRetirement, incomeSources, retirement, birthYear, preset, officialRank, setProfile } = useStore()
  const { retireYear, inflFactor } = retireContext(birthYear, retirement)
  const isOfficial = preset === 'official'
  const SALARY = useMemo(() => salaryTableFor(preset, officialRank), [preset, officialRank])
  const maxGrade = SALARY.grades[SALARY.grades.length - 1].grade
  const est = useMemo(() => estimateTeacherPension(teacher, SALARY, RULES.publicPensionTeacher), [teacher, SALARY])
  const cal = teacher.pensionCalibration
  const existingNps = incomeSources.find((s) => s.kind === 'public-extra')

  const patchCal = (p: Partial<NonNullable<typeof cal>>) =>
    setTeacher({
      pensionCalibration: { queriedAt: '', serviceMonths: 0, monthlyPension: 0, ...cal, ...p },
    })

  return (
    <div className="card">
      <h2>
        {isOfficial ? '일반직 공무원' : '교사'} 프리셋 — 공무원연금 추정
        <span className="hint">
          봉급표 {SALARY.year}{isOfficial ? ' (별표 3)' : ''} · 연금월액 = 평균기준소득월액 × 재직연수 × {+(RULES.publicPensionTeacher.accrualRatePerYear * 100).toFixed(3)}% ·
          모든 값 수정 가능
        </span>
      </h2>
      <div className="controls" style={{ marginBottom: 14 }}>
        {isOfficial && (
          <div className="ctl">
            <label>계급</label>
            <select value={officialRank} onChange={(e) => setProfile({ officialRank: +e.target.value })}>
              {OFFICIAL_RANKS.map((r) => (
                <option key={r} value={r}>{r}급</option>
              ))}
            </select>
          </div>
        )}
        <div className="ctl">
          <label>임용일</label>
          <input type="date" value={teacher.appointedDate} onChange={(e) => setTeacher({ appointedDate: e.target.value })} />
        </div>
        <div className="ctl">
          <label>퇴직예정일</label>
          <input type="date" value={teacher.retireDate} onChange={(e) => setTeacher({ retireDate: e.target.value })} />
        </div>
        <div className="ctl">
          <label>현재 호봉</label>
          <input
            type="number" min={1} max={maxGrade} step={1} value={teacher.currentGrade}
            onChange={(e) => setTeacher({ currentGrade: +e.target.value })}
          />
        </div>
        <div className="ctl">
          <label>수당계수 {est.calibratedByContribution ? '(기여금으로 역산됨)' : '(기본 1.35)'}</label>
          <input
            type="number" step={0.05} value={est.calibratedByContribution ? +est.allowanceFactorUsed.toFixed(3) : teacher.allowanceFactor}
            disabled={est.calibratedByContribution}
            onChange={(e) => setTeacher({ allowanceFactor: +e.target.value })}
          />
        </div>
        <div className="ctl">
          <label>일반기여금 (원/월, 명세서 — 선택)</label>
          <input
            type="number" step={10000} min={0} style={{ width: 110 }} placeholder="미입력"
            value={teacher.monthlyContribution || ''}
            onChange={(e) => setTeacher({ monthlyContribution: +e.target.value || undefined })}
          />
        </div>
      </div>
      <div className="controls" style={{ marginBottom: 14 }}>
        <div className="ctl">
          <label>공단 조회값 기준 (보정 — 선택)</label>
          <select
            value={cal?.basis ?? 'current'}
            onChange={(e) => patchCal({ basis: e.target.value as 'current' | 'at-retirement' })}
          >
            <option value="current">현재 재직기간 기준 금액</option>
            <option value="at-retirement">퇴직예정일 기준 금액 (공단 예상연금 조회 기본)</option>
          </select>
        </div>
        <div className="ctl">
          <label>공단 조회일</label>
          <input type="date" value={cal?.queriedAt ?? ''} onChange={(e) => patchCal({ queriedAt: e.target.value })} />
        </div>
        {(cal?.basis ?? 'current') === 'current' && (
          <div className="ctl">
            <label>조회 시점 재직월수</label>
            <input
              type="number" step={1} min={0} value={cal?.serviceMonths || ''} placeholder="—"
              onChange={(e) => patchCal({ serviceMonths: +e.target.value })}
            />
          </div>
        )}
        <div className="ctl">
          <label>조회 예상연금 (원/월)</label>
          <input
            type="number" step={10000} min={0} style={{ width: 110 }} value={cal?.monthlyPension || ''} placeholder="—"
            onChange={(e) => patchCal({ monthlyPension: +e.target.value })}
          />
        </div>
        <div className="ctl">
          <label>연금 개시 나이 (법정 {est.statutoryOpenAge}세)</label>
          <input
            type="number" step={1} min={est.statutoryOpenAge - 5} max={est.statutoryOpenAge}
            value={teacher.openAgeChosen ?? est.statutoryOpenAge}
            onChange={(e) => setTeacher({ openAgeChosen: +e.target.value })}
          />
        </div>
        {cal && (
          <button onClick={() => setTeacher({ pensionCalibration: undefined })}>보정 해제</button>
        )}
      </div>
      {est.earlyReductionPct > 0 && (
        <div className="note" style={{ marginTop: -8, marginBottom: 12 }}>
          조기퇴직연금: 법정 개시({est.statutoryOpenAge}세)보다 {est.statutoryOpenAge - est.openAge}년 이른 수령 —{' '}
          <b>{est.earlyReductionPct.toFixed(0)}% 감액</b>이 평생 적용됩니다 (연 5%, 최대 25%). 공무원연금에 연기(늦춰
          받기) 제도는 없습니다.
        </div>
      )}
      {(cal?.basis ?? 'current') === 'at-retirement' && (cal?.monthlyPension ?? 0) > 0 && (
        <div className="note" style={{ marginTop: -8, marginBottom: 12 }}>
          퇴직예정일 기준 조회값은 공단이 미래 재직·승급을 이미 반영한 추정이므로, 아래 예상 연금월액에 <b>그대로
          사용</b>됩니다 (봉급표 모델로 재계산하지 않음 — 이중 반영 방지).
        </div>
      )}
      <div className="tiles">
        <div className="tile">
          <div className="k">현재 본봉 ({isOfficial ? `${officialRank}급 ` : ''}{Math.min(teacher.currentGrade, maxGrade)}호봉)</div>
          <div className="v">{fmt원(est.currentBaseSalary)}</div>
          <div className="d">봉급표 {SALARY.year} 기준</div>
        </div>
        <div className="tile">
          <div className="k">현재 기준소득월액 추정</div>
          <div className="v">{fmt원(est.currentIncomeMonthly)}</div>
          <div className="d">기여금(9%) {fmt원(est.contributionMonthly)} — 명세서와 대조</div>
        </div>
        <div className="tile">
          <div className="k">평균기준소득월액 (현재가치)</div>
          <div className="v accent1">{fmt원(est.avgIncomeMonthly)}</div>
          <div className="d">{est.calibratedByQuery ? '공단 조회값 보정 적용' : '봉급표 모델 추정'}</div>
        </div>
        <div className="tile">
          <div className="k">예상 연금월액</div>
          <div className="v accent1">{fmt원(est.pensionMonthly)}</div>
          <div className="d">
            재직 {est.countedYears.toFixed(1)}년 × {+(RULES.publicPensionTeacher.accrualRatePerYear * 100).toFixed(3)}% · {est.openAge}세 개시
            {est.earlyReductionPct > 0 && <span className="down"> (조기 −{est.earlyReductionPct.toFixed(0)}%)</span>}
          </div>
        </div>
      </div>
      <div className="controls">
        <button
          className="primary"
          onClick={() =>
            setRetirement({ publicMonthly: Math.round((est.pensionMonthly / 10000) * inflFactor), publicStartAge: est.openAge })
          }
        >
          은퇴 시뮬레이터 공적연금에 반영 — 현재가치 {fmt만(est.pensionMonthly / 10000)} → 은퇴년({retireYear}) 명목{' '}
          {fmt만((est.pensionMonthly / 10000) * inflFactor)}/월 ({est.openAge}세~)
        </button>
        {existingNps && (
          <span style={{ fontSize: 12.5, color: 'var(--good)' }}>
            ✓ 국민연금 {fmt만(existingNps.monthlyAmount)}/월 병행 반영 중 ({existingNps.startAge}세~) — "추가 수입원" 탭에서 관리
          </span>
        )}
      </div>
      <div className="note">
        근사 모델입니다: 기준소득월액 ≈ 본봉 × 수당계수, 재평가는 현재 봉급표 평가로 근사(봉급 인상률 ≈ 재평가율 가정),
        지급률은 {+(RULES.publicPensionTeacher.accrualRatePerYear * 100).toFixed(3)}% 고정 — 보수적 하한(2026년 실제 1.736%, 2035년까지 단계 인하). 평균기준소득이 전체 공무원 평균보다 높으면 소득재분배 차등으로 실제 지급률이 이보다 낮아질 수 있습니다.
        공단 정식 산식의 소득재분배 요소(지급률 중 1.0%p를 전체 공무원 평균소득 대비 구간별로 차등)는 미반영 —
        평균소득 근처에서는 오차가 작고, 공단 조회값 보정이 이 차이를 흡수합니다. 정확한 값은 공단 조회를 우선하세요.
        위 예상 연금월액은 현재가치이며, 반영 버튼이 은퇴년 명목으로 환산해 시뮬레이터에 넣습니다.
      </div>
    </div>
  )
}
