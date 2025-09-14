import { GoogleGenAI, Type } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const MAX_RETRIES = 3;

interface TranslationObject {
    id: number;
    text: string;
}

export const translateTexts = async (texts: string[]): Promise<string[]> => {
    if (!texts || texts.length === 0) {
        return [];
    }
    
    const systemInstruction = `You are an expert translator specializing in subtitles. Your task is to translate the 'text' field for each object in a JSON array into European Portuguese.
- The user will provide a JSON array of objects, where each object has an 'id' (number) and a 'text' (string).
- You MUST respond with a JSON array of objects with the exact same structure ('id' and 'text').
- The output array must contain the exact same number of objects and the exact same IDs as the input array.
- For each object, the 'id' must be preserved, and the 'text' field must be the translation.
- Preserve the tone, style, and context of the original dialogue.
- When translating explicit cursing or swear words, replace them with softer, colloquial European Portuguese alternatives like "carago" or "porra" as appropriate, instead of direct, harsh translations.
- Your entire response must be only the JSON array, with no surrounding text, explanations, or markdown formatting.
Example Input: [{"id":0,"text":"Hello, world."},{"id":1,"text":"How are you?"}]
Example Output: [{"id":0,"text":"Olá, mundo."},{"id":1,"text":"Como estás?"}]`;

    const textsWithIds = texts.map((text, index) => ({ id: index, text }));
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: JSON.stringify(textsWithIds),
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.NUMBER },
                                text: { type: Type.STRING },
                            },
                            required: ["id", "text"],
                        },
                    },
                },
            });

            const jsonStr = response.text.trim();
            let parsedResponse: any;
            try {
                parsedResponse = JSON.parse(jsonStr);
            } catch (parseError) {
                console.error(`Attempt ${attempt}: Failed to parse Gemini API response as JSON:`, jsonStr);
                lastError = new Error("Received an invalid JSON response from the translation service.");
                if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500));
                continue; // Retry
            }

            if (!Array.isArray(parsedResponse)) {
                 console.error(`Attempt ${attempt}: Invalid API response: Not an array.`, parsedResponse);
                 lastError = new Error("The translation service returned data in an unexpected format (not an array).");
                 if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500));
                 continue; // Retry
            }
            
            if (parsedResponse.length !== texts.length) {
                console.warn(`Attempt ${attempt}: Mismatch in translated items. Expected ${texts.length}, got ${parsedResponse.length}. Retrying...`);
                lastError = new Error(`The translation service returned an incomplete list. Expected ${texts.length} items, but received ${parsedResponse.length}.`);
                if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500));
                continue; // Retry
            }

            const translationsMap = new Map<number, string>();
            for (const item of parsedResponse) {
                if (typeof item === 'object' && item !== null && typeof item.id === 'number' && typeof item.text === 'string') {
                    translationsMap.set(item.id, item.text);
                }
            }

            if (translationsMap.size !== texts.length) {
                 console.warn(`Attempt ${attempt}: Mismatch in translated IDs. Expected ${texts.length} unique IDs, but found ${translationsMap.size}. Retrying...`);
                 lastError = new Error(`The translation service response was missing some required translation IDs.`);
                 if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500));
                 continue; // Retry
            }

            // Check if the translation actually happened or just returned the original text.
            const unchangedCount = textsWithIds.reduce((count, originalItem) => {
                const translatedText = translationsMap.get(originalItem.id);
                if (translatedText && originalItem.text.trim() === translatedText.trim()) {
                    return count + 1;
                }
                return count;
            }, 0);

            if (unchangedCount === texts.length && texts.length > 0) {
                console.warn(`Attempt ${attempt}: Translation returned original text for all items in the chunk. Retrying...`);
                lastError = new Error(`The translation service returned the original text without translating it.`);
                if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500));
                continue; // Retry
            }

            const finalTranslations = textsWithIds.map(originalItem => 
                translationsMap.get(originalItem.id) ?? originalItem.text
            );
            
            return finalTranslations; // Success!

        } catch (error) {
            console.error(`Error during Gemini API call on attempt ${attempt}:`, error);
            lastError = error instanceof Error ? error : new Error("An unknown error occurred during translation.");
            if (attempt === MAX_RETRIES) {
                break; // Don't wait on the last attempt
            }
            await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
        }
    }

    // If all retries failed, throw a comprehensive error.
    let errorMessage = "Failed to translate a chunk of subtitles after multiple attempts.";
    if (lastError) {
        errorMessage += ` Last known error: ${lastError.message}`;
    }
    throw new Error(errorMessage);
};