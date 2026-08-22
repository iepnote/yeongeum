// 재산등급표 등 룰 교체 후 nhis 픽스처 기대값 재생성 (PRD F-7)
// 실행: npx vite-node scripts/regen-expected.ts
// 원리: rules-2026.json이 단일 출처 — 픽스처의 rules_2026 블록을 미러링하고,
//       expected의 숫자·불리언 필드를 엔진 계산값으로 덮어쓴다 (산문 필드 유지, diff는 사람이 검토).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import rulesJson from '../src/rules/rules-2026.json'
import type { Rules } from '../src/engine/types'
import { dependentCheck, employeePremium, regionalPremium, voluntaryPremium } from '../src/engine/nhis'

const RULES = rulesJson as unknown as Rules
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '../src/engine/nhis/fixtures/nhis_검증케이스_v1.json')

interface FixtureCase {
  id: string
  input: { type: string } & Record<string, unknown>
  expected: Record<string, unknown>
}

function runCase(c: FixtureCase): Record<string, unknown> {
  const input = c.input as unknown
  switch (c.input.type) {
    case 'regional':
      return regionalPremium(input as Parameters<typeof regionalPremium>[0], RULES.nhis) as unknown as Record<string, unknown>
    case 'employee':
      return employeePremium(input as Parameters<typeof employeePremium>[0], RULES.nhis) as unknown as Record<string, unknown>
    case 'voluntary':
      return voluntaryPremium(Number(c.input.avgSalaryLast12m), RULES.nhis) as unknown as Record<string, unknown>
    case 'dependentCheck':
      return dependentCheck(input as Parameters<typeof dependentCheck>[0], RULES.nhis) as unknown as Record<string, unknown>
    default:
      throw new Error(`unknown case type: ${c.input.type}`)
  }
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
let changed = 0
for (const c of fixture.cases as FixtureCase[]) {
  const out = runCase(c)
  for (const k of Object.keys(c.expected)) {
    const cur = c.expected[k]
    if (typeof cur !== 'number' && typeof cur !== 'boolean') continue // 산문 유지
    if (!(k in out)) throw new Error(`${c.id}.${k}: 엔진 결과에 없는 필드`)
    if (out[k] !== cur) {
      console.log(`${c.id}.${k}: ${cur} → ${out[k]}`)
      c.expected[k] = out[k]
      changed++
    }
  }
}

// rules_2026 블록을 앱 룰에서 미러링 (단일 출처 유지)
fixture.rules_2026 = RULES.nhis
fixture._meta.regenerated = `${new Date().toISOString().slice(0, 10)} scripts/regen-expected.ts — rules-2026.json 기준 재계산`

writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + '\n')
console.log(changed ? `\n기대값 ${changed}개 갱신 완료 — git diff로 검토 후 커밋하세요` : '\n변경 없음 (룰과 기대값 일치)')
