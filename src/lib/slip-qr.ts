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
 * Supports both standard format (Tag 30) and KBANK shortened format (Tag 00).
 */
export function parseSlipQR(payload: string): ParsedSlipQR {
  try {
    const root = parseEMVCo(payload)

    // Check Tag 30 first (Standard EMVCo Bill Payment / Slip Verification)
    let verificationValue = root['30']
    let expectedAid = 'A000000677010112'
    let isShortFormat = false

    if (!verificationValue) {
      // If Tag 30 is not present, check Tag 00 (Short format used by KBANK, etc.)
      verificationValue = root['00']
      expectedAid = '000001'
      isShortFormat = true
    }

    if (!verificationValue) {
      return { isValid: false, transRef: null, sendingBank: null, amount: null }
    }

    const subFields = parseEMVCo(verificationValue)
    const aid = subFields['00'] // AID (e.g. A000000677010112 for Standard, 000001 for Short format)
    const sendingBank = subFields['01'] || null
    const transRef = subFields['02'] || null

    const isValid = (aid === expectedAid || (isShortFormat && (aid === '000001' || aid === 'A000000677010112'))) && !!transRef

    // Tag 54 is Transaction Amount (in THB usually, if present)
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
