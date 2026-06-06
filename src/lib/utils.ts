import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import type { TierType, TierConfig, User } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "฿0"
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("฿", "฿")
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return "—"
    // Thai Buddhist year is CE + 543
    const day = format(d, "d")
    const month = format(d, "MMM", { locale: th })
    const year = d.getFullYear() + 543
    return `${day} ${month} ${year}`
  } catch {
    return "—"
  }
}


export function getPaymentStatus(status: string) {
  switch (status) {
    case "approved":
    case "paid":
      return { label: "ชำระแล้ว", variant: "paid" as const }
    case "pending":
      return { label: "รอตรวจสอบ", variant: "pending" as const }
    case "rejected":
      return { label: "ถูกปฏิเสธ", variant: "rejected" as const }
    case "unpaid":
    default:
      return { label: "ยังไม่ชำระ", variant: "unpaid" as const }
  }
}

// ─── Tier System ────────────────────────────────────────────

const TIER_CONFIGS: Record<TierType, TierConfig> = {
  A: {
    amount: 60,
    label: "เทียร์ A",
    description: "สมทบพิเศษ ช่วยเพื่อน",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  B: {
    amount: 50,
    label: "เทียร์ B",
    description: "ค่าบำรุงมาตรฐาน",
    color: "text-text-secondary",
    bg: "bg-background-secondary",
    border: "border-border",
  },
  C: {
    amount: 30,
    label: "เทียร์ C",
    description: "ลดหย่อนชั่วคราว",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
}

/** จำนวนเงินต่ออาทิตย์ตาม tier */
export function getTierAmount(tier: TierType): number {
  return TIER_CONFIGS[tier]?.amount ?? 50
}

/** รายละเอียด tier สำหรับ UI */
export function getTierConfig(tier: TierType): TierConfig {
  return TIER_CONFIGS[tier] ?? TIER_CONFIGS.B
}

/** คำนวณยอดรวมที่ควรเก็บได้ต่ออาทิตย์จากนักศึกษาทั้งหมด */
export function getWeeklyTotalExpected(
  students: Pick<User, "tier">[],
  activityExtra = 0,
  isSeparateCollection = false
): number {
  const base = students.reduce((sum, s) => sum + getTierAmount(s.tier), 0)
  const extra = isSeparateCollection ? 0 : activityExtra * students.length
  return base + extra
}

/** label สำหรับ credit status */
export function getCreditStatusLabel(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "repaid":
      return { label: "จ่ายคืนแล้ว", color: "text-emerald-700", bg: "bg-emerald-50" }
    case "forgiven":
      return { label: "ยกให้แล้ว", color: "text-sky-700", bg: "bg-sky-50" }
    default:
      return { label: "ค้างจ่าย", color: "text-amber-700", bg: "bg-amber-50" }
  }
}

/** label สำหรับ activity type */
export function getActivityTypeLabel(type: string | null): { label: string; extra: number } | null {
  if (!type) return null
  switch (type) {
    case "small":  return { label: "กิจกรรมเล็ก (+฿10)", extra: 10 }
    case "medium": return { label: "กิจกรรมกลาง (+฿20–30)", extra: 20 }
    case "large":  return { label: "กิจกรรมใหญ่ (แยกเก็บ)", extra: 0 }
    default:       return null
  }
}

