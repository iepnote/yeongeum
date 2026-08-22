import { useEffect, useState } from 'react'
import rulesJson from '../rules/rules-2026.json'
import { useStore } from '../store/useStore'

// NF-1: 네트워크는 opt-in 룰 버전 체크뿐 — 보내는 것 없음(GET 1회), 기본 꺼짐.
// 톱바용 컴팩트 버튼 — 클릭 = 옵트인 토글. 상세 신선도 점검은 진단 리포트의 갱신 체크리스트에 있다
const MANIFEST_URL = 'https://raw.githubusercontent.com/iepnote/yeongeum/main/src/rules/rules-manifest.json'

export function RuleCheck() {
  const { ruleCheckOptIn, setRuleCheckOptIn } = useStore()
  const [latestYear, setLatestYear] = useState<number | null>(null)

  useEffect(() => {
    if (!ruleCheckOptIn) {
      setLatestYear(null)
      return
    }
    fetch(MANIFEST_URL)
      .then((r) => r.json())
      .then((m: { latestYear?: number }) => setLatestYear(m.latestYear ?? null))
      .catch(() => setLatestYear(null))
  }, [ruleCheckOptIn])

  const outdated = latestYear !== null && latestYear > rulesJson.year
  return (
    <button
      onClick={() => setRuleCheckOptIn(!ruleCheckOptIn)}
      title="켜면 룰 버전만 온라인으로 확인합니다 (개인정보 전송 없음). 다시 누르면 끔"
      style={outdated ? { color: 'var(--crit)', borderColor: 'var(--crit)' } : undefined}
    >
      {!ruleCheckOptIn
        ? `룰 ${rulesJson.year} — 업데이트 확인`
        : outdated
          ? `새 룰 ${latestYear} 배포됨 ⚠`
          : latestYear === rulesJson.year
            ? `룰 ${rulesJson.year} 최신 ✓`
            : `룰 ${rulesJson.year} 확인 중…`}
    </button>
  )
}
