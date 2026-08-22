// KIS 원클릭 동기화 도우미 (백로그 8): 잔고 조회 후 로컬 서버로 1회 제공
// 실행: node scripts/kis-serve.mjs (또는 KIS동기화.cmd 더블클릭) → 앱의 "KIS에서 가져오기" 버튼 클릭
// 개인 데이터는 127.0.0.1에만 바인딩되고, 허용된 앱 출처(Origin)에만 응답하며, 1회 전달 후 종료된다.
import { createServer } from 'node:http'
import { buildMergePayload } from './kis-fetch.mjs'

const PORT = 8975
const ALLOWED = ['https://iepnote.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']

console.log('KIS 잔고 조회 중...')
const payload = await buildMergePayload()
const body = JSON.stringify(payload)

const server = createServer((req, res) => {
  const origin = req.headers.origin ?? ''
  if (!ALLOWED.includes(origin)) {
    res.writeHead(403).end()
    return
  }
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(body)
  console.log('\n앱으로 전달 완료 — 도우미를 종료합니다')
  setTimeout(() => process.exit(0), 300)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n준비 완료 — 앱(보유 현황 페이지)에서 "KIS에서 가져오기" 버튼을 누르세요`)
  console.log('10분 안에 사용하지 않으면 자동 종료됩니다')
  setTimeout(() => {
    console.log('시간 초과 — 종료')
    process.exit(1)
  }, 600_000).unref?.()
})
