// KIS 연금계좌 조회 검증 — 조회 전용, 주문 API 미사용. 실행: node scripts/kis-check.mjs
// 개인 데이터는 KIS 서버(본인 증권사) 외 어디에도 전송하지 않음. 키·계좌번호는 출력하지 않음.
import { loadEnv, credsFor, call } from './kis-common.mjs'

const fmt = (n) => Number(n).toLocaleString('ko-KR')

function printHoldings(rows) {
  if (!rows?.length) {
    console.log('  보유 종목: 0건')
    return
  }
  for (const r of rows) {
    if (!r.prdt_name) continue
    console.log(`  - ${r.prdt_name}: ${fmt(r.hldg_qty)}주, 평가 ${fmt(r.evlu_amt)}원, 평가손익 ${fmt(r.evlu_pfls_amt)}원`)
  }
}

const env = loadEnv()
console.log(`계좌 ${env.KIS_CANO.slice(0, 4)}**** · 실전 도메인 · 조회 전용\n`)

// ① IRP (상품코드 29) — 퇴직연금 잔고조회 TTTC2208R
{
  const { status, body } = await call(credsFor(env, 'main'), 'TTTC2208R', '/uapi/domestic-stock/v1/trading/pension/inquire-balance', {
    CANO: env.KIS_CANO,
    ACNT_PRDT_CD: env.KIS_ACNT_PRDT_CD_IRP ?? '29',
    ACCA_DVSN_CD: '00',
    INQR_DVSN: '00',
    CTX_AREA_FK100: '',
    CTX_AREA_NK100: '',
  })
  console.log(`[IRP·29] TTTC2208R → HTTP ${status}, rt_cd=${body.rt_cd}, msg=${body.msg_cd} ${(body.msg1 ?? '').trim()}`)
  if (body.rt_cd === '0') {
    printHoldings(body.output1)
    if (body.output2) console.log(`  예수금 ${fmt(body.output2.dnca_tot_amt)}원 · 총평가 ${fmt(body.output2.tot_evlu_amt)}원`)
  }
}

await new Promise((r) => setTimeout(r, 600)) // 유량 제한 여유

// ② 연금저축 (상품코드 22) — 일반 주식잔고조회 TTTC8434R. 전용 앱키(KIS_APP_KEY_PENSION) 있으면 그 키 사용
{
  const pensionCreds = credsFor(env, 'pension')
  const { status, body } = await call(pensionCreds, 'TTTC8434R', '/uapi/domestic-stock/v1/trading/inquire-balance', {
    CANO: env.KIS_CANO_PENSION ?? env.KIS_CANO,
    ACNT_PRDT_CD: env.KIS_ACNT_PRDT_CD_PENSION ?? '22',
    AFHR_FLPR_YN: 'N',
    OFL_YN: '',
    INQR_DVSN: '02',
    UNPR_DVSN: '01',
    FUND_STTL_ICLD_YN: 'N',
    FNCG_AMT_AUTO_RDPT_YN: 'N',
    PRCS_DVSN: '00',
    CTX_AREA_FK100: '',
    CTX_AREA_NK100: '',
  })
  const keyNote = env.KIS_APP_KEY_PENSION ? ' (전용 키)' : ' (공용 키)'
  console.log(`\n[연금저축·22]${keyNote} TTTC8434R → HTTP ${status}, rt_cd=${body.rt_cd}, msg=${body.msg_cd} ${(body.msg1 ?? '').trim()}`)
  if (body.rt_cd === '0') {
    printHoldings(body.output1)
    if (body.output2?.[0]) console.log(`  예수금 ${fmt(body.output2[0].dnca_tot_amt)}원 · 총평가 ${fmt(body.output2[0].tot_evlu_amt)}원`)
  }
}
