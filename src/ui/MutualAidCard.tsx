import { useMemo } from 'react'
import { annuityMonthly } from '../engine/pension/annuity'
import { mutualAidFvAtRetire, projectMutualAid } from '../engine/pension/mutualAidFund'
import { monthsBetween } from '../engine/pension/teacher'
import { useStore } from '../store/useStore'
import { fmt만 } from './fmt'

// 교직원 공제회 전용 탭 — The-K 조회값(세후 총 급여금, 추정 기준일)에서 출발.
// 조회 총액에는 이미 원금+이자−세금이 반영되어 있으므로 다시 복리를 굴리지 않고,
// 추정 기준일이 퇴직예정일보다 이르면 그 사이 구간만 납입+급여율로 연장한다.
export function MutualAidCard() {
  const { mutualAid, setMutualAid, teacher, retirement, setRetirement, incomeSources, setIncomeSources } = useStore()

  const queried = mutualAid.queriedTotal ?? 0
  const todayIso = new Date().toISOString().slice(0, 10)
  const baseDate = mutualAid.queriedBaseDate || todayIso
  const extendMonths = Math.max(monthsBetween(baseDate, teacher.retireDate), 0)
  const fv = useMemo(() => mutualAidFvAtRetire(mutualAid, teacher.retireDate, todayIso), [mutualAid, teacher.retireDate, todayIso])
  // 납입 조정분: 조회 가정 납입액과 계획이 다를 때 오늘→기준일 구간의 차액 적립 (표시용)
  const deltaAdj =
    mutualAid.queriedMonthlyContribution != null && mutualAid.queriedMonthlyContribution !== mutualAid.monthlyContribution
      ? projectMutualAid(0, mutualAid.monthlyContribution - mutualAid.queriedMonthlyContribution, mutualAid.accrualRatePct, Math.max(monthsBetween(todayIso, baseDate), 0))
      : 0
  const payoutMonthly = annuityMonthly(fv, mutualAid.payoutRatePct, mutualAid.payoutYears)
  const existing = incomeSources.find((s) => s.kind === 'mutual-aid')

  return (
    <div className="card">
      <h2>
        교직원 공제회 — 장기저축급여
        <span className="hint">
          권장: The-K "급여금 추정"의 지급예정액(세후) + 추정 기준일 입력. 조회값은 조회 당시 납입액을 계속 낸다는
          가정의 추정이므로, 납입을 바꿀 계획이면 '조회 시 월 납입'과 '계획 월 납입'을 다르게 입력하세요 — 차액의
          적립분을 자동 가감합니다
        </span>
      </h2>
      <div className="controls" style={{ marginBottom: 14 }}>
        <div className="ctl">
          <label>조회 예상 총 급여금 (만, 세후)</label>
          <input type="number" step={100} min={0} value={queried || ''} placeholder="—" onChange={(e) => setMutualAid({ queriedTotal: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>조회의 추정 기준일</label>
          <input type="date" value={mutualAid.queriedBaseDate} onChange={(e) => setMutualAid({ queriedBaseDate: e.target.value })} />
        </div>
        <div className="ctl">
          <label>조회 시 월 납입 (만)</label>
          <input
            type="number" step={1} min={0} placeholder="= 계획과 동일"
            value={mutualAid.queriedMonthlyContribution ?? ''}
            onChange={(e) => setMutualAid({ queriedMonthlyContribution: e.target.value === '' ? undefined : +e.target.value })}
          />
        </div>
        <div className="ctl">
          <label>계획 월 납입 (만)</label>
          <input type="number" step={1} min={0} value={mutualAid.monthlyContribution} onChange={(e) => setMutualAid({ monthlyContribution: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>적립 급여율 (연 %) — 연장 구간용</label>
          <input type="number" step={0.1} min={0} value={mutualAid.accrualRatePct} onChange={(e) => setMutualAid({ accrualRatePct: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>분할 수령 기간 (년)</label>
          <input type="number" step={1} min={1} value={mutualAid.payoutYears} onChange={(e) => setMutualAid({ payoutYears: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>분할급여율 (연 %)</label>
          <input type="number" step={0.1} min={0} value={mutualAid.payoutRatePct} onChange={(e) => setMutualAid({ payoutRatePct: +e.target.value })} />
        </div>
      </div>
      <div className="tiles">
        <div className="tile">
          <div className="k">기준일 → 퇴직일 연장</div>
          <div className="v">{extendMonths > 0 ? `${(extendMonths / 12).toFixed(1)}년` : '없음'}</div>
          <div className="d">
            {extendMonths > 0
              ? `${baseDate} → ${teacher.retireDate} (월 ${fmt만(mutualAid.monthlyContribution)} 납입 계속 가정)`
              : '추정 기준일이 퇴직예정일 이후 — 조회값 그대로 사용'}
          </div>
        </div>
        <div className="tile">
          <div className="k">퇴직 시 예상 총 급여금</div>
          <div className="v accent1">{fmt만(fv)}원</div>
          <div className="d">
            조회 {fmt만(queried)}
            {deltaAdj !== 0 && <> {deltaAdj > 0 ? '+' : '−'} 납입조정 {fmt만(Math.abs(deltaAdj))}</>}
            {extendMonths > 0 ? ` + 연장 구간 ${fmt만(Math.max(fv - queried - deltaAdj, 0))}` : deltaAdj === 0 ? ' (연장 없음)' : ''}
          </div>
        </div>
        <div className="tile">
          <div className="k">분할급여 월액 ({mutualAid.payoutYears}년)</div>
          <div className="v accent1">{fmt만(payoutMonthly)}/월</div>
          <div className="d">
            총 수령 {fmt만(payoutMonthly * mutualAid.payoutYears * 12)} = 원금 {fmt만(fv)} + 이자{' '}
            {fmt만(Math.max(payoutMonthly * mutualAid.payoutYears * 12 - fv, 0))} (연 {mutualAid.payoutRatePct}%)
          </div>
        </div>
        <div className="tile">
          <div className="k">시뮬레이터 반영 상태</div>
          <div className="v" style={{ fontSize: 15, color: existing ? 'var(--good)' : 'var(--muted)' }}>
            {existing ? `분할급여 ${fmt만(existing.monthlyAmount)}/월 ✓` : '미반영'}
          </div>
          <div className="d">{existing ? `${existing.startAge}~${existing.endAge}세` : '아래 버튼으로 반영'}</div>
        </div>
      </div>
      <div className="controls">
        <button
          className="primary"
          disabled={fv <= 0}
          onClick={() => {
            const row = {
              id: existing?.id ?? crypto.randomUUID(),
              label: `공제회 분할급여 (총 ${(fv / 10000).toFixed(2)}억)`,
              kind: 'mutual-aid' as const,
              monthlyAmount: Math.round(payoutMonthly * 10) / 10,
              startAge: retirement.startAge,
              endAge: retirement.startAge + Math.max(mutualAid.payoutYears, 1) - 1,
              inflationLinked: false,
            }
            setIncomeSources(existing ? incomeSources.map((s) => (s.id === existing.id ? row : s)) : [...incomeSources, row])
          }}
        >
          분할급여를 수입원으로 {existing ? '갱신' : '추가'} ({fmt만(payoutMonthly)}/월)
        </button>
        <button
          disabled={fv <= 0}
          onClick={() => {
            if (confirm(`예비 풀을 ${fmt만(fv)}원으로 바꿉니다 (현재 ${fmt만(retirement.reservePool)}원).\nISA 등 다른 예비 자금은 직접 더해 주세요. 분할급여 수입원과 중복 반영하지 마세요.`))
              setRetirement({ reservePool: Math.round(fv) })
          }}
        >
          일시금으로 예비 풀에 반영
        </button>
      </div>
      <div className="note">
        같은 돈을 두 번 쓰지 않도록 주의: <b>분할급여 수입원</b>과 <b>예비 풀 일시금</b> 중 한 가지 방식만 반영하세요.
        The-K 추정은 "퇴직 가정" 해약 기준 세후 금액이며, 분할 수령 시 실제 수령액·급여율은 공제회 안내를 우선하세요.
        공제회 급여금은 저율 분리과세로 금융소득 문턱·건보 소득에 포함되지 않습니다.
      </div>
    </div>
  )
}
