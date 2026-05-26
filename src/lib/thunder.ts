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
    rawSlip?: {
      transRef: string
      transDate: string
      sendingBank: string
      receiver?: {
        account?: {
          name?: {
            th?: string
            en?: string
          }
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
  quota_exceeded: boolean   // NEW: true when API quota is exhausted
  confidence: number
  raw: ThunderResponse | any
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
