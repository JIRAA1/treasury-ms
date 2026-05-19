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
    let formattedPhone = phoneNumber.replace(/-/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '0066' + formattedPhone.substring(1);
    }

    // 2. สร้างชุดข้อมูลฝั่งร้านค้า/ผู้รับเงิน (Tag 29)
    const merchantInfo = `0016A0000006770101110113${formattedPhone}`;
    const merchantLength = merchantInfo.length.toString().padStart(2, '0');
    const tag29 = `29${merchantLength}${merchantInfo}`;

    // 3. ประกอบ Payload โครงสร้างพื้นฐาน
    let payload = `000201010211${tag29}5802TH5303764`;

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
