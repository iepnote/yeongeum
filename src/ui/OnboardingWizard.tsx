import { useState } from 'react'
import { useStore } from '../store/useStore'

// 온보딩 마법사 (F-1.2) — 첫 방문 시 4단계로 기본값 주입, 언제든 건너뛰기 가능
export function OnboardingWizard() {
  const { onboarded, setProfile, setSpouse, setRetirement, setTeacher } = useStore()
  const [step, setStep] = useState(0)
  const [birth, setBirth] = useState(1975)
  const [couple, setCouple] = useState(false)
  const [job, setJob] = useState<'teacher' | 'employee' | 'self'>('teacher')
  const [retireYear, setRetireYear] = useState(2038)
  const [hasHouse, setHasHouse] = useState(true)

  if (onboarded) return null

  const finish = (apply: boolean) => {
    if (apply) {
      setProfile({ birthYear: birth, preset: job })
      setSpouse({ enabled: couple })
      const startAge = Math.max(retireYear - birth - 1, 40) // 만나이 근사
      setRetirement({ startAge, ...(hasHouse ? {} : { housingMonthly: 0 }) })
      if (job === 'teacher') setTeacher({ retireDate: `${retireYear}-08-31` })
    }
    setProfile({ onboarded: true })
  }

  const steps = [
    <div key={0}>
      <h2>1/4 · 기본 정보</h2>
      <div className="controls">
        <div className="ctl">
          <label>출생연도</label>
          <input type="number" step={1} value={birth} onChange={(e) => setBirth(+e.target.value)} />
        </div>
        <div className="ctl">
          <label>가구</label>
          <select value={couple ? 'couple' : 'single'} onChange={(e) => setCouple(e.target.value === 'couple')}>
            <option value="single">싱글</option>
            <option value="couple">부부</option>
          </select>
        </div>
      </div>
    </div>,
    <div key={1}>
      <h2>2/4 · 직업</h2>
      <div className="controls">
        <select value={job} onChange={(e) => setJob(e.target.value as typeof job)}>
          <option value="teacher">교사 (교육공무원)</option>
          <option value="employee">회사원</option>
          <option value="self">자영업</option>
        </select>
      </div>
      <div className="note">직업에 맞는 연금 추정 카드가 표시됩니다. 나중에 언제든 바꿀 수 있습니다.</div>
    </div>,
    <div key={2}>
      <h2>3/4 · 퇴직 예정</h2>
      <div className="controls">
        <div className="ctl">
          <label>퇴직 예정 연도</label>
          <input type="number" step={1} value={retireYear} onChange={(e) => setRetireYear(+e.target.value)} />
        </div>
      </div>
      <div className="note">은퇴 시뮬레이터의 시작 나이가 이 값으로 설정됩니다 (약 {Math.max(retireYear - birth - 1, 40)}세).</div>
    </div>,
    <div key={3}>
      <h2>4/4 · 주택</h2>
      <div className="controls">
        <select value={hasHouse ? 'y' : 'n'} onChange={(e) => setHasHouse(e.target.value === 'y')}>
          <option value="y">자가 보유 — 주택연금 검토</option>
          <option value="n">해당 없음 — 주택연금 제외</option>
        </select>
      </div>
      <div className="note">완료하면 첫 시나리오가 자동 구성됩니다. 모든 값은 카드에서 수정 가능합니다.</div>
    </div>,
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 420, maxWidth: '92vw' }}>
        <h1 style={{ marginBottom: 2 }}>연금나침반 시작하기</h1>
        <div className="sub">4단계로 첫 시나리오를 만듭니다 (약 1분)</div>
        {steps[step]}
        <div className="controls" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <button onClick={() => finish(false)}>건너뛰기 (기존 사용자)</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <button onClick={() => setStep(step - 1)}>이전</button>}
            {step < steps.length - 1 ? (
              <button className="primary" onClick={() => setStep(step + 1)}>
                다음
              </button>
            ) : (
              <button className="primary" onClick={() => finish(true)}>
                완료 — 첫 시나리오 만들기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
