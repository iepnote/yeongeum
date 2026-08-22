import { useMemo } from 'react'
import rulesJson from '../rules/rules-2026.json'
import type { Rules } from '../engine/types'
import { estimateNps } from '../engine/pension/nps'
import { useStore } from '../store/useStore'
import { retireContext } from './retireContext'
import { fmt만 } from './fmt'

const RULES = rulesJson as unknown as Rules

// 회사원·자영업 프리셋 (F-2.3/F-2.4) — 국민연금 간이 추정 + 시뮬레이터 주입
export function NpsCard() {
  const { preset, birthYear, nps, setNps, setProfile, setRetirement, retirement } = useStore()
  const est = useMemo(
    () => estimateNps({ birthYear, avgIncomeMonthly: nps.avgIncomeMonthly * 10000, joinYears: nps.joinYears }, RULES),
    [birthYear, nps],
  )
  const pensionMan = est.pensionMonthly / 10000
  const { retireYear, inflFactor } = retireContext(birthYear, retirement)

  return (
    <div className="card">
      <h2>
        {preset === 'employee' ? '회사원' : '자영업'} 프리셋 — 국민연금 간이 추정
        <span className="hint">
          공단(내연금) 조회값이 있으면 그 값을 직접 은퇴 시뮬레이터에 넣는 것을 우선하세요 · 이 추정은 미조회 시 자리값
        </span>
      </h2>
      <div className="controls" style={{ marginBottom: 14 }}>
        <div className="ctl">
          <label>출생연도</label>
          <input type="number" step={1} value={birthYear} onChange={(e) => setProfile({ birthYear: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>{preset === 'employee' ? '월평균 소득 (만, 세전)' : '월평균 소득월액 (만, 신고 기준)'}</label>
          <input type="number" step={10} value={nps.avgIncomeMonthly} onChange={(e) => setNps({ avgIncomeMonthly: +e.target.value })} />
        </div>
        <div className="ctl">
          <label>국민연금 총 가입기간 (년)</label>
          <input type="number" step={1} min={0} value={nps.joinYears} onChange={(e) => setNps({ joinYears: +e.target.value })} />
        </div>
      </div>
      <div className="tiles">
        <div className="tile">
          <div className="k">예상 국민연금 (현재가치)</div>
          <div className="v accent1">{fmt만(pensionMan)}/월</div>
          <div className="d">{nps.joinYears < 10 ? '가입 10년 미만 — 연금 수급 불가 (일시금)' : `A값 ${fmt만(RULES.publicPensionNps.aValueMonthly / 10000)} 기준 간이식`}</div>
        </div>
        <div className="tile">
          <div className="k">수급 개시연령</div>
          <div className="v">{est.openAge}세</div>
          <div className="d">출생연도 {birthYear} 기준</div>
        </div>
        <div className="tile">
          <div className="k">현재 시뮬레이터 설정</div>
          <div className="v">{fmt만(retirement.publicMonthly)}/월</div>
          <div className="d">공적연금 (물가연동)</div>
        </div>
      </div>
      <div className="controls">
        <button className="primary" disabled={pensionMan <= 0} onClick={() => setRetirement({ publicMonthly: Math.round(pensionMan * inflFactor) })}>
          은퇴 시뮬레이터 공적연금에 반영 — 현재가치 {fmt만(pensionMan)} → 은퇴년({retireYear}) 명목 {fmt만(pensionMan * inflFactor)}/월
        </button>
      </div>
      <div className="note">
        간이식: 기본연금액 = 1.2 × (A값 + 본인 평균소득) × 가입기간 보정 — 실제 산정(재평가율·크레딧 등)과 다를 수
        있습니다. {preset === 'self' ? '자영업(지역가입)은 신고 소득월액 기준이며, 노란우산공제 적립금은 은퇴 시뮬레이터의 예비 풀에 더해 반영하세요.' : '퇴직금·DC 예상액은 퇴직 시 IRP로 이전되므로 은퇴 시뮬레이터의 사적연금 잔액에 합산해 반영하세요.'}
      </div>
    </div>
  )
}
