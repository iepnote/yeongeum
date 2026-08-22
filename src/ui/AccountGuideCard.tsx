import rulesJson from '../rules/rules-2026.json'
import type { Rules } from '../engine/types'

const RULES = rulesJson as unknown as Rules

// 계좌 알아보기 — 연금저축·IRP·ISA 초보자용 쉬운 설명 (콘텐츠 전용 탭)
// 세액공제·납입한도 수치는 룰 기준연도의 세법 기준 — 개정 시 이 파일만 갱신
const ACCOUNTS = [
  {
    emoji: '🏦',
    name: '연금저축 (개인연금)',
    tagline: '누구나 만들 수 있는 노후 전용 절세 저금통',
    points: [
      '직업·소득에 상관없이 증권사 앱에서 누구나 만들 수 있는 노후 준비 계좌입니다.',
      '1년에 넣은 돈 중 600만원까지 세액공제 — 연말정산 때 최대 99만원(16.5%)을 돌려받습니다. (총급여 5,500만원 초과면 13.2%)',
      '계좌 안에서 ETF·펀드에 투자할 수 있고, 수익이 나도 당장 세금을 떼지 않습니다(과세이연).',
      '55세 이후 연금으로 나눠 받으면 3.3~5.5%의 낮은 세율만 냅니다.',
    ],
    caution: '중간에 해지하면 그동안 받은 혜택을 16.5% 기타소득세로 되돌려냅니다. "노후까지 안 꺼낼 돈"만 넣으세요.',
  },
  {
    emoji: '💼',
    name: 'IRP (퇴직연금)',
    tagline: '퇴직금이 들어오는 통장 + 추가 납입도 되는 계좌',
    points: [
      '퇴직·이직할 때 퇴직금(퇴직급여)을 받는 계좌입니다. 소득이 있는 사람이 개인적으로 추가 납입도 할 수 있습니다.',
      '연금저축과 합쳐서 900만원까지 세액공제 — 그래서 "연금저축 600 + IRP 300" 조합이 가장 흔합니다.',
      '주식형(위험자산)은 70%까지만 담을 수 있고, 30%는 안전자산으로 채워야 합니다. 이 앱의 "IRP 위험자산 한도 검사"가 바로 이 규칙입니다.',
      '받는 방법과 세금은 연금저축과 같습니다(55세 이후 연금 수령 시 저율).',
    ],
    caution: '중도 인출이 연금저축보다 더 까다롭습니다(무주택자 주택 구입 등 법에 정한 사유만 가능). 유동성이 가장 낮은 계좌입니다.',
  },
  {
    emoji: '🧰',
    name: 'ISA (개인종합자산관리계좌)',
    tagline: '3년만 묶어두면 되는 중간 저금통 — 일명 만능통장',
    points: [
      '노후 전용이 아니라 "몇 년 뒤 쓸 목돈"을 굴리는 절세 계좌입니다. 의무 유지 기간이 3년으로 짧습니다.',
      '이자·배당 수익 200만원(서민형 400만원)까지 비과세, 넘는 수익도 9.9% 저율로 분리과세됩니다.',
      '1년에 2,000만원, 평생 1억원까지 넣을 수 있습니다(한도는 세법 개정으로 바뀔 수 있음).',
      '만기 후 60일 안에 그 돈을 연금계좌로 옮기면 옮긴 금액의 10%(최대 300만원)를 추가로 세액공제 — "ISA 3년 → 연금계좌 이사" 콤보가 강력합니다.',
    ],
    caution: '금융소득종합과세 대상자는 새로 가입할 수 없습니다. 배당·이자를 많이 받는 해가 오기 전에 미리 만들어 두는 것이 유리합니다.',
  },
] as const

const COMPARE_ROWS = [
  ['목적', '노후 자금 (55세~)', '퇴직금 보관 + 노후 자금', '중기 목돈 (3년~)'],
  ['누가 만드나', '누구나', '소득이 있는 사람', '19세 이상 (종합과세 대상자 제외)'],
  ['핵심 혜택', '세액공제 600만 한도', '합산 900만까지 세액공제', '수익 200만 비과세 + 9.9% 분리과세'],
  ['돈이 묶이는 기간', '55세까지 (해지 시 혜택 반납)', '55세까지 (인출 제일 까다로움)', '3년', ],
  ['투자 제한', '위험자산 100% 가능', '위험자산 70%까지', '거의 제한 없음'],
] as const

export function AccountGuideCard() {
  return (
    <>
      <div className="card">
        <h2>
          세 계좌, 한눈에
          <span className="hint">연금저축·IRP·ISA — 이름은 어렵지만 하는 일은 단순합니다</span>
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>🏦 연금저축</th>
                <th>💼 IRP</th>
                <th>🧰 ISA</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(([k, a, b, c]) => (
                <tr key={k}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{a}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{b}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note">
          흔한 활용 순서: ① 연금저축에 연 600만원(월 50만원)을 먼저 채워 세액공제를 다 받고 → ② 여유가 되면 IRP에
          300만원을 더 넣어 900만원 한도를 채우고 → ③ 그래도 남으면 ISA에 넣어 3년 뒤 연금계좌로 옮깁니다. 어디까지나
          일반적인 순서이며, 본인의 소득·지출 상황에 따라 달라질 수 있습니다.
        </div>
      </div>

      {ACCOUNTS.map((a) => (
        <div className="card" key={a.name}>
          <h2>
            {a.emoji} {a.name}
            <span className="hint">{a.tagline}</span>
          </h2>
          <ul style={{ margin: '0 0 10px 18px', display: 'grid', gap: 6, fontSize: 13.5, color: 'var(--ink)' }}>
            {a.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="note">⚠️ {a.caution}</div>
        </div>
      ))}

      <div className="note">
        세액공제·납입 한도 수치는 {RULES.year}년 세법 기준이며 개정될 수 있습니다. 정보 제공용 안내로 투자자문·세무대리가
        아닙니다 — 실행 전 전문가 상담을 권합니다.
      </div>
    </>
  )
}
