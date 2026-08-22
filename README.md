# 연금나침반 (yeongeum)

**앱 바로가기: https://iepnote.github.io/yeongeum/**

한국 직장인·공무원(특히 교사)을 위한 **로컬 우선(local-first) 은퇴 설계 앱**.
자산·연금·세금·건강보험료를 한곳에서 시뮬레이션합니다.

> 정보 제공용 규칙 기반 도구이며 투자자문·세무대리가 아닙니다. 모든 수치는 가정에 따른 근사치입니다.

## 특징

- **데이터는 기기 밖으로 나가지 않음** — localStorage + JSON 내보내기/가져오기, 서버·회원가입 없음
- 자산구성 몬테카를로 · 계좌별 보유 + IRP 70% 한도 검사 · 수령기 시뮬레이터(§9 충당 순서)
- 세금 엔진: 사적연금 저율/한도 초과 16.5% vs 종합 비교, 금융소득 2,000만 비교과세
- 건보료 엔진: 지역/직장/임의계속/피부양자 판정 (재산등급표 60등급, 2026 공식 요율)
- 교사 프리셋: 봉급표(별표 11) 호봉 엔진 → 평균기준소득월액 → 공무원연금 추정 + 공단 조회값 보정
- 공무원연금 지급정지(소득심사) 감액 + 재취업 손익(건보 절감 vs 연금 감액)
- 룰 외부화: `src/rules/*.json` — 세법·건보·봉급표 연도별 교체 가능 (출처 주석 포함)

## 실행

```bash
npm install
npm run dev    # http://localhost:5173
npm test       # vitest
npm run build
```

## 구조

```
src/engine/{tax,nhis,pension,simulate}  # UI 무관 순수 함수 (테스트 대상)
src/rules/                              # 연도별 룰 JSON (세율·건보·봉급표·개시연령)
src/ui/                                 # React 컴포넌트
scripts/regen-expected.ts               # 룰 교체 후 검증케이스 기대값 재생성
scripts/kis-check.mjs                   # KIS 연금계좌 조회 검증 (조회 전용, .env 필요)
```

앱키 등 비밀값은 `.env`(git 제외)에만 둡니다 — `.env.example` 참고.
