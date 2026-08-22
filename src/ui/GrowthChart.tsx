import { useRef, useState } from 'react'
import type { GrowthResult } from '../engine/simulate/montecarlo'
import { fmt억 } from './fmt'

export interface ScenarioA extends GrowthResult {
  label: string
}

const W = 960
const H = 320
const padL = 58
const padR = 16
const padT = 14
const padB = 30

export function GrowthChart({ result, scenarioA }: { result: GrowthResult; scenarioA: ScenarioA | null }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ i: number; left: number; top: number; flip: boolean } | null>(null)

  const yrs = result.years
  let maxV = result.bands.p95[yrs] * 1.05
  if (scenarioA) maxV = Math.max(maxV, scenarioA.bands.p95[scenarioA.years] * 1.05)
  const X = (i: number) => padL + (W - padL - padR) * (i / yrs)
  const Y = (v: number) => padT + (H - padT - padB) * (1 - v / maxV)
  const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')
  const area = (top: number[], bot: number[]) =>
    path(top) +
    top
      .map((_, i) => {
        const j = top.length - 1 - i
        return `L${X(j).toFixed(1)},${Y(bot[j]).toFixed(1)}`
      })
      .join('') +
    'Z'

  const grid = Array.from({ length: 5 }, (_, s) => (maxV * s) / 4)
  const xstep = yrs <= 12 ? 1 : yrs <= 20 ? 2 : 5
  const xlabels: number[] = []
  for (let i = 0; i <= yrs; i += xstep) xlabels.push(i)

  const aPath = scenarioA
    ? scenarioA.bands.p50
        .map((v, i) => `${i ? 'L' : 'M'}${(padL + (W - padL - padR) * (i / scenarioA.years)).toFixed(1)},${Y(v).toFixed(1)}`)
        .join('')
    : null

  const onMove = (ev: React.MouseEvent) => {
    const svg = svgRef.current
    const box = boxRef.current
    if (!svg || !box) return
    const rect = svg.getBoundingClientRect()
    const px = (ev.clientX - rect.left) * (W / rect.width)
    let i = Math.round(((px - padL) / (W - padL - padR)) * yrs)
    i = Math.max(0, Math.min(yrs, i))
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
        aria-label="자산 성장 예상 범위 차트"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {grid.map((v, s) => (
          <g key={s}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={padL - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {fmt억(v)}
            </text>
          </g>
        ))}
        {xlabels.map((i) => (
          <text key={i} x={X(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {i}년
          </text>
        ))}
        <path d={area(result.bands.p95, result.bands.p5)} fill="var(--band1)" />
        <path d={area(result.bands.p75, result.bands.p25)} fill="var(--band2)" />
        <path d={path(result.bands.principal)} fill="none" stroke="var(--axis)" strokeWidth={2} strokeDasharray="2 4" />
        {aPath && <path d={aPath} fill="none" stroke="var(--s2)" strokeWidth={2} strokeDasharray="6 4" />}
        <path d={path(result.bands.p50)} fill="none" stroke="var(--s1)" strokeWidth={2.5} />
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--axis)" strokeWidth={1} />
        {hover && <line x1={X(hover.i)} x2={X(hover.i)} y1={padT} y2={H - padB} stroke="var(--axis)" strokeWidth={1} />}
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{
            left: hover.left + (hover.flip ? -14 : 14),
            top: hover.top,
            transform: hover.flip ? 'translateX(-100%)' : undefined,
          }}
        >
          <div style={{ color: 'var(--muted)', fontWeight: 600 }}>{hover.i}년 뒤</div>
          중앙값 <b>{fmt억(result.bands.p50[hover.i])}</b>
          <br />
          범위(5~95%){' '}
          <b>
            {fmt억(result.bands.p5[hover.i])} ~ {fmt억(result.bands.p95[hover.i])}
          </b>
          <br />
          납입 원금 <b>{fmt억(result.bands.principal[hover.i])}</b>
          {scenarioA && hover.i <= scenarioA.years && (
            <>
              <br />
              <span style={{ color: 'var(--s2)' }}>
                기준안 A <b>{fmt억(scenarioA.bands.p50[hover.i])}</b>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
