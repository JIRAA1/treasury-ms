/**
 * fine.ts — Shared utility for flexible late fine calculation
 *
 * รองรับ 3 รูปแบบค่าปรับ:
 *   flat       — ปรับครั้งเดียวเมื่อเกิน deadline (ระบบเดิม)
 *   daily      — ปรับ N บาทต่อวันที่เกิน
 *   per_period — ปรับ N บาทต่อรอบงวดที่เลยผ่านไป (default: คิด 1 ครั้งแบบ flat)
 *
 * ใช้ได้ทั้งฝั่ง client (browser) และ server (API routes)
 */

export type FineType = 'flat' | 'daily' | 'per_period'

export interface FineConfig {
  /** รูปแบบการคิดค่าปรับ */
  fine_type?: FineType | null
  /** อัตราค่าปรับต่อหน่วย (บาท) — ใช้สำหรับ daily และ per_period */
  fine_rate?: number | null
  /** ค่าปรับสูงสุด (บาท) — null = ไม่จำกัด */
  fine_cap?: number | null
  /** จำนวนวันผ่อนผันหลัง deadline ก่อนเริ่มปรับ */
  fine_grace_days?: number | null
  /**
   * ค่าปรับคงที่ (legacy field) — ใช้เมื่อ fine_type = 'flat'
   * backward-compat กับระบบเดิมที่ใช้ late_fine_amount
   */
  late_fine_amount?: number | null
  /** วันกำหนดชำระ */
  deadline: string
}

/**
 * คำนวณค่าปรับล่าช้าตามการตั้งค่า fine_type
 *
 * @param period   - ข้อมูลงวดที่มี fine config
 * @param now      - วันที่อ้างอิง (default: ปัจจุบัน)
 * @param hasPendingCredit - ถ้า true จะไม่คิดค่าปรับ (นักศึกษามีการผ่อนผัน)
 */
export function calculateLateFine(
  period: FineConfig,
  now: Date = new Date(),
  hasPendingCredit = false
): number {
  if (hasPendingCredit) return 0

  const deadline = new Date(period.deadline)
  if (now <= deadline) return 0

  // คำนวณสิ้นสุด grace period
  const graceDays = period.fine_grace_days ?? 0
  const graceEnd = new Date(deadline)
  graceEnd.setDate(graceEnd.getDate() + graceDays)
  if (now <= graceEnd) return 0

  const fineType = period.fine_type ?? 'flat'

  let fine = 0

  switch (fineType) {
    case 'flat': {
      // ใช้ late_fine_amount (legacy) หรือ fine_rate (ใหม่)
      fine = period.late_fine_amount ?? period.fine_rate ?? 0
      break
    }
    case 'daily': {
      const msPerDay = 1000 * 60 * 60 * 24
      const daysLate = Math.floor((now.getTime() - graceEnd.getTime()) / msPerDay)
      fine = daysLate * (period.fine_rate ?? 0)
      break
    }
    case 'per_period': {
      // ปรับ 1 ครั้งต่อรอบ (บวกค่าปรับ 1 รอบทันทีที่เลย deadline)
      // ถ้าต้องการคิดสะสมหลายงวด ให้ admin ใช้หน่วย + fine_cap ร่วมกัน
      fine = period.fine_rate ?? period.late_fine_amount ?? 0
      break
    }
  }

  // Apply cap
  if (period.fine_cap !== null && period.fine_cap !== undefined && period.fine_cap > 0) {
    fine = Math.min(fine, period.fine_cap)
  }

  return Math.max(0, fine)
}

/**
 * สร้างข้อความอธิบายสูตรค่าปรับสำหรับแสดงผลใน UI
 * เช่น "ปรับวันละ ฿5 · สูงสุด ฿50 · grace 2 วัน"
 */
export function formatFineDescription(period: FineConfig): string {
  const fineType = period.fine_type ?? 'flat'
  const rate = period.fine_rate ?? period.late_fine_amount ?? 0
  const cap = period.fine_cap
  const grace = period.fine_grace_days ?? 0

  if (rate === 0) return 'ไม่มีค่าปรับ'

  let desc = ''
  switch (fineType) {
    case 'flat':
      desc = `ปรับ ฿${rate.toLocaleString()} ครั้งเดียว`
      break
    case 'daily':
      desc = `ปรับวันละ ฿${rate.toLocaleString()}`
      break
    case 'per_period':
      desc = `ปรับ ฿${rate.toLocaleString()} ต่องวด`
      break
  }

  if (cap && cap > 0) {
    desc += ` · สูงสุด ฿${cap.toLocaleString()}`
  }

  if (grace > 0) {
    desc += ` · grace ${grace} วัน`
  }

  return desc
}

/**
 * คำนวณยอดที่นักศึกษาต้องจ่ายรวมค่าปรับ
 */
export function calculateExpectedAmount(
  tierAmount: number,
  period: FineConfig,
  now: Date = new Date(),
  hasPendingCredit = false
): number {
  const fine = calculateLateFine(period, now, hasPendingCredit)
  return tierAmount + fine
}
