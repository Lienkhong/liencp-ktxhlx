import jsQR from 'jsqr';
import { formatToDmy, simplifyAddress, normalizePersonName } from './helpers';

export interface ParsedCccdQrData {
  cccd: string;
  cmndCu?: string;
  name: string;
  dob: string; // dd/mm/yyyy
  gender: 'Nam' | 'Nữ';
  address: string;
  issueDate?: string; // dd/mm/yyyy
  rawQr: string;
}

/**
 * Phân tích chuỗi dữ liệu từ mã QR trên thẻ Căn cước công dân gắn chip Việt Nam.
 * Cấu trúc tiêu chuẩn của Bộ Công An:
 * <Số CCCD 12 số>|<Số CMND 9 số cũ nếu có>|<Họ và tên>|<Ngày sinh DDMMYYYY>|<Giới tính>|<Nơi thường trú>|<Ngày cấp DDMMYYYY>
 */
export function parseVietnameseCccdQr(raw: string): ParsedCccdQrData | null {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.split('|');
  if (parts.length < 5) return null;

  const cccd = (parts[0] || '').trim().replace(/\D/g, '');
  if (cccd.length < 9 || cccd.length > 12) return null;

  const cmndCu = (parts[1] || '').trim();
  const rawName = (parts[2] || '').trim();
  const rawDob = (parts[3] || '').trim();
  const rawGender = (parts[4] || '').trim();
  const rawAddress = (parts[5] || '').trim();
  const rawIssueDate = (parts[6] || '').trim();

  let dob = rawDob;
  if (/^\d{8}$/.test(rawDob)) {
    dob = `${rawDob.slice(0, 2)}/${rawDob.slice(2, 4)}/${rawDob.slice(4)}`;
  } else if (rawDob) {
    dob = formatToDmy(rawDob);
  }

  let issueDate = rawIssueDate;
  if (/^\d{8}$/.test(rawIssueDate)) {
    issueDate = `${rawIssueDate.slice(0, 2)}/${rawIssueDate.slice(2, 4)}/${rawIssueDate.slice(4)}`;
  } else if (rawIssueDate) {
    issueDate = formatToDmy(rawIssueDate);
  }

  const gender: 'Nam' | 'Nữ' = rawGender.toLowerCase().includes('nữ') ? 'Nữ' : 'Nam';

  return {
    cccd,
    cmndCu,
    name: normalizePersonName(rawName),
    dob,
    gender,
    address: simplifyAddress(rawAddress),
    issueDate,
    rawQr: raw,
  };
}

/**
 * Quét mã QR trực tiếp từ ảnh CCCD (DataURL/Base64).
 * Kết hợp BarcodeDetector (nếu trình duyệt hỗ trợ) và jsQR siêu tốc.
 * Quét trên toàn bộ ảnh và quét chuyên biệt góc trên bên phải (vị trí in mã QR của thẻ CCCD).
 */
export async function scanCccdQrFromImage(dataUrl: string): Promise<ParsedCccdQrData | null> {
  if (!dataUrl || typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = async () => {
        try {
          const { width, height } = img;
          if (width === 0 || height === 0) return resolve(null);

          // 1. Thử BarcodeDetector native nếu trình duyệt có hỗ trợ
          if ('BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await detector.detect(img);
              if (barcodes && barcodes.length > 0) {
                for (const bc of barcodes) {
                  const parsed = parseVietnameseCccdQr(bc.rawValue);
                  if (parsed) return resolve(parsed);
                }
              }
            } catch {
              // Bỏ qua lỗi native detector, tiếp tục với jsQR
            }
          }

          // 2. Sử dụng jsQR trên canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);

          ctx.drawImage(img, 0, 0, width, height);
          const fullImageData = ctx.getImageData(0, 0, width, height);

          // Quét toàn bộ ảnh
          const fullResult = jsQR(fullImageData.data, width, height, {
            inversionAttempts: 'attemptBoth',
          });
          if (fullResult && fullResult.data) {
            const parsed = parseVietnameseCccdQr(fullResult.data);
            if (parsed) return resolve(parsed);
          }

          // 3. Quét tập trung góc trên bên phải (Top-Right 50% width, 60% height) - vị trí đặc thù của mã QR CCCD
          const cropX = Math.floor(width * 0.45);
          const cropY = 0;
          const cropW = Math.floor(width * 0.55);
          const cropH = Math.floor(height * 0.65);

          if (cropW > 20 && cropH > 20) {
            const subData = ctx.getImageData(cropX, cropY, cropW, cropH);
            const subResult = jsQR(subData.data, cropW, cropH, {
              inversionAttempts: 'attemptBoth',
            });
            if (subResult && subResult.data) {
              const parsed = parseVietnameseCccdQr(subResult.data);
              if (parsed) return resolve(parsed);
            }
          }

          resolve(null);
        } catch (err) {
          console.warn('[CCCD QR] Lỗi xử lý canvas QR:', err);
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}
