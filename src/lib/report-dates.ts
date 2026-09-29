const THAI_OFFSET = 7 * 60 * 60 * 1000

export function thaiMonthKey(value: string | Date): string {
  return new Date(new Date(value).getTime() + THAI_OFFSET).toISOString().slice(0, 7)
}

export function recentThaiMonths(now = new Date(), count = 6) {
  const local = new Date(now.getTime() + THAI_OFFSET)
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - count + 1 + index, 1))
    return {
      key: d.toISOString().slice(0, 7),
      start: new Date(d.getTime() - THAI_OFFSET).toISOString(),
      label: `${['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][d.getUTCMonth()]} ${String(d.getUTCFullYear() + 543).slice(-2)}`,
    }
  })
}
