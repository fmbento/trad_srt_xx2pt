import { GoogleGenAI, Type } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
- The output array must contain the exact same number of objects as the input array.
- For each object, the 'id' must be preserved, and the 'text' field must be the translation.
- Preserve the tone, style, and context of the original dialogue.
- When translating explicit cursing or swear words, replace them with softer, colloquial European Portuguese alternatives like "carago" or "porra" as appropriate, instead of direct, harsh translations.
- Your entire response must be only the JSON array, with no surrounding text, explanations, or markdown formatting.
Example Input: [{"id":0,"text":"Hello, world."},{"id":1,"text":"How are you?"}]
Example Output: [{"id":0,"text":"Olá, mundo."},{"id":1,"text":"Como estás?"}]`;

    const textsWithIds = texts.map((text, index) => ({ id: index, text }));

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
            console.error("Failed to parse Gemini API response as JSON:", jsonStr);
            throw new Error("Received an invalid JSON response from the translation service.");
        }

        if (!Array.isArray(parsedResponse)) {
             console.error("Invalid API response: Not an array. Falling back to original text for this chunk.", parsedResponse);
             return texts;
        }

        // Create a map of translations from the response for efficient lookup.
        const translationsMap = new Map<number, string>();
        for (const item of parsedResponse) {
            if (typeof item === 'object' && item !== null && typeof item.id === 'number' && typeof item.text === 'string') {
                translationsMap.set(item.id, item.text);
            }
        }

        // Reconstruct the full list of translations in the original order.
        // If a translation for a given ID is missing from the response, use the original text as a fallback.
        const finalTranslations = textsWithIds.map(originalItem => 
            translationsMap.get(originalItem.id) ?? originalItem.text
        );
        
        if (translationsMap.size < texts.length) {
            const missingCount = texts.length - translationsMap.size;
            console.warn(`${missingCount} subtitle lines were not translated in this chunk due to an incomplete API response.`);
        }

        return finalTranslations;

    } catch (error) {
        console.error("Error during Gemini API call:", error);
        if (error instanceof Error) {
             // Attempt to extract a cleaner message if the error is a JSON string
            let errorMessage = error.message;
            try {
                const errorObj = JSON.parse(errorMessage);
                if (errorObj.error && errorObj.error.message) {
                    errorMessage = errorObj.error.message;
                }
            } catch (e) {
                // Not a JSON string, use the message as is
            }
            throw new Error(`Failed to translate subtitles: ${errorMessage}`);
        }
        throw new Error("An unknown error occurred during translation.");
    }
};