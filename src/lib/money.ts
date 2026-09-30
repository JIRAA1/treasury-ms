/** All comparisons and totals use integer satang. */
export function toSatang(amount: number): number {
  if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error('จำนวนเงินไม่ถูกต้อง')
  }
  return Math.round((amount + Number.EPSILON) * 100)
}

export function roundMoney(amount: number): number {
  return toSatang(amount) / 100
}

export function isPositiveMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 &&
    value <= 999999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001
}

export function sumMoney(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + toSatang(amount), 0) / 100
}

export function tierBaseAmount(amount: number, tierAmount: number, standard: number): number {
  if (standard <= 0 || tierAmount < 0 || amount < 0) throw new Error('อัตรางวดไม่ถูกต้อง')
  return roundMoney(amount * tierAmount / standard)
}

export function slipAmountMatches(actual: number | null, expected: number, matched?: boolean | null): boolean {
  return isPositiveMoney(actual) && isPositiveMoney(expected) && matched !== false &&
    toSatang(actual) === toSatang(expected)
}
