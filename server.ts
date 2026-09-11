import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON body parsing with large payload limit for base64 image scanning
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy initialization of Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN",
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Endpoint to test if a shared URL (ais-pre-*) or custom URL is live and accessible
app.get("/api/check-link-status", async (req, res) => {
  const targetUrl = (req.query.url as string) || "";
  if (!targetUrl || !targetUrl.startsWith("http")) {
    return res.status(400).json({ status: "invalid_url", message: "URL không hợp lệ" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(targetUrl, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timeoutId);

    const isAvailable = response.status >= 200 && response.status < 400;
    const isNotFound = response.status === 404;
    const isForbidden = response.status === 403;

    return res.json({
      url: targetUrl,
      httpStatus: response.status,
      isAvailable,
      isNotFound,
      isForbidden,
      statusText: response.statusText,
    });
  } catch (err: any) {
    return res.json({
      url: targetUrl,
      httpStatus: 0,
      isAvailable: false,
      isNotFound: false,
      isForbidden: false,
      error: err?.message || "Không thể kết nối tới URL",
    });
  }
});

// Handle GET /api/ocr/cccd gracefully (e.g. if an auth proxy or browser redirect converted POST to GET)
app.get("/api/ocr/cccd", (_req, res) => {
  return res.status(405).json({
    success: false,
    needsPostRetry: true,
    error: "Yêu cầu OCR CCCD cần gửi qua phương thức POST kèm dữ liệu hình ảnh (phiên vừa được xác thực). Đang tự động thử lại...",
  });
});

// OCR CCCD Endpoint
app.post("/api/ocr/cccd", async (req, res) => {
  try {
    const { imageBase64, side = "front" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng cung cấp dữ liệu hình ảnh (imageBase64)",
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const mimeTypeMatch = imageBase64.match(/^data:([^;]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        success: false,
        error: "Dịch vụ AI Gemini chưa sẵn sàng hoặc thiếu GEMINI_API_KEY.",
      });
    }

    const prompt =
      side === "front"
        ? `Bạn là chuyên gia OCR bóc tách thông tin giấy tờ tùy thân Việt Nam (Căn cước công dân gắn chip, Thẻ Căn cước 2024, CCCD mã vạch hoặc CMND 9 số).
Hãy đọc kỹ hình ảnh mặt trước và trích xuất chính xác các trường dữ liệu sau thành JSON thuần:
{
  "cccd": "Số CCCD 12 số (hoặc số CMND 9 số). Chuẩn hóa xóa toàn bộ khoảng trắng, dấu chấm, dấu gạch nối. Nếu OCR nhầm chữ O/o thì đổi thành số 0, chữ I/l/L thành số 1. Chỉ gồm các ký tự số",
  "name": "Họ và tên đầy đủ (VIẾT HOA CÓ DẤU TIẾNG VIỆT, ví dụ: NGUYỄN VĂN AN)",
  "dob": "Ngày tháng năm sinh (định dạng chuẩn DD/MM/YYYY, ví dụ: 15/08/1996)",
  "gender": "Giới tính (Nam hoặc Nữ)",
  "nationality": "Quốc tịch (thường là Việt Nam)",
  "address": "Nơi thường trú: CHỈ LẤY thông tin cấp Xã/phường (hoặc Quận/Huyện/Thị xã/Thành phố) và Tỉnh/Thành phố. BỎ QUA toàn bộ số nhà, ngõ ngách, tổ dân phố, thôn, xóm, ấp, khu phố. Bỏ các từ tiền tố thừa như 'Xã', 'Phường', 'Huyện', 'Tỉnh'. Định dạng kết quả dạng: 'Xã/phường/huyện, Tỉnh' (ví dụ: 'Cẩm Phả, Quảng Ninh', 'Quảng Trạch, Quảng Bình', 'Chương Mỹ, Hà Nội', 'Hải Hậu, Nam Định')",
  "hometown": "Quê quán hoặc Nơi đăng ký khai sinh (nếu có)"
}
Quy tắc:
- Trả về đúng định dạng JSON hợp lệ.
- Nếu trường nào không thấy rõ trên ảnh, hãy để chuỗi rỗng "". Tuyệt đối không tự bịa đặt thông tin.`
        : `Bạn là chuyên gia OCR bóc tách thông tin mặt sau Căn cước công dân Việt Nam.
Hãy đọc kỹ hình ảnh mặt sau và trích xuất chính xác các trường dữ liệu sau thành JSON thuần:
{
  "issueDate": "Ngày cấp (định dạng chuẩn DD/MM/YYYY, ví dụ: 20/12/2021)",
  "issuePlace": "Nơi cấp (ví dụ: CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI hoặc CÔNG AN TỈNH...)",
  "identifyingCharacteristics": "Đặc điểm nhận dạng (nếu có)"
}
Quy tắc:
- Trả về đúng định dạng JSON hợp lệ.
- Nếu trường nào không thấy rõ trên ảnh, hãy để chuỗi rỗng "". Tuyệt đối không tự bịa đặt thông tin.`;

    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ];
    let lastError: any = null;

    // Helper to safely extract JSON or regex fallback from responseText
    const parseOcrResponse = (responseText: string, currentSide: string) => {
      if (!responseText) return null;
      try {
        // Strip markdown code fences if any
        const cleaned = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch {
            // Remove trailing commas before } or ]
            const noTrailingCommas = jsonMatch[0].replace(/,\s*([\}\]])/g, "$1");
            return JSON.parse(noTrailingCommas);
          }
        }
      } catch (parseErr) {
        console.warn("JSON.parse error in OCR response, falling back to regex extraction:", parseErr);
      }

      // Regex fallback if JSON parsing failed
      const result: Record<string, string> = {};
      if (currentSide === "front") {
        const cccdMatch = responseText.match(/(?:cccd|căn cước|cmnd|định danh|số)[\s:"]*([0-9]{9,12})/i) || responseText.match(/\b([0-9]{12})\b/);
        if (cccdMatch) result.cccd = cccdMatch[1];

        const nameMatch = responseText.match(/(?:họ và tên|họ tên|tên|name)[\s:"]*([A-ZÀ-Ỹ\s]{3,40})/i);
        if (nameMatch) result.name = nameMatch[1].trim();

        const dobMatch = responseText.match(/(?:ngày sinh|sinh ngày|dob)[\s:"]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4})/i) || responseText.match(/\b([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\b/);
        if (dobMatch) result.dob = dobMatch[1];

        const genderMatch = responseText.match(/(?:giới tính|gender)[\s:"]*(Nam|Nữ|nam|nữ)/i);
        if (genderMatch) result.gender = genderMatch[1].toLowerCase().includes("nữ") ? "Nữ" : "Nam";

        const addrMatch = responseText.match(/(?:nơi thường trú|thường trú|địa chỉ|cư trú|address)[\s:"]*([^\n\r"\}]+)/i);
        if (addrMatch) result.address = addrMatch[1].trim();
      } else {
        const issueDateMatch = responseText.match(/(?:ngày cấp|cấp ngày|issueDate)[\s:"]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4})/i);
        if (issueDateMatch) result.issueDate = issueDateMatch[1];

        const issuePlaceMatch = responseText.match(/(?:nơi cấp|cấp bởi|issuePlace)[\s:"]*([^\n\r"\}]+)/i);
        if (issuePlaceMatch) result.issuePlace = issuePlaceMatch[1].trim();
      }

      return Object.keys(result).length > 0 ? result : null;
    };

    for (const modelName of candidateModels) {
      let succeeded = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseMimeType: "application/json",
            },
          });

          const responseText = response.text || "";
          const parsedData = parseOcrResponse(responseText, side);

          if (parsedData) {
            return res.json({
              success: true,
              data: parsedData,
              method: `gemini_ocr (${modelName})`,
            });
          }
          succeeded = true;
          break;
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || "").toLowerCase();
          const isQuotaExceeded = errMsg.includes("quota") || errMsg.includes("resource_exhausted") || err?.status === 429;

          // If quota exhausted on this model, immediately try next model without wasting retry
          if (isQuotaExceeded) {
            console.warn(`Model ${modelName} quota exceeded, skipping to next candidate model.`);
            break;
          }

          const status = err?.status || err?.code || (err?.error && err.error.code);
          const isTransient = status === 503 || status === "UNAVAILABLE";

          if (isTransient && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            continue;
          }
          break;
        }
      }

      if (succeeded) {
        break;
      }
    }

    if (lastError) {
      console.error("All Gemini OCR candidate models failed:", lastError);
      return res.status(502).json({
        success: false,
        error: lastError.message || "Không thể xử lý ảnh CCCD do máy chủ AI đang quá tải. Vui lòng thử lại sau vài giây.",
      });
    }

    return res.status(422).json({
      success: false,
      error: "Không thể trích xuất được dữ liệu có cấu trúc từ hình ảnh này. Vui lòng chụp rõ nét hơn.",
    });
  } catch (error: any) {
    console.error("OCR API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Lỗi xử lý OCR CCCD",
    });
  }
});

