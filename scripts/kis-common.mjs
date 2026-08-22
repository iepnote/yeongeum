// KIS 스크립트 공용: .env 로드, 계좌별 앱키 선택, 토큰 캐시(키별), 조회 호출
// 조회 전용 — 주문 API 미사용. 키·계좌번호는 출력하지 않는다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const BASE = 'https://openapi.koreainvestment.com:9443' // 실전 (연금 TR은 모의투자 미지원)
const TOKEN_CACHE = join(root, '.env.token') // .gitignore의 `.env.*`로 커밋 제외

export function loadEnv() {
  const env = {}
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2]
  }
  for (const k of ['KIS_APP_KEY', 'KIS_APP_SECRET', 'KIS_CANO']) {
    if (!env[k] || env[k].includes('발급받은') || env[k] === '12345678')
      throw new Error(`.env의 ${k}가 아직 입력되지 않았습니다`)
  }
  return env
}

// 한투 앱키는 계좌 단위 발급 — 연금저축용 키가 따로 있으면 그 키를 사용
export function credsFor(env, which) {
  if (which === 'pension' && env.KIS_APP_KEY_PENSION && env.KIS_APP_SECRET_PENSION)
    return { appKey: env.KIS_APP_KEY_PENSION, appSecret: env.KIS_APP_SECRET_PENSION }
  return { appKey: env.KIS_APP_KEY, appSecret: env.KIS_APP_SECRET }
}

function loadCache() {
  if (!existsSync(TOKEN_CACHE)) return {}
  try {
    const c = JSON.parse(readFileSync(TOKEN_CACHE, 'utf8'))
    return c.keyId ? { [c.keyId]: { token: c.token, expiresAt: c.expiresAt } } : c // 구버전 단일 형식 호환
  } catch {
    return {}
  }
}

// 토큰 24h 유효 + 발급 횟수 제한 → 앱키별 캐시 재사용
export async function getToken({ appKey, appSecret }) {
  const keyId = createHash('sha256').update(appKey).digest('hex').slice(0, 16)
  const cache = loadCache()
  const hit = cache[keyId]
  if (hit && Date.now() < hit.expiresAt - 60_000) return hit.token
  const res = await fetch(`${BASE}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, appsecret: appSecret }),
  })
  const body = await res.json()
  if (!body.access_token)
    throw new Error(`토큰 발급 실패 (HTTP ${res.status}): ${body.error_description ?? body.msg1 ?? ''}`)
  cache[keyId] = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  writeFileSync(TOKEN_CACHE, JSON.stringify(cache))
  return body.access_token
}

export async function call(creds, trId, path, params) {
  const token = await getToken(creds)
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${token}`,
      appkey: creds.appKey,
      appsecret: creds.appSecret,
      tr_id: trId,
      custtype: 'P',
    },
  })
  return { status: res.status, body: await res.json() }
}
