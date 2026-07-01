export interface ThunderResponse {
  success: boolean
  message?: string
  error?: {
    code: string
    message: string
  }
  data?: {
    amountInSlip: number
    transRef?: string
    isDuplicate?: boolean
    matchedAccount?: {
      bank: {
        nameTh: string
        nameEn: string
        code: string
        shortCode: string
      }
      nameTh: string
      nameEn: string
      type: 'PERSONAL' | 'JURISTIC'
      bankNumber: string
    } | null
    amountInOrder?: number
    isAmountMatched?: boolean
    rawSlip?: {
      payload?: string
      transRef: string
      date?: string
      transDate?: string
      countryCode?: string
      sendingBank?: string
      amount?: { amount: number; local: { amount: number; currency: string } }
      fee?: number
      ref1?: string
      ref2?: string
      ref3?: string
      sender?: {
        bank: { id: string; name: string; short: string }
        account: {
          name: { th?: string; en?: string }
          bank?: { type: string; account: string }
          proxy?: { type: string; account: string }
        }
      }
      receiver?: {
        merchantId?: string | null
        bank?: { id: string; name: string; short: string }
        account?: {
          name?: { th?: string; en?: string }
          bank?: { type: string; account: string }
          proxy?: { type: string; account: string }
        }
      }
    }
  }
}

export interface ThunderResult {
  amount: number | null
  trans_ref: string | null
  date: string | null
  bank: string | null
  is_valid: boolean
  quota_exceeded: boolean   // true when API quota is exhausted
  confidence: number
  raw: ThunderResponse | any
  // Payload-specific fields
  receiver_name_th?: string | null
  receiver_name_en?: string | null
  is_amount_matched?: boolean | null
  matched_account?: ThunderResponse['data'] extends undefined ? null : NonNullable<ThunderResponse['data']>['matchedAccount']
}

/**
 * Verify a bank slip using the QR Code Payload string (fastest method).
 * Sends JSON body with payload, matchAccount, matchAmount, and checkDuplicate to Thunder API.
 */
