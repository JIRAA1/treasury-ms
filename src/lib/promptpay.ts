import { isPositiveMoney } from './money'

export function normalizePromptPayId(value: string): string {
    const id = value.replace(/[\s-]/g, '')
    if (!/^0\d{9}$/.test(id) && !/^\d{13}$/.test(id)) {
        throw new Error('พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตร/เลขภาษี 13 หลัก')
    }
    return id
}

/**
 * ฟังก์ชันคำนวณ Checksum ด้วยอัลกอริทึม CRC16-CCITT (False)
 */
function calculateCrc16(data: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * ฟังก์ชันสร้าง Payload สำหรับ PromptPay QR Code
 * @param phoneNumber เบอร์โทรศัพท์ที่ผูกพร้อมเพย์ (เช่น '0934589920')
 * @param amount จำนวนเงิน
 * @returns สตริง Payload ที่พร้อมนำไปสร้าง QR Code
 */
export function generatePromptPayPayload(phoneNumber: string, amount?: number): string {
    // 1. จัดการฟอร์แมตเบอร์โทรศัพท์ (เปลี่ยน 0 นำหน้า เป็น 0066)
    let formattedPhone = normalizePromptPayId(phoneNumber);
    const isPhone = formattedPhone.length === 10;
    if (isPhone) {
        formattedPhone = '0066' + formattedPhone.substring(1);
    }

    // 2. สร้างชุดข้อมูลฝั่งร้านค้า/ผู้รับเงิน (Tag 29)
    const merchantInfo = `0016A000000677010111${isPhone ? '01' : '02'}13${formattedPhone}`;
    const merchantLength = merchantInfo.length.toString().padStart(2, '0');
    const tag29 = `29${merchantLength}${merchantInfo}`;

    // 3. ประกอบ Payload โครงสร้างพื้นฐาน
    if (amount !== undefined && !isPositiveMoney(amount)) throw new Error('ยอด QR ต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 หลัก');
    let payload = `0002010102${amount === undefined ? '11' : '12'}${tag29}5802TH5303764`;

    // 4. ใส่จำนวนเงิน (ถ้ามี) (Tag 54)
    if (amount !== undefined && amount > 0) {
        const amountStr = amount.toFixed(2);
        const amountLength = amountStr.length.toString().padStart(2, '0');
        payload += `54${amountLength}${amountStr}`;
    }

    // 5. ปิดท้ายด้วย Tag 63 สำหรับ Checksum (ความยาว 04)
    payload += '6304';

    // 6. นำ Payload ทั้งหมดไปคำนวณหา CRC16 แล้วนำมาต่อท้าย
    const crcResult = calculateCrc16(payload);
    
    return payload + crcResult;
}
