import { useMemo, useState } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { IncomeKind, IncomeSource, Rules } from '../engine/types'
import { extrasAt, simulateRetirement } from '../engine/pension/retirement'
import { netFactorOf } from '../engine/tax/incomeSourceTax'
import { npsOpenAge } from '../engine/pension/nps'
import { estimateHousingPension } from '../engine/pension/housingPension'
import { employeePremium, regionalPremium } from '../engine/nhis'
import { useStore } from '../store/useStore'
import { retireContext } from './retireContext'
import { fmt만 } from './fmt'

const RULES = rulesJson as unknown as Rules

const KIND_LABEL: Record<IncomeKind, string> = {
  'public-extra': '국민연금 등 공적 (물가연동)',
  'mutual-aid': '교직원 공제회 (분할급여)',
  'rent-housing': '임대 (주택)',
  'rent-commercial': '임대 (상가)',
  work: '근로 (재취업)',
  other: '기타소득',
}

// 추가 수입원 관리 (은퇴 설계 서브탭 2) — 국민연금 병행·공제회 빠른 추가 + 5속성 편집 + 재취업 손익
export function IncomeSourcesCard() {
  const { retirement, setRetirement, incomeSources, setIncomeSources, birthYear, propertyTaxBase, housePrice, setDiag } = useStore()
  const [npsAmount, setNpsAmount] = useState(0)
  const [npsBasis, setNpsBasis] = useState<'today' | 'at-open'>('today') // 조회 금액의 화폐 기준 — 내연금 기본 조회는 현재가치(물가 미반영, 공단 화면 실증)
  const housingEst = estimateHousingPension(housePrice, retirement.housingStartAge, RULES)
  const { inflFactor } = retireContext(birthYear, retirement)

  const npsAge = npsOpenAge(birthYear, RULES)
  const existingNps = incomeSources.find((s) => s.kind === 'public-extra')

  const nominalResult = useMemo(() => simulateRetirement(retirement, RULES, incomeSources), [retirement, incomeSources])
  const patchSource = (i: number, p: Partial<IncomeSource>) =>
    setIncomeSources(incomeSources.map((s, j) => (j === i ? { ...s, ...p } : s)))

  // 재취업 손익 (연금 수급과 겹치는 첫 나이 기준)
  const workSources = incomeSources.filter((s) => s.kind === 'work' && s.monthlyAmount > 0)
  const reemp = useMemo(() => {
    if (!workSources.length) return null
    const overlapAge = Math.max(retirement.publicStartAge ?? RULES.pensionOpenAge.publicPension, Math.min(...workSources.map((s) => s.startAge)))
    const row = nominalResult.rows.find((r) => r.age === overlapAge)
    if (!row) return null
    const f = Math.pow(1 + retirement.inflation / 100, overlapAge - retirement.startAge)
    const { workGross } = extrasAt(overlapAge, f, incomeSources, RULES)
    // 건보 비교는 현행 룰(현재 고시) 기준 — 명목 금액을 현재가치로 환산해 판정 (문턱 물가연동 가정)
    const toToday = f * (retirement.inflFactorToRetire ?? 1)
    const pubAnnualWon = (row.pub / toToday) * 12 * 10000
    const regional = regionalPremium({ publicPensionAnnual: pubAnnualWon, propertyTaxBase: propertyTaxBase * 10000 }, RULES.nhis)
    const employee = employeePremium({ monthlySalary: (workGross / toToday) * 10000, publicPensionAnnual: pubAnnualWon }, RULES.nhis)
    const nhisSaveMonthly = ((regional.totalMonthly - employee.totalMonthly) / 10000) * toToday // 명목으로 되돌림
    return { overlapAge, workGross, suspended: row.suspended, nhisSaveMonthly, net: workGross - row.suspended + nhisSaveMonthly }
  }, [workSources, nominalResult, incomeSources, retirement, propertyTaxBase])

  const addSource = (p: Omit<IncomeSource, 'id'>) => setIncomeSources([...incomeSources, { id: crypto.randomUUID(), ...p }])

  return (
    <div className="card">
      <h2>
        추가 수입원<span className="hint">세전 월액 입력 → 과세 유형별 세후 자동 반영 (F-5) · 시뮬레이터 차트에 층으로 표시</span>
      </h2>

      <div className="controls" style={{ marginBottom: 6 }}>
        <div className="ctl">
          <label>국민연금 병행 수령 (만/월)</label>
          <input type="number" step={5} min={0} value={npsAmount || ''} placeholder="—" onChange={(e) => setNpsAmount(+e.target.value)} />
        </div>
        <div className="ctl">
          <label>조회 금액의 화폐 기준</label>
          <select value={npsBasis} onChange={(e) => setNpsBasis(e.target.value as 'today' | 'at-open')}>
            <option value="at-open">수령 개시 시점 실수령액 (미래가치 조회)</option>
            <option value="today">현재가치 기준 (내연금 '현재가치' 표시)</option>
          </select>
        </div>
        <button
          disabled={npsAmount <= 0}
          onClick={() => {
            // 엔진은 시뮬 시작 나이 기준 명목을 저장하고 이후 물가연동 — 기준별 환산:
            const openGrowth = Math.pow(1 + retirement.inflation / 100, Math.max(npsAge - retirement.startAge, 0))
            const stored = npsBasis === 'at-open' ? npsAmount / openGrowth : npsAmount * inflFactor
            const row = {
              id: existingNps?.id ?? crypto.randomUUID(),
              label: '국민연금',
              kind: 'public-extra' as const,
              monthlyAmount: Math.round(stored * 10) / 10,
              startAge: npsAge,
              endAge: null,
              inflationLinked: true,
            }
            setIncomeSources(existingNps ? incomeSources.map((s) => (s.id === existingNps.id ? row : s)) : [...incomeSources, row])
            setNpsAmount(0)
          }}
        >
          + 국민연금 {existingNps ? '갱신' : '추가'} — {npsAge}세 개시 시점 수령액{' '}
          {npsAmount > 0
            ? fmt만(npsBasis === 'at-open' ? npsAmount : npsAmount * inflFactor * Math.pow(1 + retirement.inflation / 100, Math.max(npsAge - retirement.startAge, 0)))
            : '—'}
          /월 기준
        </button>
        {existingNps && (
          <span style={{ fontSize: 12.5, color: 'var(--good)' }}>
            ✓ 국민연금 {fmt만(existingNps.monthlyAmount)}/월 반영 중 ({existingNps.startAge}세~)
          </span>
        )}
      </div>
      <div className="controls" style={{ marginBottom: 6 }}>
        <div className="ctl">
          <label>주택 시세 (만 — 월지급금 추정용)</label>
          <input type="number" step={1000} min={0} value={housePrice || ''} placeholder="—" onChange={(e) => setDiag({ housePrice: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>주택연금 개시 나이 (부부는 연소자)</label>
          <input type="number" step={1} min={55} value={retirement.housingStartAge} onChange={(e) => setRetirement({ housingStartAge: +e.target.value })} />
        </div>
        {housePrice > 0 && (
          <>
            <div className="ctl">
              <label>→ 추정 월지급금 (종신 정액형)</label>
              <div style={{ padding: '5px 7px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {fmt만(housingEst)}/월
              </div>
            </div>
            <button className="primary" onClick={() => setRetirement({ housingMonthly: Math.round(housingEst) })}>
              주택연금에 반영
            </button>
          </>
        )}
        <span style={{ fontSize: 12.5, color: retirement.housingMonthly > 0 ? 'var(--good)' : 'var(--muted)' }}>
          {retirement.housingMonthly > 0
            ? `✓ 주택연금 ${retirement.housingMonthly}만/월 반영 중 — 아래 표에서 수정·삭제`
            : '미사용 — 시세를 넣고 "주택연금에 반영"을 누르면 아래 표에 추가됩니다'}
        </span>
      </div>
      <div className="note" style={{ marginTop: -2, marginBottom: 10 }}>
        추정식: 백문백답('26.3월 기준) 일반주택 종신지급 정액형 표의 보간값 — 예시표는 매년 재산출되므로 실제 가입
        전에는 주택금융공사(hf.go.kr) 조회값을 우선하세요. 부부 가구는 연소자 연령 기준입니다.
      </div>
      <div className="controls" style={{ marginBottom: 12 }}>
        <button
          onClick={() =>
            addSource({ label: '새 수입원', kind: 'rent-housing', monthlyAmount: 0, startAge: retirement.startAge, endAge: null, inflationLinked: false })
          }
        >
          + 직접 추가 (임대·재취업·기타)
        </button>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>공제회 분할급여는 "교직원 공제회" 탭에서 추정·반영합니다</span>
      </div>

      {incomeSources.length > 0 || retirement.housingMonthly > 0 ? (
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table>
            <thead>
              <tr>
                <th>종류</th>
                <th>이름</th>
                <th className="num">세전 (만/월)</th>
                <th className="num">시작 나이</th>
                <th className="num">종료 나이</th>
                <th>물가연동</th>
                <th className="num">세후 (만/월)</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {retirement.housingMonthly > 0 && (
                <tr>
                  <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>주택연금 (비과세·종신)</td>
                  <td style={{ minWidth: 110, fontSize: 12.5, color: 'var(--ink2)' }}>주택연금</td>
                  <td className="num">
                    <input type="number" step={5} min={0} value={retirement.housingMonthly} onChange={(e) => setRetirement({ housingMonthly: +e.target.value })} />
                  </td>
                  <td className="num">
                    <input type="number" step={1} min={55} value={retirement.housingStartAge} onChange={(e) => setRetirement({ housingStartAge: +e.target.value })} />
                  </td>
                  <td className="num" style={{ fontSize: 12.5, color: 'var(--muted)' }}>종신</td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={false} disabled title="종신지급 정액형 — 명목 고정" />
                  </td>
                  <td className="num">{fmt만(retirement.housingMonthly)}</td>
                  <td>
                    <button title="삭제" style={{ padding: '4px 9px' }} onClick={() => setRetirement({ housingMonthly: 0 })}>
                      ✕
                    </button>
                  </td>
                </tr>
              )}
              {incomeSources.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <select value={s.kind} onChange={(e) => patchSource(i, { kind: e.target.value as IncomeKind })}>
                      {(Object.keys(KIND_LABEL) as IncomeKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <input type="text" value={s.label} onChange={(e) => patchSource(i, { label: e.target.value })} />
                  </td>
                  <td className="num">
                    <input type="number" step={10} min={0} value={s.monthlyAmount} onChange={(e) => patchSource(i, { monthlyAmount: +e.target.value })} />
                  </td>
                  <td className="num">
                    <input type="number" step={1} value={s.startAge} onChange={(e) => patchSource(i, { startAge: +e.target.value })} />
                  </td>
                  <td className="num">
                    <input
                      type="number" step={1} placeholder="종신" value={s.endAge ?? ''}
                      onChange={(e) => patchSource(i, { endAge: e.target.value === '' ? null : +e.target.value })}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={s.inflationLinked} onChange={(e) => patchSource(i, { inflationLinked: e.target.checked })} />
                  </td>
                  <td className="num">{fmt만(s.monthlyAmount * netFactorOf(s.kind, RULES))}</td>
                  <td>
                    <button title="삭제" style={{ padding: '4px 9px' }} onClick={() => setIncomeSources(incomeSources.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="note" style={{ marginBottom: 10 }}>아직 추가 수입원이 없습니다. 위 버튼으로 추가하면 시뮬레이터에 반영됩니다.</div>
      )}

      {reemp && (
        <div className="tiles" style={{ marginBottom: 6 }}>
          <div className="tile">
            <div className="k">재취업 손익 ({reemp.overlapAge}세 기준)</div>
            <div className="v" style={{ color: reemp.net >= 0 ? 'var(--good)' : 'var(--crit)' }}>
              {reemp.net >= 0 ? '+' : ''}
              {fmt만(reemp.net)}/월
            </div>
            <div className="d">근로 {fmt만(reemp.workGross)} − 연금 감액 {fmt만(reemp.suspended)} + 건보 변화 {reemp.nhisSaveMonthly >= 0 ? '+' : ''}{fmt만(reemp.nhisSaveMonthly)}</div>
          </div>
          <div className="tile">
            <div className="k">연금 지급정지 감액</div>
            <div className="v" style={{ color: reemp.suspended > 0 ? 'var(--crit)' : 'var(--good)' }}>
              {reemp.suspended > 0 ? `−${fmt만(reemp.suspended)}/월` : '없음'}
            </div>
            <div className="d">소득월액(공제 후) {fmt만(RULES.pensionSuspension.avgPensionMonthly / 10000)} 초과 시 30~70% 누진 (국민연금은 무관)</div>
          </div>
          <div className="tile">
            <div className="k">건보료: 지역 → 직장 전환</div>
            <div className="v" style={{ color: reemp.nhisSaveMonthly >= 0 ? 'var(--good)' : 'var(--crit)' }}>
              {reemp.nhisSaveMonthly >= 0 ? '+' : ''}
              {fmt만(reemp.nhisSaveMonthly)}/월
            </div>
            <div className="d">
              재산 과표{' '}
              <input
                type="number" step={1000} value={propertyTaxBase}
                onChange={(e) => setDiag({ propertyTaxBase: +e.target.value })}
                style={{ width: 80, padding: '1px 5px', fontSize: 11.5 }}
              />
              만 기준 · 직장 전환 시 재산분 미부과
            </div>
          </div>
        </div>
      )}

      <div className="note">
        국민연금 등 공적 병행분은 차트에서 공무원연금 옆 하늘색 층으로, 나머지는 보라색 층으로 표시됩니다. 공제회
        분할급여액은 총 급여금에 분할급여율(연 복리, 변동금리 — 공제회 고시 확인)을 적용한 원리금 균등 분할로
        계산합니다: 월액 = 총액×월이율 ÷ (1−(1+월이율)^−개월). 저율·비과세 근사(세후=세전)이며, 임대는 분리과세 근사,
        재취업 근로소득세는 소액 근사 0입니다.
      </div>
    </div>
  )
}
