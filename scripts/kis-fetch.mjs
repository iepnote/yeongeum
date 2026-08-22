// KIS 잔고 조회 → holdingsMerge 구조 생성 (kis-sync·kis-serve 공용, 조회 전용)
import { loadEnv, credsFor, call } from './kis-common.mjs'

const num = (v) => Number(v ?? 0)
const clsOf = (name) => (/TRF|채권혼합/i.test(name) ? 'trf' : 'eq')

function rowsFromBalance(items, cashWon, acct, cashLabel, asOf) {
  const rows = items
    .filter((r) => r.prdt_name && num(r.hldg_qty) > 0)
    .map((r) => {
      const sh = num(r.hldg_qty)
      const evalWon = num(r.evlu_amt)
      const pl = num(r.evlu_pfls_amt)
      return {
        acct,
        name: r.prdt_name,
        cls: clsOf(r.prdt_name),
        sh,
        cur: Math.round(evalWon / sh),
        buy: Math.round((evalWon - pl) / sh),
        amt: evalWon / 10000,
        asOf,
      }
    })
  if (cashWon > 0) rows.push({ acct, name: cashLabel, cls: 'safe', sh: 0, cur: 0, buy: 0, amt: cashWon / 10000, asOf })
  return rows
}

// 두 연금계좌 잔고를 조회해 앱 가져오기용 페이로드 반환. log(msg)로 진행 표시
export async function buildMergePayload(log = console.log) {
  const env = loadEnv()
  const asOf = new Date().toISOString()
  const merge = []

  const irp = (
    await call(credsFor(env, 'main'), 'TTTC2208R', '/uapi/domestic-stock/v1/trading/pension/inquire-balance', {
      CANO: env.KIS_CANO,
      ACNT_PRDT_CD: env.KIS_ACNT_PRDT_CD_IRP ?? '29',
      ACCA_DVSN_CD: '00',
      INQR_DVSN: '00',
      CTX_AREA_FK100: '',
      CTX_AREA_NK100: '',
    })
  ).body
  if (irp.rt_cd === '0') {
    const rows = rowsFromBalance(irp.output1 ?? [], num(irp.output2?.dnca_tot_amt), 'IRP', '현금성(예수금)', asOf)
    merge.push({ acct: 'IRP', rows })
    log(`[IRP] ${rows.length}행`)
  } else log(`[IRP] 조회 실패: ${irp.msg_cd} ${(irp.msg1 ?? '').trim()}`)

  await new Promise((r) => setTimeout(r, 600))

  const ps = (
    await call(credsFor(env, 'pension'), 'TTTC8434R', '/uapi/domestic-stock/v1/trading/inquire-balance', {
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
  ).body
  if (ps.rt_cd === '0') {
    const rows = rowsFromBalance(ps.output1 ?? [], num(ps.output2?.[0]?.dnca_tot_amt), '연금저축', '현금(예수금)', asOf)
    merge.push({ acct: '연금저축', rows })
    log(`[연금저축] ${rows.length}행`)
  } else log(`[연금저축] 조회 불가 (${ps.msg_cd})`)

  if (!merge.length) throw new Error('조회된 계좌가 없습니다')
  return { app: 'pension-compass', schema: 1, exportedAt: asOf, data: { holdingsMerge: merge } }
}
