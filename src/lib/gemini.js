let aiClient = null;

const normalizeReceiptDate = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // Prefer direct ISO date (YYYY-MM-DD) for database DATE compatibility.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getGeminiClient = async () => {
  if (aiClient) return aiClient;

  const { GoogleGenAI } = await import('@google/genai');
  aiClient = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return aiClient;
};

export const scanReceipt = async (base64Image, mimeType) => {
  const ai = await getGeminiClient();

  // Strip out the data:image/jpeg;base64, part if present
  const base64Data = base64Image.split(',')[1] || base64Image;

  const prompt = `
    Analyze this receipt image and extract the following information.
    Return ONLY a raw JSON object (without markdown wrappers like \`\`\`json) with the exact keys:
    - "store_name": The name of the store or place.
    - "total": The final total amount as a number (e.g., 25.50).
    - "category": Categorize the receipt into one of these: "Food", "Entertainment", "Transport", "Utilities", "Shopping", "Other".
    - "receipt_date": The receipt purchase date in YYYY-MM-DD format. If unknown, return null.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { 
              inlineData: { 
                data: base64Data, 
                mimeType: mimeType 
              } 
            }
          ]
        }
      ]
    });

    let rawText = response.text;
    // Clean up potential markdown formatting
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(rawText);

    return {
      ...parsed,
      receipt_date: normalizeReceiptDate(parsed.receipt_date),
    };
  } catch (error) {
    console.error("Error scanning receipt with Gemini:", error);
    throw new Error("Failed to scan receipt. Please try again.");
  }
};
