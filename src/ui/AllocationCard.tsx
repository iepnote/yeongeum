import type { AssetMix } from '../engine/types'
import { PRESETS, normWeights } from '../engine/simulate/montecarlo'
import { useStore } from '../store/useStore'
import { fmt만 } from './fmt'

export const MIX_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

// 자산 구성 편집 (사적연금 탭 1페이지)
export function AllocationCard() {
  const { assets, init, monthly, years, setAssets, setSim, resetAssets } = useStore()
  const wn = normWeights(assets)

  const patch = (i: number, p: Partial<AssetMix>) => setAssets(assets.map((a, j) => (j === i ? { ...a, ...p } : a)))
  const onPreset = (i: number, preset: string) => {
    const p = PRESETS[preset]
    patch(i, { preset, mu: p.mu, vol: p.vol, ...(preset !== '직접 입력' ? { name: preset } : {}) })
  }

  return (
    <div className="card">
      <h2>
        자산 구성
        <span className="hint">이름·기대수익률·변동성 수정 가능 · 프리셋으로 상품 교체 · 비중은 자동으로 100% 환산</span>
      </h2>
      <div className="allocbar">
        {assets.map((a, i) => (
          <div key={i} style={{ width: `${wn[i] * 100}%`, background: MIX_COLORS[i % 4] }} title={a.name} />
        ))}
      </div>
      <div className="legend">
        {assets.map((a, i) => (
          <span key={i}>
            <span className="sw" style={{ background: MIX_COLORS[i % 4] }} />
            {a.name} <b>{(wn[i] * 100).toFixed(0)}%</b>
          </span>
        ))}
      </div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 26 }}></th>
              <th>자산명</th>
              <th>프리셋</th>
              <th>비중</th>
              <th className="num">기대수익 %/년</th>
              <th className="num">변동성 %/년</th>
              <th className="num">금액(만원)</th>
              <th style={{ width: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a, i) => (
              <tr key={i}>
                <td>
                  <span className="sw" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: MIX_COLORS[i % 4] }} />
                </td>
                <td>
                  <input type="text" value={a.name} onChange={(e) => patch(i, { name: e.target.value })} />
                </td>
                <td>
                  <select value={a.preset} onChange={(e) => onPreset(i, e.target.value)}>
                    {Object.keys(PRESETS).map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <input type="range" min={0} max={100} step={1} value={a.w} onChange={(e) => patch(i, { w: +e.target.value })} />
                  <span className="wpct">{(wn[i] * 100).toFixed(0)}%</span>
                </td>
                <td className="num">
                  <input type="number" step={0.5} value={a.mu} onChange={(e) => patch(i, { mu: +e.target.value })} />
                </td>
                <td className="num">
                  <input type="number" step={0.5} min={0} value={a.vol} onChange={(e) => patch(i, { vol: +e.target.value })} />
                </td>
                <td className="num">{fmt만(init * wn[i])}</td>
                <td>
                  <button
                    title="삭제" style={{ padding: '4px 9px' }} disabled={assets.length <= 1}
                    onClick={() => setAssets(assets.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="controls">
        <div className="ctl">
          <label>시작 자산 (만원)</label>
          <input type="number" step={100} value={init} onChange={(e) => setSim({ init: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>월 납입 (만원)</label>
          <input type="number" step={5} value={monthly} onChange={(e) => setSim({ monthly: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>기간 (년): {years}</label>
          <input type="range" min={1} max={30} value={years} onChange={(e) => setSim({ years: +e.target.value })} />
        </div>
        <button onClick={() => setAssets([...assets, { name: '새 자산', preset: '직접 입력', w: 10, mu: 7, vol: 12 }])}>
          + 자산 추가
        </button>
        <button onClick={resetAssets}>원칙 문서 v1 배분으로 초기화</button>
      </div>
      <div className="note">비중·납입을 바꾸면 "시뮬레이션·스트레스" 페이지의 결과가 즉시 반영됩니다. 사적연금은 퇴직 이후 납입이 실효성이 적습니다.</div>
    </div>
  )
}
