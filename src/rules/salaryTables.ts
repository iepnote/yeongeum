// 프리셋별 봉급표 선택 — 교사(별표 11)와 일반직(별표 3, 계급별)이 같은 SalaryTable 형태를 쓴다
import teacherJson from './salary-teacher-2026.json'
import officialJson from './salary-official-2026.json'
import type { SalaryTable } from '../engine/pension/teacher'

const OFFICIAL = officialJson as { year: number; ranks: Record<string, SalaryTable['grades']> }

export const OFFICIAL_RANKS = Object.keys(OFFICIAL.ranks)
  .map(Number)
  .sort((a, b) => a - b) // [1..9]

export function salaryTableFor(preset: string, officialRank: number): SalaryTable {
  if (preset === 'official') {
    const grades = OFFICIAL.ranks[String(officialRank)] ?? OFFICIAL.ranks['7']
    return { year: OFFICIAL.year, grades }
  }
  return teacherJson as SalaryTable
}
