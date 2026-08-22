import { useRef, useState } from 'react'
import type { RetirementResult, RetirementRow } from '../engine/pension/retirement'
import { fmt만 } from './fmt'

const W = 960
const H = 300
const padL = 52
const padR = 14
const padT = 12
const padB = 26

const STACK: [keyof RetirementRow, string][] = [
  ['pub', 'var(--s1)'],
  ['extraPublic', 'var(--s1b)'], // 국민연금 등 병행 공적 — 공적연금 옆 하늘색 층
  ['priv', 'var(--s2)'],
  ['hpm', 'var(--s3)'],
  ['mutualAid', 'var(--s6)'],
  ['extra', 'var(--s5)'],
  ['poolDraw', 'var(--s4)'],
]

export function RetirementChart({ result }: { result: RetirementResult }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ i: number; left: number; top: number; flip: boolean } | null>(null)

  const rows = result.rows
  const n = rows.length
  const maxV = Math.max(...rows.map((x) => Math.max(x.tgt, x.pub + x.extraPublic + x.priv + x.hpm + x.mutualAid + x.extra + x.poolDraw))) * 1.08
  const bw = (W - padL - padR) / n
  const X = (i: number) => padL + bw * i
  const Y = (v: number) => padT + (H - padT - padB) * (1 - v / maxV)
  const grid = Array.from({ length: 5 }, (_, g) => (maxV * g) / 4)
  const tpath = rows.map((row, i) => `${i ? 'L' : 'M'}${(X(i) + bw / 2).toFixed(1)},${Y(row.tgt).toFixed(1)}`).join('')

  const onMove = (ev: React.MouseEvent) => {
    const svg = svgRef.current
    const box = boxRef.current
    if (!svg || !box) return
    const rect = svg.getBoundingClientRect()
    const px = (ev.clientX - rect.left) * (W / rect.width)
    const i = Math.floor((px - padL) / bw)
    if (i < 0 || i >= n) {
      setHover(null)
      return
    }
    const bx = box.getBoundingClientRect()
    const mx = ev.clientX - bx.left
    setHover({ i, left: mx, top: ev.clientY - bx.top - 10, flip: mx > bx.width * 0.65 })
  }

  return (
    <div className="chartbox" ref={boxRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="은퇴 후 나이별 수입 구성과 목표 생활비"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {grid.map((v, g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={padL - 6} y={Y(v) + 4} textAnchor="end" fontSize={10.5} fill="var(--muted)">
              {Math.round(v)}만
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          let y0 = Y(0)
          return (
            <g key={row.age}>
              {STACK.map(([k, c]) => {
                const h = Y(0) - Y(row[k] as number)
                if (h <= 0.5) return null
                y0 -= h
                return <rect key={k} x={X(i) + 1} y={y0} width={Math.max(bw - 2, 2)} height={h} fill={c} rx={1} />
              })}
              {row.age % 5 === 0 && (
                <text x={X(i) + bw / 2} y={H - 8} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
                  {row.age}세
                </text>
              )}
            </g>
          )
        })}
        <path d={tpath} fill="none" stroke="var(--axis)" strokeWidth={2} strokeDasharray="4 3" />
        <line x1={padL} x2={W - padR} y1={Y(0)} y2={Y(0)} stroke="var(--axis)" strokeWidth={1} />
      </svg>
      {hover &&
        (() => {
          const row = rows[hover.i]
          return (
            <div
              className="tooltip"
              style={{
                left: hover.left + (hover.flip ? -14 : 14),
                top: hover.top,
                transform: hover.flip ? 'translateX(-100%)' : undefined,
              }}
            >
              <div style={{ color: 'var(--muted)', fontWeight: 600 }}>{row.age}세</div>
              목표 <b>{fmt만(row.tgt)}</b> · 합계{' '}
              <b>{fmt만(row.pub + row.extraPublic + row.priv + row.hpm + row.mutualAid + row.extra + row.poolDraw)}</b>
              <br />
              공무원 {fmt만(row.pub)}
              {row.extraPublic > 0.005 && <> · 국민 등 {fmt만(row.extraPublic)}</>} · 사적 {fmt만(row.priv)} · 주택{' '}
              {fmt만(row.hpm)}{row.mutualAid > 0.005 && <> · 공제회 {fmt만(row.mutualAid)}</>} · 추가 {fmt만(row.extra)} · 풀 {fmt만(row.poolDraw)}
              {row.suspended > 0.005 && (
                <>
                  <br />
                  <span style={{ color: 'var(--crit)' }}>지급정지 −{fmt만(row.suspended)}</span>
                </>
              )}
            </div>
          )
        })()}
    </div>
  )
}
