import { useMemo, useState } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { RetirementInput, Rules } from '../engine/types'
import { compareHousingPension, deflateResult, retentionProbability, simulateRetirement, type RetirementResult } from '../engine/pension/retirement'
import { useStore } from '../store/useStore'
import { RetirementChart } from './RetirementChart'
import { fmt만 } from './fmt'

const RULES = rulesJson as unknown as Rules

const DETAIL_FIELDS: [keyof RetirementInput, string, number][] = [
  ['inflation', '물가상승률 %/년', 0.1],
  ['potInitial', '사적연금 잔액 (만, 은퇴 시점)', 1000],
  ['privateAnnual', '사적 연수령 (만/년)', 100],
  ['privateStartAge', '사적연금 개시 나이', 1],
  ['potReturn', '사적 운용 %/년', 0.5],
  ['housingMonthly', '주택연금 (만/월)', 5],
  ['housingStartAge', '주택연금 개시 나이', 1],
  ['reservePool', '예비 풀: 공제회+ISA (만)', 500],
]

function summaryTiles(r: RetirementResult, endAge: number) {
  const sum = (row: RetirementResult['rows'][0]) =>
    row.pub + row.extraPublic + row.priv + row.hpm + row.mutualAid + row.extra + row.poolDraw
  return { sum, poolOut: r.poolOutAge ? `${r.poolOutAge}세` : `${endAge}세+ 유지`, uncovered: r.uncoveredAge }
}

