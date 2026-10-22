export const percent = (n: number) => `${(n * 100).toFixed(2)}%`
export const number = (n: number) => n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