export async function verifySlipByPayload(
  payload: string,
  options?: {
    remark?: string
    matchAccount?: boolean
    matchAmount?: number
  }
): Promise<ThunderResult> {
  try {
    const body: Record<string, unknown> = {
      payload,
      checkDuplicate: false, // We do our own DB duplicate check before calling this
    }
    if (options?.matchAccount !== undefined) body.matchAccount = options.matchAccount
    if (options?.matchAmount !== undefined) body.matchAmount = options.matchAmount
    if (options?.remark) body.remark = options.remark

    const response = await fetch('https://api.thunder.in.th/v2/verify/bank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.THUNDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    // Detect quota exceeded
    if (response.status === 429) {
      console.warn('[Thunder V2 Payload] Quota exceeded (HTTP 429)')
      return {
        amount: null,
        trans_ref: null,
        date: null,
        bank: null,
        is_valid: false,
        quota_exceeded: true,
        confidence: 0,
        raw: {},
      }
    }

    const result = (await response.json()) as ThunderResponse
    console.log('[Thunder V2 Payload] Result:', JSON.stringify(result))

    // Detect quota errors from response body
    const errorCode = result.error?.code?.toLowerCase() ?? ''
    const errorMsg = (result.error?.message ?? result.message ?? '').toLowerCase()
    const isQuotaError =
      errorCode.includes('quota') ||
      errorCode.includes('limit') ||
      errorCode.includes('rate') ||
      errorMsg.includes('quota') ||
      errorMsg.includes('limit exceeded') ||
      errorMsg.includes('too many')

    if (isQuotaError) {
      console.warn('[Thunder V2 Payload] Quota exceeded (body):', result.error?.message ?? result.message)
      return {
        amount: null,
        trans_ref: null,
        date: null,
        bank: null,
        is_valid: false,
        quota_exceeded: true,
        confidence: 0,
        raw: result,
      }
    }

    if (!response.ok || !result.success) {
      const msg = result.error?.message || result.message || 'Thunder API error'
      throw new Error(msg)
    }

    const data = result.data
    if (!data) throw new Error('No data received from API')

    // Extract receiver name from rawSlip (new payload-based response shape)
    const receiverNameTh = data.rawSlip?.receiver?.account?.name?.th ?? null
    const receiverNameEn = data.rawSlip?.receiver?.account?.name?.en ?? null
    // Fall back to matchedAccount if available
    const matchedNameTh = data.matchedAccount?.nameTh ?? null
    const matchedNameEn = data.matchedAccount?.nameEn ?? null

    return {
      amount: data.amountInSlip ?? null,
      trans_ref: data.rawSlip?.transRef ?? null,
      date: data.rawSlip?.date ?? data.rawSlip?.transDate ?? null,
      bank: data.rawSlip?.sender?.bank?.id ?? data.rawSlip?.sendingBank ?? null,
      is_valid: result.success ?? false,
      quota_exceeded: false,
      confidence: 1,
      raw: result,
      receiver_name_th: receiverNameTh ?? matchedNameTh,
      receiver_name_en: receiverNameEn ?? matchedNameEn,
      is_amount_matched: data.isAmountMatched ?? null,
      matched_account: data.matchedAccount ?? null,
    }
  } catch (error: any) {
    console.error('[Thunder V2 Payload] Error:', error.message)
    return {
      amount: null,
      trans_ref: null,
      date: null,
      bank: null,
      is_valid: false,
      quota_exceeded: false,
      confidence: 0,
      raw: {},
    }
  }
}

export async function verifySlip(file: File): Promise<ThunderResult> {
  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch('https://api.thunder.in.th/v2/verify/bank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.THUNDER_API_KEY}`,
      },
      body: formData,
    })

    // Detect quota exceeded (429 Too Many Requests or quota-related error codes)
    if (response.status === 429) {
      console.warn('[Thunder V2] Quota exceeded (HTTP 429)')
      return {
        amount: null,
        trans_ref: null,
        date: null,
        bank: null,
        is_valid: false,
        quota_exceeded: true,
        confidence: 0,
        raw: {},
      }
    }

    const result = (await response.json()) as ThunderResponse
    console.log('[Thunder V2] Result:', JSON.stringify(result))

    // Also detect quota errors from response body
    const errorCode = result.error?.code?.toLowerCase() ?? ''
    const errorMsg = (result.error?.message ?? result.message ?? '').toLowerCase()
    const isQuotaError =
      errorCode.includes('quota') ||
      errorCode.includes('limit') ||
      errorCode.includes('rate') ||
      errorMsg.includes('quota') ||
      errorMsg.includes('limit exceeded') ||
      errorMsg.includes('too many')

    if (isQuotaError) {
      console.warn('[Thunder V2] Quota exceeded (body):', result.error?.message ?? result.message)
      return {
        amount: null,
        trans_ref: null,
        date: null,
        bank: null,
        is_valid: false,
        quota_exceeded: true,
        confidence: 0,
        raw: result,
      }
    }

    if (!response.ok || !result.success) {
      const msg = result.error?.message || result.message || 'Thunder API error'
      throw new Error(msg)
    }

    const data = result.data
    if (!data) throw new Error('No data received from API')

    return {
      amount: data.amountInSlip ?? null,
      trans_ref: data.rawSlip?.transRef ?? data.transRef ?? null,
      date: data.rawSlip?.transDate ?? null,
      bank: data.rawSlip?.sendingBank ?? null,
      is_valid: result.success ?? false,
      quota_exceeded: false,
      confidence: 1,
      raw: result,
    }
  } catch (error: any) {
    console.error('[Thunder V2] Error:', error.message)
    return {
      amount: null,
      trans_ref: null,
      date: null,
      bank: null,
      is_valid: false,
      quota_exceeded: false,
      confidence: 0,
      raw: {},
    }
  }
}
