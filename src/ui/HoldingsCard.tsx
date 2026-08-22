import { useMemo } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { HoldingCls, Rules } from '../engine/types'
import { HOLD_NOW, HOLD_PLAN } from '../engine/defaults'
import { effAmt, isComputed, retOf, costAmt, summarizeHoldings } from '../engine/pension/holdings'
import { importJSON, now, useStore } from '../store/useStore'
import { fmt만 } from './fmt'

const RULES = rulesJson as Rules
const CLS_LABEL: Record<HoldingCls, string> = {
  eq: '주식형(위험)',
  trf: '채권혼합(TRF류·안전)',
  safe: '안전(예금·채권·현금)',
}

export function HoldingsCard() {
  const { holdings, patchHolding, setHoldings } = useStore()
  const s = useMemo(() => summarizeHoldings(holdings, RULES), [holdings])
  const limitPct = RULES.account.irpRiskLimit * 100

  const badge =
    s.irpTot === 0 ? (
      <div className="d">IRP 보유 없음</div>
    ) : s.irpRatio <= RULES.account.irpRiskLimit ? (
      <div className="d">
        <span className="up">✓ 한도 내</span> · 위험자산 추가 매수 여력 <b>{fmt만(s.irpRoom)}원</b>
      </div>
    ) : (
      <div className="d">
        <span className="down">⚠ {limitPct}% 초과</span> · 위험자산 신규 매수 불가 상태 (<b>{fmt만(-s.irpRoom)}원</b> 초과)
      </div>
    )

  return (
    <div className="card">
      <h2>
        계좌별 보유 현황 · IRP 한도 검사
        <span className="hint">실제 보유 금액을 입력하면 유효 주식 비중과 IRP 위험자산 {limitPct}% 한도를 자동 검사합니다</span>
      </h2>
      <div className="tiles">
        <div className="tile">
          <div className="k">총자산</div>
          <div className="v">{fmt만(s.tot)}원</div>
          <div className="d">
            연금저축 {fmt만(s.pensionSavings)} · IRP {fmt만(s.irpTot)}
          </div>
        </div>
        {s.totRet === null ? (
          <div className="tile">
            <div className="k">평가손익 (수익률)</div>
            <div className="v" style={{ color: 'var(--muted)' }}>
              —
            </div>
            <div className="d">주수·평균단가·현재가를 입력하면 계산됩니다</div>
          </div>
        ) : (
          <div className="tile">
            <div className="k">평가손익 (수익률)</div>
            <div className="v" style={{ color: s.totPL >= 0 ? 'var(--good)' : 'var(--crit)' }}>
              {s.totPL >= 0 ? '+' : ''}
              {fmt만(s.totPL)}원
            </div>
            <div className="d">
              매입 {fmt만(s.costSum)} → 평가 {fmt만(s.valSum)} (
              <b>
                {s.totRet >= 0 ? '+' : ''}
                {(s.totRet * 100).toFixed(1)}%
              </b>
              )
            </div>
          </div>
        )}
        <div className="tile">
          <div className="k">유효 주식 비중</div>
          <div className="v accent1">{s.eqEffPct.toFixed(1)}%</div>
          <div className="d">TRF류는 {RULES.account.trfEquityFactor * 100}%만 주식으로 계산</div>
        </div>
        <div className="tile">
          <div className="k">IRP 위험자산 비율</div>
          <div className="v" style={{ color: s.irpRatio <= RULES.account.irpRiskLimit ? 'var(--good)' : 'var(--crit)' }}>
            {(s.irpRatio * 100).toFixed(1)}%
          </div>
          {badge}
        </div>
        <div className="tile">
          <div className="k">IRP 안전자산 비율</div>
          <div className="v">{s.irpTot ? ((1 - s.irpRatio) * 100).toFixed(1) : 0}%</div>
          <div className="d">규정 최소 {100 - limitPct}%</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>계좌</th>
              <th>자산명</th>
              <th>구분</th>
              <th className="num">보유 주수</th>
              <th className="num">평균단가(원)</th>
              <th className="num">현재가(원)</th>
              <th className="num">평가액(만원)</th>
              <th className="num">수익률</th>
              <th style={{ width: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const r = retOf(h)
              const c = costAmt(h)
              return (
                <tr key={i}>
                  <td>
                    <select value={h.acct} onChange={(e) => patchHolding(i, { acct: e.target.value as typeof h.acct })}>
                      <option>연금저축</option>
                      <option>IRP</option>
                    </select>
                  </td>
                  <td style={{ minWidth: 150 }}>
                    <input type="text" value={h.name} onChange={(e) => patchHolding(i, { name: e.target.value })} />
                  </td>
                  <td>
                    <select value={h.cls} onChange={(e) => patchHolding(i, { cls: e.target.value as HoldingCls })}>
                      {(Object.keys(CLS_LABEL) as HoldingCls[]).map((cls) => (
                        <option key={cls} value={cls}>
                          {CLS_LABEL[cls]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      type="number" step={1} min={0} style={{ width: 62 }} placeholder="—"
                      value={h.sh || ''} onChange={(e) => patchHolding(i, { sh: +e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number" step={10} min={0} style={{ width: 86 }} placeholder="—"
                      value={h.buy || ''} onChange={(e) => patchHolding(i, { buy: +e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number" step={10} min={0} style={{ width: 86 }} placeholder="—"
                      value={h.cur || ''} onChange={(e) => patchHolding(i, { cur: +e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number" step={10} min={0} disabled={isComputed(h)}
                      value={Math.round(effAmt(h))} onChange={(e) => patchHolding(i, { amt: +e.target.value })}
                    />
                  </td>
                  <td className="num" style={{ minWidth: 66 }}>
                    {r === null || c === null ? (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    ) : (
                      <>
                        <span className={r >= 0 ? 'up' : 'down'}>
                          {r >= 0 ? '+' : ''}
                          {(r * 100).toFixed(1)}%
                        </span>
                        <br />
                        <span style={{ fontSize: 11, color: 'var(--ink2)' }}>
                          {effAmt(h) - c >= 0 ? '+' : ''}
                          {fmt만(effAmt(h) - c)}
                        </span>
                      </>
                    )}
                  </td>
                  <td>
                    <button title="행 삭제" style={{ padding: '4px 9px' }} onClick={() => setHoldings(holdings.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="controls" style={{ marginTop: 10 }}>
        <button
          onClick={() => setHoldings([...holdings, { acct: '연금저축', name: '새 자산', cls: 'eq', amt: 0, sh: 0, buy: 0, cur: 0, asOf: now() }])}
        >
          + 행 추가
        </button>
        <button onClick={() => setHoldings(structuredClone(HOLD_NOW))}>현재 보유(2026-08)로 초기화</button>
        <button onClick={() => setHoldings(structuredClone(HOLD_PLAN))}>실행안 완료 후 상태로 채우기</button>
        <button
          className="primary"
          onClick={async () => {
            try {
              const res = await fetch('http://127.0.0.1:8975/sync')
              const r = importJSON(await res.text())
              alert(r.ok ? 'KIS 잔고를 가져왔습니다 (조회된 계좌 행만 갱신)' : `가져오기 실패: ${r.error}`)
            } catch {
              alert('로컬 도우미가 실행 중이 아닙니다.\n프로젝트 폴더의 KIS동기화.cmd를 먼저 더블클릭하세요 (또는 node scripts/kis-serve.mjs)')
            }
          }}
        >
          KIS에서 가져오기 (로컬 도우미)
        </button>
      </div>
      <div className="note">
        주수와 현재가를 입력하면 평가액이 자동 계산되고(직접 입력 잠김), 평균단가까지 입력하면 수익률이 표시됩니다. 주수를
        비워두면(0) 금액을 직접 입력하는 방식입니다(현금·예금용). 현재가는 자동 갱신되지 않으므로 확인 시점에 증권사 앱의
        가격을 옮겨 적으세요. '채권혼합(TRF류)'는 규정상 안전자산이지만 유효 주식 비중 계산에는 금액의{' '}
        {RULES.account.trfEquityFactor * 100}%를 주식으로 반영합니다. IRP 한도는 평가액 기준으로 수시 변동하므로 매수 직전
        증권사 앱에서 최종 확인하세요.
      </div>
    </div>
  )
}
