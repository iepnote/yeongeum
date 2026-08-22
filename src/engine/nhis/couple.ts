import type { NhisRules } from '../types'
import { dependentCheck, employeePremium, regionalPremium, type DependentResult } from './index'

// 부부 모드 (F-1.3): 소득·건보료·피부양자 상호 판정. 금액 단위: 원
// 지역가입자 보험료는 세대 단위 부과 — 부부 모두 지역이면 소득·재산 합산 1건 (현행 규칙 모델)
export interface CoupleMember {
  label: string
  isEmployee: boolean // 직장가입(재직) 여부
  monthlySalary: number // 직장일 때 보수월액 (원)
  publicPensionAnnual: number
  privatePensionAnnual: number
  propertyTaxBase: number
}

export interface CoupleNhisResult {
  mode: 'both-regional' | 'one-employee' | 'both-employee'
  memberPremiums: { label: string; role: string; monthly: number }[]
  totalMonthly: number
  dependents: { label: string; asDependentOf: string; check: DependentResult }[]
  notes: string[]
}

export function coupleNhis(a: CoupleMember, b: CoupleMember, rules: NhisRules): CoupleNhisResult {
  const members = [a, b]
  const employees = members.filter((m) => m.isEmployee)
  const regionals = members.filter((m) => !m.isEmployee)
  const result: CoupleNhisResult = { mode: 'both-regional', memberPremiums: [], totalMonthly: 0, dependents: [], notes: [] }

  // 피부양자 상호 판정: 직장가입자가 있을 때만 의미 (피부양자는 직장가입에만 등재 가능)
  for (const emp of employees) {
    for (const dep of members) {
      if (dep === emp) continue
      result.dependents.push({
        label: dep.label,
        asDependentOf: emp.label,
        check: dependentCheck(
          { publicPensionAnnual: dep.publicPensionAnnual, privatePensionAnnual: dep.privatePensionAnnual, propertyTaxBase: dep.propertyTaxBase },
          rules,
        ),
      })
    }
  }

  if (employees.length === 2) {
    result.mode = 'both-employee'
    for (const m of members) {
      const e = employeePremium({ monthlySalary: m.monthlySalary, publicPensionAnnual: m.publicPensionAnnual }, rules)
      result.memberPremiums.push({ label: m.label, role: '직장', monthly: e.totalMonthly })
    }
  } else if (employees.length === 1) {
    result.mode = 'one-employee'
    const emp = employees[0]
    const other = regionals[0]
    const e = employeePremium({ monthlySalary: emp.monthlySalary, publicPensionAnnual: emp.publicPensionAnnual }, rules)
    result.memberPremiums.push({ label: emp.label, role: '직장', monthly: e.totalMonthly })
    const dep = result.dependents.find((d) => d.label === other.label)!
    if (dep.check.eligible) {
      result.memberPremiums.push({ label: other.label, role: `피부양자 (${emp.label} 직장)`, monthly: 0 })
      result.notes.push(`${other.label}은(는) 피부양자 등재 가능 — 지역보험료 0원`)
    } else {
      const r = regionalPremium(
        { publicPensionAnnual: other.publicPensionAnnual, privatePensionAnnual: other.privatePensionAnnual, propertyTaxBase: other.propertyTaxBase },
        rules,
      )
      result.memberPremiums.push({ label: other.label, role: '지역 (피부양자 탈락)', monthly: r.totalMonthly })
      result.notes.push(`${other.label} 피부양자 불가: ${dep.check.reason}`)
    }
  } else {
    // 부부 모두 지역 — 세대 합산 부과
    const r = regionalPremium(
      {
        publicPensionAnnual: a.publicPensionAnnual + b.publicPensionAnnual,
        privatePensionAnnual: a.privatePensionAnnual + b.privatePensionAnnual,
        propertyTaxBase: a.propertyTaxBase + b.propertyTaxBase,
      },
      rules,
    )
    result.memberPremiums.push({ label: `${a.label}+${b.label} 세대`, role: '지역 (세대 합산)', monthly: r.totalMonthly })
    result.notes.push('부부 모두 지역가입 — 소득·재산을 세대 합산해 한 건으로 부과')
  }

  result.totalMonthly = result.memberPremiums.reduce((s, m) => s + m.monthly, 0)
  return result
}
