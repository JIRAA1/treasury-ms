import jsQR from 'jsqr'
import { createCanvas, loadImage } from 'canvas'

/**
 * Extracts QR code data from an image Buffer.
 */
export async function extractQRCode(buffer: Buffer): Promise<string | null> {
  try {
    const image = await loadImage(buffer)
    const canvas = createCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    
    const imageData = ctx.getImageData(0, 0, image.width, image.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    
    return code ? code.data : null
  } catch (error) {
    console.error('[QR Extraction Error]', error)
    return null
  }
}