export function RetirementCard() {
  const { retirement, setRetirement, incomeSources, scenarios, saveScenario, loadScenario, deleteScenario, birthYear } =
    useStore()

  // 목표 생활비 이원화: 현재 기준 입력 → 은퇴년 기준으로 물가 환산해 엔진 값(targetMonthly) 동기화
  const retireYear = birthYear + retirement.startAge // 만나이 근사
  const yearsToRetire = Math.max(retireYear - new Date().getFullYear(), 0)
  const inflFactor = Math.pow(1 + retirement.inflation / 100, yearsToRetire)
  const targetToday = retirement.targetMonthlyToday ?? Math.round(retirement.targetMonthly / inflFactor)
  const setTargetToday = (v: number, inflation = retirement.inflation) => {
    const f = Math.pow(1 + inflation / 100, yearsToRetire)
    setRetirement({ targetMonthlyToday: v, inflation, targetMonthly: Math.round(v * f), inflFactorToRetire: +f.toFixed(4) })
  }
  const [showHousingCompare, setShowHousingCompare] = useState(false)
  const [scenName, setScenName] = useState('')
  const [compareIds, setCompareIds] = useState<string[]>([]) // 나란히 비교할 시나리오 (최대 2)

  const [potVol, setPotVol] = useState(10) // 사적연금 수익률 변동성 %/년 (몬테카를로 모드)
  const [realView, setRealView] = useState(false) // 실질가치(은퇴년 기준) 보기 — 물가 착시 제거
  const nominalResult = useMemo(() => simulateRetirement(retirement, RULES, incomeSources), [retirement, incomeSources])
  const result = useMemo(() => (realView ? deflateResult(nominalResult, retirement) : nominalResult), [realView, nominalResult, retirement])
  const retention = useMemo(
    () => retentionProbability(retirement, RULES, incomeSources, { potVol }),
    [retirement, incomeSources, potVol],
  )
  const housingCmp = useMemo(
    () => (showHousingCompare ? compareHousingPension(retirement, RULES, incomeSources) : null),
    [showHousingCompare, retirement, incomeSources],
  )

  const rows = result.rows
  const first = rows[0]
  const pubStart = retirement.publicStartAge ?? RULES.pensionOpenAge.publicPension
  const row65 = rows.find((r) => r.age === pubStart) ?? first
  const { sum } = summaryTiles(result, retirement.endAge)

  return (
    <div className="card">
      <h2>
        은퇴 설계 시뮬레이터 ({retirement.startAge}세~{retirement.endAge}세)
        <span className="hint">가정을 바꾸면 즉시 재계산 · 공적연금은 물가연동, 사적·주택연금은 명목 고정으로 계산</span>
      </h2>
      <div className="controls" style={{ marginBottom: 14 }}>
        <div className="ctl">
          <label>은퇴(시뮬 시작) 나이</label>
          <input
            type="number" step={1} min={50} max={70} value={retirement.startAge}
            onChange={(e) => {
              const v = +e.target.value
              const yrs = Math.max(birthYear + v - new Date().getFullYear(), 0)
              const f = Math.pow(1 + retirement.inflation / 100, yrs)
              setRetirement({ startAge: v, targetMonthly: Math.round(targetToday * f), inflFactorToRetire: +f.toFixed(4) })
            }}
          />
        </div>
        <div className="ctl">
          <label>목표 생활비 (만/월, 현재 기준)</label>
          <input type="number" step={10} value={targetToday} onChange={(e) => setTargetToday(+e.target.value)} />
        </div>
        <div className="ctl">
          <label>→ 은퇴년({retireYear}년) 기준</label>
          <div style={{ padding: '5px 7px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {fmt만(Math.round(targetToday * inflFactor))}/월
          </div>
        </div>
        <div className="ctl">
          <label>공적연금 (만/월, 은퇴년 명목, {retirement.publicStartAge ?? RULES.pensionOpenAge.publicPension}세~)</label>
          <input type="number" step={5} value={retirement.publicMonthly} onChange={(e) => setRetirement({ publicMonthly: +e.target.value })} />
        </div>
      </div>
      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--ink2)', fontWeight: 600 }}>
          상세 가정 — 물가 {retirement.inflation}% · 사적 {(retirement.potInitial / 10000).toFixed(1)}억/연 {retirement.privateAnnual.toLocaleString('ko-KR')}만(운용 {retirement.potReturn}%) · 주택 {retirement.housingMonthly}만({retirement.housingStartAge}세~) · 예비 풀 {(retirement.reservePool / 10000).toFixed(2)}억
        </summary>
        <div className="controls" style={{ marginTop: 10 }}>
          {DETAIL_FIELDS.map(([key, label, step]) => (
            <div className="ctl" key={key}>
              <label>{label}</label>
              <input
                type="number" step={step} value={(retirement[key] as number | undefined) ?? retirement.startAge}
                onChange={(e) =>
                  key === 'inflation' ? setTargetToday(targetToday, +e.target.value) : setRetirement({ [key]: +e.target.value })
                }
              />
            </div>
          ))}
        </div>
      </details>

      <div className="tiles">
        <div className="tile">
          <div className="k">
            공백기 ({retirement.startAge}~{pubStart - 1}세) 월수입
          </div>
          <div className="v">{fmt만(sum(first))}</div>
          <div className="d">목표 {fmt만(first.tgt)}</div>
        </div>
        <div className="tile">
          <div className="k">{pubStart}세 월수입</div>
          <div className="v accent1">{fmt만(sum(row65))}</div>
          {row65.suspended > 0.005 && <div className="d down">지급정지 −{fmt만(row65.suspended)}/월 반영</div>}
        </div>
        <div className="tile">
          <div className="k">예비 풀 고갈</div>
          <div className="v" style={{ color: result.poolOutAge ? 'var(--crit)' : 'var(--good)' }}>
            {result.poolOutAge ? `${result.poolOutAge}세` : `${retirement.endAge}세+ 유지`}
          </div>
          <div className="d">
            {result.uncoveredAge ? (
              <span className="down">{result.uncoveredAge}세부터 목표 미달</span>
            ) : (
              `${retirement.endAge}세까지 목표 충당`
            )}
          </div>
        </div>
        <div className="tile">
          <div className="k">85세 잔여 자산</div>
          <div className="v">{result.bal85 === null ? '—' : (result.bal85 / 10000).toFixed(2) + '억'}</div>
          <div className="d">예비 풀 + 사적연금 잔액</div>
        </div>
        <div className="tile">
          <div className="k">{retirement.endAge}세 목표 유지 확률</div>
          <div className="v" style={{ color: retention.probRetained >= 80 ? 'var(--good)' : retention.probRetained >= 60 ? 'var(--s4)' : 'var(--crit)' }}>
            {retention.probRetained.toFixed(1)}%
          </div>
          <div className="d">
            몬테카를로 {retention.runs.toLocaleString('ko-KR')}회 · 사적 변동성 ±
            <input
              type="number" step={1} min={0} max={30} value={potVol}
              onChange={(e) => setPotVol(+e.target.value)}
              style={{ width: 44, padding: '1px 4px', fontSize: 11.5 }}
            />
            %
          </div>
        </div>
      </div>
      <div className="controls no-print" style={{ marginBottom: 4 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={realView} onChange={(e) => setRealView(e.target.checked)} />
          실질가치로 보기 ({retirement.startAge}세 시점 구매력 기준 — 물가 착시 제거)
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={retirement.sweepSurplus ?? false} onChange={(e) => setRetirement({ sweepSurplus: e.target.checked })} />
          잉여 생활비를 예비 풀로 적립 (목표 초과 수입을 ISA 등에 재투자 가정)
        </label>
        {realView && (
          <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
            물가연동 항목(목표·공적)은 평평해지고, 명목 고정 재원(사적·주택)의 침식이 그대로 보입니다
          </span>
        )}
      </div>
      <RetirementChart result={result} />
      <div className="legend" style={{ marginTop: 8 }}>
        <span>
          <span className="sw" style={{ background: 'var(--s1)' }} />
          공무원연금 (물가연동)
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--s1b)' }} />
          국민연금 등 병행 공적
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--s2)' }} />
          사적연금 (세후)
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--s3)' }} />
          주택연금 (비과세)
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--s6)' }} />
          공제회 분할급여 (분리과세)
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--s5)' }} />
          추가 수입원 (세후)
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--s4)' }} />
          예비 풀 인출
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--axis)' }} />
          목표 생활비 ({realView ? '실질' : '명목'})
        </span>
      </div>

      <div className="controls" style={{ marginTop: 14 }}>
        <button onClick={() => setShowHousingCompare((v) => !v)}>
          {showHousingCompare ? '주택연금 O/X 비교 닫기' : '주택연금 O/X 비교'}
        </button>
        <div className="ctl">
          <label>시나리오 이름</label>
          <input type="text" value={scenName} onChange={(e) => setScenName(e.target.value)} placeholder="예: 재취업 없음" />
        </div>
        <button
          onClick={() => {
            if (scenName.trim()) {
              saveScenario(scenName.trim())
              setScenName('')
            }
          }}
        >
          현재 가정을 시나리오로 저장
        </button>
      </div>

      {housingCmp && (
        <div style={{ marginTop: 12 }}>
          <table className="cmp">
            <thead>
              <tr>
                <th></th>
                <th className="num">주택연금 O ({fmt만(retirement.housingMonthly)}/월)</th>
                <th className="num">주택연금 X</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>예비 풀 고갈</td>
                <td className="num">{housingCmp.on.poolOutAge ? `${housingCmp.on.poolOutAge}세` : '유지'}</td>
                <td className="num">{housingCmp.off.poolOutAge ? `${housingCmp.off.poolOutAge}세` : '유지'}</td>
              </tr>
              <tr>
                <td>목표 미달 시작</td>
                <td className="num">{housingCmp.on.uncoveredAge ? `${housingCmp.on.uncoveredAge}세` : '없음'}</td>
                <td className="num">{housingCmp.off.uncoveredAge ? `${housingCmp.off.uncoveredAge}세` : '없음'}</td>
              </tr>
              <tr>
                <td>85세 잔여 자산</td>
                <td className="num">{housingCmp.on.bal85 === null ? '—' : (housingCmp.on.bal85 / 10000).toFixed(2) + '억'}</td>
                <td className="num">{housingCmp.off.bal85 === null ? '—' : (housingCmp.off.bal85 / 10000).toFixed(2) + '억'}</td>
              </tr>
              <tr>
                <td>{retirement.endAge}세 잔여 자산</td>
                <td className="num">{((housingCmp.on.potEnd + housingCmp.on.poolEnd) / 10000).toFixed(2)}억</td>
                <td className="num">{((housingCmp.off.potEnd + housingCmp.off.poolEnd) / 10000).toFixed(2)}억</td>
              </tr>
            </tbody>
          </table>
          <div className="note">
            주택연금 X는 다른 가정을 그대로 두고 주택연금만 0으로 계산합니다. 주택 자산 가치·상속은 이 비교에 포함되지
            않습니다 (원칙 문서 §9: 조기 개시 방침).
          </div>
        </div>
      )}

      {scenarios.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>저장된 시나리오</th>
                <th>저장일</th>
                <th className="num">예비 풀 고갈</th>
                <th className="num">85세 잔여</th>
                <th>비교</th>
                <th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc) => {
                const r = simulateRetirement(sc.retirement, RULES, sc.incomeSources)
                return (
                  <tr key={sc.id}>
                    <td>{sc.name}</td>
                    <td>{sc.savedAt.slice(0, 10)}</td>
                    <td className="num">{r.poolOutAge ? `${r.poolOutAge}세` : '유지'}</td>
                    <td className="num">{r.bal85 === null ? '—' : (r.bal85 / 10000).toFixed(2) + '억'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={compareIds.includes(sc.id)}
                        onChange={(e) =>
                          setCompareIds(e.target.checked ? [...compareIds, sc.id].slice(-2) : compareIds.filter((x) => x !== sc.id))
                        }
                      />
                    </td>
                    <td>
                      <button style={{ padding: '4px 9px', marginRight: 6 }} onClick={() => loadScenario(sc.id)}>
                        불러오기
                      </button>
                      <button style={{ padding: '4px 9px' }} onClick={() => deleteScenario(sc.id)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {compareIds.length > 0 && (
            <table className="cmp" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th></th>
                  <th className="num">현재 가정</th>
                  {compareIds.map((id) => (
                    <th key={id} className="num">
                      {scenarios.find((s) => s.id === id)?.name ?? '?'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const cols = [
                    { inp: retirement, ext: incomeSources, res: nominalResult },
                    ...compareIds
                      .map((id) => scenarios.find((s) => s.id === id))
                      .filter((s): s is NonNullable<typeof s> => !!s)
                      .map((s) => ({ inp: s.retirement, ext: s.incomeSources, res: simulateRetirement(s.retirement, RULES, s.incomeSources) })),
                  ]
                  const rows: [string, (c: (typeof cols)[0]) => string][] = [
                    ['목표 생활비 (은퇴년)', (c) => `${fmt만(c.inp.targetMonthly)}/월`],
                    ['공적연금', (c) => `${fmt만(c.inp.publicMonthly)}/월`],
                    ['주택연금', (c) => `${fmt만(c.inp.housingMonthly)}/월`],
                    ['추가 수입원', (c) => `${c.ext.length}건`],
                    ['예비 풀 고갈', (c) => (c.res.poolOutAge ? `${c.res.poolOutAge}세` : '유지')],
                    ['목표 미달 시작', (c) => (c.res.uncoveredAge ? `${c.res.uncoveredAge}세` : '없음')],
                    ['85세 잔여', (c) => (c.res.bal85 === null ? '—' : (c.res.bal85 / 10000).toFixed(2) + '억')],
                    [`${retirement.endAge}세 유지 확률`, (c) => `${retentionProbability(c.inp, RULES, c.ext, { potVol }).probRetained.toFixed(0)}%`],
                  ]
                  return rows.map(([label, fn]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      {cols.map((c, i) => (
                        <td key={i} className="num">
                          {fn(c)}
                        </td>
                      ))}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="note">
        인플레 부족분 충당 순서(원칙 문서 v2 §9): ① 예비 풀(공제회·ISA, 비과세) ② 사적연금 한도 초과 인출(전액{' '}
        {RULES.tax.privatePension.overLimitRate * 100}% — 최후 수단, 이 시뮬레이터는 풀 고갈 시 자동 적용). 사적연금 연
        수령은 {RULES.tax.privatePension.annualLimit / 10000}만 이하 유지 시 저율(나이별 5.5→4.4→3.3%) 자동 반영. 임대·기타
        세후는 분리과세 근사(상가 임대는 종합과세 대상이라 과소추정 가능), 재취업 근로소득세는 소액 근사로 0 처리.
      </div>
    </div>
  )
}
