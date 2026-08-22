import { useMemo, useState } from 'react'
import { normWeights, simulateGrowth } from '../engine/simulate/montecarlo'
import { STRESS, applyStress } from '../engine/simulate/stress'
import { useStore } from '../store/useStore'
import { GrowthChart, type ScenarioA } from './GrowthChart'
import { fmt억, fmt만 } from './fmt'

// 몬테카를로 결과 + A/B 비교 + 스트레스 테스트 (사적연금 탭 2페이지)
export function SimulationCard() {
  const { assets, init, monthly, years } = useStore()
  const [scenarioA, setScenarioA] = useState<ScenarioA | null>(null)
  const [stress, setStress] = useState<ReturnType<typeof applyStress> | null>(null)

  const result = useMemo(() => simulateGrowth(assets, init, monthly, years), [assets, init, monthly, years])
  const wn = normWeights(assets)

  const y = result.years
  const med = result.bands.p50[y]
  const lo = result.bands.p5[y]
  const hi = result.bands.p95[y]
  const pr = result.bands.principal[y]

  return (
    <>
      <div className="card">
        <h2>
          시뮬레이션 결과<span className="hint">몬테카를로 2,000회 · 월 단위 · 세금/수수료/환율 미반영 · 입력 변경 시 자동 재계산</span>
        </h2>
        <div className="tiles">
          <div className="tile">
            <div className="k">{y}년 뒤 중앙값</div>
            <div className="v accent1">{fmt억(med)}</div>
            <div className="d">
              원금 대비 {med >= pr ? '+' : ''}
              {fmt만(med - pr)}원
            </div>
          </div>
          <div className="tile">
            <div className="k">불운한 경우 (하위 5%)</div>
            <div className="v">{fmt억(lo)}</div>
            <div className="d">{lo < pr ? <span className="down">원금 하회</span> : '원금 상회'}</div>
          </div>
          <div className="tile">
            <div className="k">운 좋은 경우 (상위 5%)</div>
            <div className="v">{fmt억(hi)}</div>
          </div>
          <div className="tile">
            <div className="k">총 납입 원금</div>
            <div className="v">{fmt억(pr)}</div>
          </div>
          <div className="tile">
            <div className="k">원금 손실 확률</div>
            <div className="v">{result.probLoss.toFixed(1)}%</div>
            <div className="d">
              포트폴리오 기대수익 연 {(result.mu * 100).toFixed(1)}% · 변동성 {(result.sd * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <GrowthChart result={result} scenarioA={scenarioA} />
        <div className="legend" style={{ marginTop: 8 }}>
          <span>
            <span className="sw" style={{ background: 'var(--s1)' }} />
            현재안 중앙값
          </span>
          {scenarioA && (
            <span>
              <span className="sw" style={{ background: 'var(--s2)' }} />
              기준안(A) 중앙값
            </span>
          )}
          <span>
            <span className="sw" style={{ background: 'var(--band2)' }} />
            25~75% 범위
          </span>
          <span>
            <span className="sw" style={{ background: 'var(--band1)' }} />
            5~95% 범위
          </span>
          <span>
            <span className="sw" style={{ background: 'var(--axis)' }} />
            납입 원금
          </span>
        </div>
        <div className="controls">
          <button onClick={() => setScenarioA({ ...result, label: assets.map((_, i) => `${Math.round(wn[i] * 100)}%`).join('/') })}>
            현재 설정을 기준안(A)으로 고정
          </button>
          {scenarioA && <button onClick={() => setScenarioA(null)}>기준안 해제</button>}
        </div>
        {scenarioA && (
          <div style={{ marginTop: 14 }}>
            <h2>기준안(A) vs 현재안(B) 비교</h2>
            <table className="cmp">
              <thead>
                <tr>
                  <th></th>
                  <th className="num">기준안 A ({scenarioA.label})</th>
                  <th className="num">현재안 B</th>
                  <th className="num">차이 (B-A)</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['중앙값', scenarioA.bands.p50[scenarioA.years], result.bands.p50[y]],
                    ['하위 5%', scenarioA.bands.p5[scenarioA.years], result.bands.p5[y]],
                    ['상위 5%', scenarioA.bands.p95[scenarioA.years], result.bands.p95[y]],
                  ] as [string, number, number][]
                ).map(([k, av, bv]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="num">{fmt억(av)}</td>
                    <td className="num">{fmt억(bv)}</td>
                    <td className="num">
                      <span className={bv - av >= 0 ? 'up' : 'down'}>
                        {bv - av >= 0 ? '+' : ''}
                        {fmt만(bv - av)}원
                      </span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>원금 손실 확률</td>
                  <td className="num">{scenarioA.probLoss.toFixed(1)}%</td>
                  <td className="num">{result.probLoss.toFixed(1)}%</td>
                  <td className="num">{(result.probLoss - scenarioA.probLoss).toFixed(1)}%p</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>
          스트레스 테스트<span className="hint">현재 비중에 과거형 충격을 1년 적용했을 때의 즉시 평가손 (원화 근사)</span>
        </h2>
        <div className="stressrow">
          {Object.keys(STRESS).map((k) => (
            <button key={k} onClick={() => setStress(applyStress(assets, init, k))}>
              {STRESS[k].label}
            </button>
          ))}
        </div>
        <div className="stressout">
          {stress ? (
            <>
              <b>{stress.label}</b>이(가) 지금 온다면, 현재 구성 기준 약{' '}
              <span className="big down">
                {fmt만(stress.loss)}원 ({stress.shockPct.toFixed(1)}%)
              </span>
              의 평가손이 예상됩니다.
              <br />이 숫자는 원칙 문서에서 이미 각오한 범위인지 확인하세요. 감내 한도: -50%.
            </>
          ) : (
            '시나리오 버튼을 누르면 현재 구성 기준 예상 손실이 계산됩니다.'
          )}
        </div>
        <div className="note">
          행동 지침(원칙 문서 §6): 어떤 시나리오에서도 매도하지 않는다 · 납입을 계속한다 · 정기 리밸런싱일에만 조정한다.
        </div>
      </div>
    </>
  )
}
