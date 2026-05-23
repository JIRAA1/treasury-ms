/**
 * Parse EMVCo Tag-Length-Value (TLV) encoded string.
 */
export function parseEMVCo(payload: string): Record<string, string> {
  const result: Record<string, string> = {}
  let index = 0

  while (index < payload.length) {
    if (index + 4 > payload.length) break
    const tag = payload.substring(index, index + 2)
    const lengthStr = payload.substring(index + 2, index + 4)
    const length = parseInt(lengthStr, 10)

    if (isNaN(length)) break
    const value = payload.substring(index + 4, index + 4 + length)
    result[tag] = value
    index += 4 + length
  }

  return result
}

export interface ParsedSlipQR {
  isValid: boolean
  transRef: string | null
  sendingBank: string | null
  amount: number | null
}

/**
 * Parses a Thai bank transfer slip QR code (Mini-QR).
 * Validates the AID and extracts transaction reference, sending bank, and amount.
 */
export function parseSlipQR(payload: string): ParsedSlipQR {
  try {
    const root = parseEMVCo(payload)

    // Tag 30 contains Slip Verification details
    const tag30Value = root['30']
    if (!tag30Value) {
      return { isValid: false, transRef: null, sendingBank: null, amount: null }
    }

    const subFields = parseEMVCo(tag30Value)
    const aid = subFields['00'] // AID should be A000000677010112 for Thai slip verification
    const sendingBank = subFields['01'] || null
    const transRef = subFields['02'] || null

    const isValid = aid === 'A000000677010112' && !!transRef

    // Tag 54 is Transaction Amount (in THB usually)
    const amountStr = root['54']
    const amount = amountStr ? parseFloat(amountStr) : null

    return {
      isValid,
      transRef,
      sendingBank,
      amount: amount && !isNaN(amount) ? amount : null,
    }
  } catch (error) {
    console.error('Failed to parse slip QR:', error)
    return { isValid: false, transRef: null, sendingBank: null, amount: null }
  }
}
