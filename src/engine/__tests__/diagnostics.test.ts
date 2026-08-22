import { describe, expect, it } from 'vitest'
import rulesJson from '../../rules/rules-2026.json'
import type { Holding, Rules } from '../types'
import { DEFAULT_RETIREMENT, HOLD_NOW } from './fixtures'
import { simulateRetirement } from '../pension/retirement'
import { diagnose, gapSummary, separateTaxGuide, type DiagnoseInput } from '../report/diagnostics'

const RULES = rulesJson as unknown as Rules

const baseInput = (): DiagnoseInput => ({
  holdings: structuredClone(HOLD_NOW),
  retirement: structuredClone(DEFAULT_RETIREMENT),
  retirementResult: simulateRetirement(DEFAULT_RETIREMENT, RULES),
  incomeSources: [],
  financialIncomeAnnual: 0,
  propertyTaxBase: 36000,
  voluntaryBaseSalary: 5_500_000,
  retireDate: '2038-08-31',
})

const byId = (fs: ReturnType<typeof diagnose>, id: string) => fs.find((f) => f.id === id)!

describe('diagnose — 경고 6종 (F-9, M5)', () => {
  it('6종이 모두 생성된다', () => {
    const fs = diagnose(baseInput(), RULES)
    expect(fs.map((f) => f.id).sort()).toEqual(
      ['dependent', 'fin-threshold', 'idle-cash', 'irp-limit', 'priv-limit', 'voluntary'].sort(),
    )
  })

  it('① IRP: 초과 시 경고, 여유 5%p 미만 시 주의', () => {
    const inp = baseInput()
    // HOLD_NOW: IRP 26.1% → ok
    expect(byId(diagnose(inp, RULES), 'irp-limit').severity).toBe('ok')
    const over: Holding = { acct: 'IRP', name: '주식형', cls: 'eq', amt: 10000, sh: 0, buy: 0, cur: 0, asOf: 'x' }
    inp.holdings.push(over)
    expect(byId(diagnose(inp, RULES), 'irp-limit').severity).toBe('crit')
    over.amt = 4200 // IRP 위험 4950/7072 = 70.0% 근처 → 여유 5%p 미만
    expect(byId(diagnose(inp, RULES), 'irp-limit').severity).toBe('warn')
  })

  it('② 사적연금: 한도 초과 설정 시 crit, 풀 고갈 예정이면 warn', () => {
    const inp = baseInput()
    // 기본: poolOutAge 86 → warn
    expect(byId(diagnose(inp, RULES), 'priv-limit').severity).toBe('warn')
    inp.retirement.privateAnnual = 2000
    inp.retirementResult = simulateRetirement(inp.retirement, RULES)
    expect(byId(diagnose(inp, RULES), 'priv-limit').severity).toBe('crit')
  })

  it('③ 금융소득: 990만 근접 warn, 1,010만 절벽 crit, 2,100만 종합 crit', () => {
    const inp = baseInput()
    expect(byId(diagnose(inp, RULES), 'fin-threshold').severity).toBe('ok')
    inp.financialIncomeAnnual = 950
    expect(byId(diagnose(inp, RULES), 'fin-threshold').severity).toBe('warn')
    inp.financialIncomeAnnual = 1010
    expect(byId(diagnose(inp, RULES), 'fin-threshold').title).toContain('건보료 전액 반영')
    inp.financialIncomeAnnual = 2100
    expect(byId(diagnose(inp, RULES), 'fin-threshold').title).toContain('종합과세')
  })

  it('④ 피부양자: 공적연금 3,084만(연) → 등재 불가 경고', () => {
    const fs = diagnose(baseInput(), RULES) // 257만×12 = 3,084만 > 2,000만
    const d = byId(fs, 'dependent')
    expect(d.severity).toBe('warn')
    expect(d.title).toContain('지역가입 대비')
  })

  it('⑤ 현금 방치: HOLD_NOW는 현금 65% → warn', () => {
    expect(byId(diagnose(baseInput(), RULES), 'idle-cash').severity).toBe('warn')
  })

  it('⑥ 임의계속: 보수 550만 기준 지역보다 유리 → 신청기한 경고', () => {
    const v = byId(diagnose(baseInput(), RULES), 'voluntary')
    expect(v.severity).toBe('warn')
    expect(v.action).toContain('2개월 이내')
  })

  it('액션 아이템이 warn/crit에서 생성된다', () => {
    const actions = diagnose(baseInput(), RULES).filter((f) => f.action)
    expect(actions.length).toBeGreaterThanOrEqual(2)
  })

  it('분리과세 가이드: 6개 재원, 사적연금 한도 상태·공적연금 종합 트랙 정확성', () => {
    const g = separateTaxGuide(baseInput(), RULES)
    expect(g).toHaveLength(6)
    const priv = g.find((x) => x.name.includes('사적연금'))!
    expect(priv.ok).toBe(true) // 기본 1,500만 = 한도 내
    const over = separateTaxGuide({ ...baseInput(), retirement: { ...baseInput().retirement, privateAnnual: 2000 } }, RULES)
    expect(over.find((x) => x.name.includes('사적연금'))!.ok).toBe(false)
    // 공적연금은 분리과세가 아니라 종합 트랙임을 명시해야 함 (오해 방지)
    const pub = g.find((x) => x.name.includes('공적'))!
    expect(pub.track).toContain('분리과세 선택지 없음')
    // 공제회 수입원 등록 감지
    const inp = baseInput()
    inp.incomeSources = [{ id: 'a', label: '공제회', kind: 'mutual-aid', monthlyAmount: 100, startAge: 63, endAge: 72, inflationLinked: false }]
    expect(separateTaxGuide(inp, RULES).find((x) => x.name.includes('공제회'))!.status).toContain('등록됨')
  })

  it('갭 분석 요약: 미달 > 고갈 > 갭 없음 우선순위', () => {
    const r = simulateRetirement(DEFAULT_RETIREMENT, RULES)
    expect(gapSummary(r, 95)).toContain('92세부터 목표 생활비 미달')
    // 여유 있는 가정: 목표를 낮추면 갭 없음
    const easy = simulateRetirement({ ...DEFAULT_RETIREMENT, targetMonthly: 400 }, RULES)
    expect(gapSummary(easy, 95)).toContain(easy.poolOutAge ? '예비 풀 고갈' : '갭 없음')
  })
})
