import { GoogleGenAI, Type } from "@google/genai";

// Initialize the SDK. We use process.env.GEMINI_API_KEY which is replaced by Vite.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractImageInfo(base64Image: string, mimeType: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Bạn là một chuyên gia nhận diện thông tin từ hình ảnh chứng từ vận tải. Hãy trích xuất các thông tin sau từ hình ảnh:\n1. Số Container (Container Number / Số cont)\n2. Số Seal (Seal Number / Số chì)\n3. Số Cân (Weight / Trọng lượng) - đặc biệt chú ý đến các số liệu được viết tay.\nTrả về kết quả dưới dạng JSON với các key: containerNo, sealNo, weight. Nếu không tìm thấy thông tin nào, hãy để giá trị là chuỗi rỗng.",
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            containerNo: { type: Type.STRING, description: "Số Container" },
            sealNo: { type: Type.STRING, description: "Số Seal" },
            weight: { type: Type.STRING, description: "Số Cân (chữ viết tay hoặc in)" },
          },
        },
      },
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return null;
  } catch (error) {
    console.error("Error extracting image info:", error);
    throw error;
  }
}
