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

    const result = (await response.json()) as ThunderResponse
    console.log('[Thunder V2] Result:', JSON.stringify(result))

    if (!response.ok || !result.success) {
      const errorMsg = result.error?.message || result.message || 'Thunder API error'
      throw new Error(errorMsg)
    }

    const data = result.data
    if (!data) throw new Error('No data received from API')

    return {
      amount: data.amountInSlip ?? null,
      trans_ref: data.rawSlip?.transRef ?? data.transRef ?? null,
      date: data.rawSlip?.transDate ?? null,
      bank: data.rawSlip?.sendingBank ?? null,
      is_valid: result.success ?? false,
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
      confidence: 0,
      raw: {},
    }
  }
}
