// KIS 잔고 → JSON 파일 동기화 (파일 경로 방식). 원클릭은 kis-serve.mjs 참고
// 실행: node scripts/kis-sync.mjs → kis-sync-YYYY-MM-DD.json 생성 → 앱 "JSON 가져오기"
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './kis-common.mjs'
import { buildMergePayload } from './kis-fetch.mjs'

const payload = await buildMergePayload()
const out = join(root, `kis-sync-${payload.exportedAt.slice(0, 10)}.json`)
writeFileSync(out, JSON.stringify(payload, null, 2))
console.log(`\n생성: ${out}\n앱에서 "JSON 가져오기"로 읽으면 조회된 계좌 행만 갱신됩니다`)
