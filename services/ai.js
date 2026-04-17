import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeImage(files, timezone) {
    try {
        const imageParts = files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype
            }
        }));

        const prompt = `
        You are a top-tier vintage fashion expert, authentication specialist, and market appraiser.
        Analyze the provided images of an item of clothing or an accessory. 
        Determine its likely brand, the specific type of item, a percentage confidence score for authenticity, and a brief history of the piece.
        
        IMPORTANT PRICING & LOCALIZATION RULES:
        - The user is located in this timezone: ${timezone}.
        - Based on this timezone, deduce the user's country and correctly format ALL prices in their local currency symbol (e.g. $, £, €, ¥).
        - "originalPrice": The estimated original retail value of this item when it was brand new.
        - "thriftPrice": The estimated secondary market value right now.
        - "marketLinks": A list of URLs where similar items are currently being sold online (e.g. eBay, Grailed, Poshmark, official store). Note: return an array of strings.
        - "rarityStars": An integer from 0 to 5 indicating the prestige or rarity of the brand/item (Luxury/grails = 5).
        - "authTips": Strict HTML bullet points on how to spot fakes for this specific item/brand. Must be wrapped in <ul> and <li> tags.

        Return ONLY a JSON object with no markdown wrappers, matching this exact structure:
        {
            "brand": "Brand Name",
            "type": "Item Type/Model",
            "authScore": 95,
            "rarityStars": 5,
            "originalPrice": "€250",
            "thriftPrice": "€100 - €150",
            "marketLinks": ["https://grailed.com/...", "https://ebay.com/..."],
            "era": "1990s",
            "history": "A brief 2-3 sentence history or context behind this piece.",
            "authTips": "<ul><li>Look for symmetrical stitching</li><li>Check for signature YKK zippers</li></ul>"
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: [prompt, ...imageParts],
        });

        const text = response.text;
        
        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\n/, '').replace(/\n```$/, '');
        }

        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Gemini API Error:", error);
        // Pass through the status code if it's a rate limit error
        if (error.status === 429 || error.message?.includes('429')) {
            const quotaError = new Error("Daily scan limit reached. Please try again later.");
            quotaError.status = 429;
            throw quotaError;
        }
        throw new Error("Failed to process image with AI: " + error.message);
    }
}
