export const fmt억 = (v: number) => (v / 10000).toFixed(2) + '억'
export const fmt만 = (v: number) => Math.round(v).toLocaleString('ko-KR') + '만'