// AI Assistant Endpoint for Dormitory Management
app.post("/api/ai/assistant", async (req, res) => {
  try {
    const { query, history = [], context = {} } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập câu hỏi hoặc yêu cầu dành cho Trợ lý AI.",
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({
        success: false,
        fallbackToLocal: true,
        message: "Gemini API client chưa được kích hoạt.",
      });
    }

    const systemInstruction = `Bạn là "Lee" - Trợ lý AI quản lý Ký túc xá Hạ Long Xanh, được tạo bởi Khổng Minh Liên.
Bạn xưng hô là "Lee" hoặc "mình", thân thiện, tận tâm, thông minh và chu đáo.
Bạn đang đồng hành giúp đỡ Quản lý KTX: ${context.managerName || 'Quản lý'}.
Nhiệm vụ: Luôn đồng hành giúp đỡ người dùng trong việc tìm kiếm, rà soát thông tin, kiểm tra tình trạng Ký túc xá, phát hiện bất thường, rà soát hồ sơ CCCD, và đề xuất giải pháp vận hành chính xác dựa trên dữ liệu thực tế được cung cấp.

=== DỮ LIỆU HIỆN TẠI CỦA KÝ TÚC XÁ ===
- Người quản lý: ${context.managerName || 'Quản lý KTX'}
- Quy mô: ${context.config?.numDorms || 8} dãy, ${context.config?.roomsPerDorm || 20} phòng/dãy, ${context.config?.maxBedsPerRoom || 30} giường/phòng.
- Tổng số công nhân lưu trữ: ${context.totalWorkers || 0} người
- Đang ở thực tế: ${context.totalOccupants || 0} người
- Đã rời KTX: ${context.totalExited || 0} người
- Tổng số giường còn trống: ${context.vacantBeds || 0} giường
- Số phòng đang có người ở: ${context.occupiedRoomsCount || 0} / ${context.totalRooms || 0} phòng
- Số công nhân thiếu ảnh CCCD: ${context.missingCccdWorkers?.length || 0} người
- Số mã nhân viên bị trùng: ${context.duplicateEmpCodes?.length || 0} mã

=== DANH SÁCH CHI TIẾT CÁC PHÒNG ===
${JSON.stringify((context.roomSummaries || []).map((r: any) => ({
  roomName: r.roomName,
  roomNumber: r.roomNumber,
  occupants: r.occupants,
  capacity: r.capacity,
  vacant: r.vacant,
  status: r.status,
  workers: (r.workers || []).map((w: any) => `${w.name} (${w.empCode})`)
})), null, 2)}

=== DANH SÁCH CÁC SỰ CỐ & CẢNH BÁO TỰ ĐỘNG PHÁT HIỆN ===
${JSON.stringify(context.diagnostics || [], null, 2)}

=== DANH SÁCH TỔ TRƯỞNG ===
${JSON.stringify((context.teamLeaders || []).map((tl: any) => ({
  name: tl.name,
  activeWorkers: tl.activeWorkers,
  contactPhone: tl.contactPhone
})), null, 2)}

=== NGUYÊN TẮC VẬN HÀNH & TRẢ LỜI CỦA BẠN ===
1. **Hiểu ngôn ngữ tự nhiên & Ngữ cảnh (Context):** Duy trì mạch hội thoại, hiểu câu hỏi ngắn gọn ("còn bao nhiêu?", "liệt kê họ", "còn dãy 3 thì sao?").
2. **Truy vấn & Phân tích chính xác:** Không bịa số liệu. Mọi con số, tên phòng, mã nhân viên phải khớp với dữ liệu thực tế được cung cấp ở trên.
3. **So sánh & Đánh giá:** Khi người dùng yêu cầu so sánh (ví dụ: so sánh dãy 1 và dãy 3), hãy tổng hợp số người, số phòng, tỷ lệ lấp đầy, số giường trống và đưa ra nhận xét đánh giá khách quan.
4. **Phát hiện bất thường & Lỗi:** Cảnh báo phòng quá tải (>30 người hoặc vượt sức chứa), trùng mã nhân viên, thiếu ảnh CCCD.
5. **An toàn dữ liệu (Action Safety):** Nếu người dùng yêu cầu thay đổi dữ liệu nguy hiểm (như xóa công nhân, chuyển phòng, checkout hàng loạt), **tuyệt đối không tự thực hiện**, mà phải đưa ra cảnh báo xác nhận: *"Hành động này sẽ thay đổi dữ liệu hệ thống. Bạn có chắc chắn muốn thực hiện không?"* và yêu cầu xác nhận.
6. **Định dạng Markdown chuyên nghiệp:** Sử dụng tiêu đề, in đậm, danh sách rõ ràng, kèm theo gợi ý hành động hoặc nút bấm tương tác khi hữu ích.
7. Nếu câu hỏi liên kết với hành động giao diện, đính kèm khối JSON ở cuối:
\`\`\`action
{
  "actionType": "FILTER_ROOMS" | "FILTER_WORKERS" | "SYSTEM_AUDIT" | "OPEN_MODAL",
  "modal": "cccd_scan" | "duplicate_checker" | "active_rooms" | "team_leaders" | "export_excel" | null,
  "targetRooms": [101, 102],
  "targetEmpCodes": ["NV01"],
  "summary": "Mô tả ngắn gọn"
}
\`\`\`
`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        contents.push({
          role: item.role === 'model' ? 'model' : 'user',
          parts: [{ text: item.text || '' }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: query }],
    });

    const assistantModels = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
    let text = "";
    let lastAssistantErr: any = null;

    for (const m of assistantModels) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents,
          config: {
            systemInstruction,
            temperature: 0.3,
          },
        });
        text = response.text || "";
        if (text) break;
      } catch (mErr: any) {
        lastAssistantErr = mErr;
        const msg = String(mErr?.message || "").toLowerCase();
        if (
          msg.includes("quota") ||
          msg.includes("resource_exhausted") ||
          msg.includes("503") ||
          msg.includes("unavailable") ||
          msg.includes("high demand") ||
          msg.includes("overloaded") ||
          mErr?.status === 429 ||
          mErr?.status === 503
        ) {
          continue;
        }
        break;
      }
    }

    if (!text && lastAssistantErr) {
      // Return fallback signal so client seamlessly uses local intelligent engine without crashing
      return res.json({
        success: false,
        fallbackToLocal: true,
        error: lastAssistantErr.message || "Model temporarily unavailable",
      });
    }

    return res.json({
      success: true,
      content: text,
    });
  } catch (error: any) {
    console.error("AI Assistant API error:", error);
    return res.json({
      success: false,
      fallbackToLocal: true,
      error: error.message || "Lỗi xử lý yêu cầu AI",
    });
  }
});

// API 404 handler - prevents any /api/* request from ever falling through to Vite or index.html
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    needsPostRetry: req.method === "GET",
    error: `API endpoint ${req.method} ${req.path} không tồn tại`,
  });
});

// API Error handling middleware - catches body-parser errors (PayloadTooLargeError, SyntaxError) and any unhandled API errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith("/api/")) {
    console.error("API error intercepted by middleware:", err);
    return res.status(err.status || 500).json({
      success: false,
      error:
        err.type === "entity.too.large"
          ? "Kích thước hình ảnh hoặc dữ liệu quá lớn (vượt quá 50MB)"
          : err.message || "Lỗi máy chủ khi xử lý API",
    });
  }
  next(err);
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled
          ? false
          : {
              server: httpServer,
            },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Quản lý Ký túc xá server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
