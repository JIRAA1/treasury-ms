import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { th } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("฿", "฿")
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  // Thai Buddhist year is CE + 543
  const day = format(d, "d")
  const month = format(d, "MMM", { locale: th })
  const year = d.getFullYear() + 543
  return `${day} ${month} ${year}`
}

export function getWeekLabel(week: number): string {
  return `W${week}`
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
