import { useState } from 'react'

// 간이 접근 잠금 — 열람 방지용. localStorage의 데이터 자체는 암호화하지 않는다.
// ponytail: SHA-256 해시 게이트. 암호화 저장(AES-GCM)이 필요해지면 persist storage 레이어에서 업그레이드
const LOCK_KEY = 'pension-compass-lock'
const SESSION_KEY = 'pension-compass-unlocked'

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface Lock {
  salt: string
  hash: string
}

export function getLock(): Lock | null {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null')
  } catch {
    return null
  }
}

export async function saveLock(password: string): Promise<void> {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash: await sha256Hex(salt + password) }))
}

export async function verifyLock(password: string): Promise<boolean> {
  const lock = getLock()
  if (!lock) return true
  return (await sha256Hex(lock.salt + password)) === lock.hash
}

export function clearLock(): void {
  localStorage.removeItem(LOCK_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

export function LockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => !!getLock() && sessionStorage.getItem(SESSION_KEY) !== '1')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)

  if (!locked) return <>{children}</>

  const tryUnlock = async () => {
    if (await verifyLock(pw)) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setLocked(false)
    } else {
      setErr(true)
      setPw('')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="card" style={{ width: 320, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 4 }}>연금나침반</h1>
        <div className="sub" style={{ marginBottom: 14 }}>비밀번호를 입력하세요</div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value)
            setErr(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void tryUnlock()
          }}
          style={{ marginBottom: 10, textAlign: 'center' }}
          aria-label="비밀번호"
        />
        <button className="primary" style={{ width: '100%' }} onClick={() => void tryUnlock()}>
          열기
        </button>
        {err && <div style={{ color: 'var(--crit)', fontSize: 12.5, marginTop: 8 }}>비밀번호가 일치하지 않습니다</div>}
        <div className="note" style={{ marginTop: 12 }}>
          간이 잠금입니다 — 무단 열람을 막는 용도이며 저장 파일 자체를 암호화하지는 않습니다.
        </div>
      </div>
    </div>
  )
}

// 헤더에서 쓰는 잠금 설정 패널
export function LockSettings({ onClose }: { onClose: () => void }) {
  const hasLock = !!getLock()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState('')

  const apply = async () => {
    if (hasLock && !(await verifyLock(cur))) {
      setMsg('현재 비밀번호가 일치하지 않습니다')
      return
    }
    if (next) {
      await saveLock(next)
      setMsg('')
      alert('잠금이 설정되었습니다. 다음 접속부터 비밀번호를 묻습니다.\n비밀번호를 잊으면 데이터는 남지만 화면을 열 수 없으니 JSON 내보내기로 백업해 두세요.')
    } else if (hasLock) {
      clearLock()
      alert('잠금이 해제되었습니다.')
    }
    onClose()
  }

  return (
    <div className="card" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, width: 280 }}>
      {hasLock && (
        <div className="ctl" style={{ marginBottom: 8 }}>
          <label>현재 비밀번호</label>
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </div>
      )}
      <div className="ctl" style={{ marginBottom: 10 }}>
        <label>새 비밀번호 {hasLock ? '(비워두면 잠금 해제)' : ''}</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary" onClick={() => void apply()}>
          적용
        </button>
        <button onClick={onClose}>취소</button>
      </div>
      {msg && <div style={{ color: 'var(--crit)', fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
