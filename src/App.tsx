import { useRef, useState } from 'react'
import rules from './rules/rules-2026.json'
import { exportJSON, importJSON, useStore } from './store/useStore'
import { LockGate, LockSettings, getLock } from './ui/LockGate'
import { AllocationCard } from './ui/AllocationCard'
import { SimulationCard } from './ui/SimulationCard'
import { HoldingsCard } from './ui/HoldingsCard'
import { RetirementCard } from './ui/RetirementCard'
import { TeacherCard } from './ui/TeacherCard'
import { NpsCard } from './ui/NpsCard'
import { ReportCard } from './ui/ReportCard'
import { RuleCheck } from './ui/FreshnessBar'
import { OnboardingWizard } from './ui/OnboardingWizard'
import { HomeCard } from './ui/HomeCard'
import { IncomeSourcesCard } from './ui/IncomeSourcesCard'
import { MutualAidCard } from './ui/MutualAidCard'
import { TaxGuideCard } from './ui/TaxGuideCard'
import { OpinionCard } from './ui/OpinionCard'

const MAIN_TABS = ['요약', '사적연금', '은퇴 설계', '진단 리포트', '종합 의견', '분리과세 가이드'] as const
const SUB_TABS = ['자산 구성', '시뮬레이션 · 스트레스', '보유 현황'] as const
const RETIRE_SUB_TABS = ['프리셋 설정', '교직원 공제회', '추가 수입원', '시뮬레이터'] as const

// 테마 (백로그 5): 자동(OS) → 다크 → 라이트 순환, localStorage 유지
const THEME_KEY = 'pension-compass-theme'
type Theme = 'auto' | 'dark' | 'light'
function applyTheme(t: Theme) {
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [lockOpen, setLockOpen] = useState(false)
  const [tab, setTab] = useState(0)
  const [subTab, setSubTab] = useState(0)
  const [retireSubTab, setRetireSubTab] = useState(0)
  const [theme, setTheme] = useState<Theme>(() => {
    const t = (localStorage.getItem(THEME_KEY) as Theme) ?? 'auto'
    applyTheme(t)
    return t
  })
  const cycleTheme = () => {
    const next: Theme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto'
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
    setTheme(next)
  }
  const { preset, setProfile } = useStore()

  const onExport = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `연금나침반_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = importJSON(await f.text())
    if (!r.ok) alert(`가져오기 실패: ${r.error}`)
    e.target.value = ''
  }

  return (
    <LockGate>
      <div className="wrap">
        <div className="topbar">
          <div>
            <h1>
              연금나침반 <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>v0.4 (M6)</span>
              <span className="badge">룰 기준연도 {rules.year}</span>
            </h1>
            <div className="sub">
              로컬 우선 은퇴 설계 — 데이터는 이 기기(localStorage)에만 저장됩니다. 가정을 바꾸면 즉시 다시 계산됩니다.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button onClick={onExport}>JSON 내보내기</button>
            <button onClick={() => fileRef.current?.click()}>JSON 가져오기</button>
            <button onClick={() => setLockOpen((v) => !v)}>{getLock() ? '🔒 잠금 변경' : '🔓 잠금 설정'}</button>
            <button onClick={cycleTheme} title="테마 전환 (자동/다크/라이트)">
              {theme === 'auto' ? '🌗 자동' : theme === 'dark' ? '🌙 다크' : '☀️ 라이트'}
            </button>
            <RuleCheck />
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImport} />
            {lockOpen && <LockSettings onClose={() => setLockOpen(false)} />}
          </div>
        </div>

        <div className="tabs main">
          {MAIN_TABS.map((t, i) => (
            <button key={t} className={i === tab ? 'active' : ''} onClick={() => setTab(i)}>
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && <HomeCard goTab={setTab} />}

        {tab === 1 && (
          <>
            <div className="tabs sub">
              {SUB_TABS.map((t, i) => (
                <button key={t} className={i === subTab ? 'active' : ''} onClick={() => setSubTab(i)}>
                  {t}
                </button>
              ))}
            </div>
            {subTab === 0 && <AllocationCard />}
            {subTab === 1 && <SimulationCard />}
            {subTab === 2 && <HoldingsCard />}
          </>
        )}

        {tab === 2 && (
          <>
            <div className="tabs sub">
              {RETIRE_SUB_TABS.map((t, i) => (
                <button key={t} className={i === retireSubTab ? 'active' : ''} onClick={() => setRetireSubTab(i)}>
                  {t}
                </button>
              ))}
            </div>
            {retireSubTab === 0 && (
              <>
                <div className="controls" style={{ marginBottom: 12 }}>
                  <div className="ctl">
                    <label>직업 프리셋 (연금 추정 방식)</label>
                    <select value={preset} onChange={(e) => setProfile({ preset: e.target.value as typeof preset })}>
                      <option value="teacher">교사 (공무원연금)</option>
                      <option value="official">일반직 공무원 (공무원연금)</option>
                      <option value="employee">회사원 (국민연금)</option>
                      <option value="self">자영업 (국민연금 지역)</option>
                    </select>
                  </div>
                </div>
                {preset === 'teacher' || preset === 'official' ? <TeacherCard /> : <NpsCard />}
              </>
            )}
            {retireSubTab === 1 && <MutualAidCard />}
            {retireSubTab === 2 && <IncomeSourcesCard />}
            {retireSubTab === 3 && <RetirementCard />}
          </>
        )}

        {tab === 3 && <ReportCard />}

        {tab === 4 && <OpinionCard />}

        {tab === 5 && <TaxGuideCard />}

        <OnboardingWizard />

        <div className="note">
          민예원선생님(iepnote@gmail.com)이 대책 없는 노후를 걱정하며 만들어보았습니다. 모든 수치는 가정에 따른
          근사치이며 투자자문·세무대리가 아니니 꼭 전문가와 상담하세요.
        </div>
      </div>
    </LockGate>
  )
}
