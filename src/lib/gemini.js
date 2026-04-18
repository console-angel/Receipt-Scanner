let aiClient = null;

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
    
    return JSON.parse(rawText);
  } catch (error) {
    console.error("Error scanning receipt with Gemini:", error);
    throw new Error("Failed to scan receipt. Please try again.");
  }
};
