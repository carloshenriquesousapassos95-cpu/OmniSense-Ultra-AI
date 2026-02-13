
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { MASTER_SYSTEM_PROMPT } from "./constants";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const streamChat = async (
  message: string,
  history: { role: string; content: string }[],
  modePrompt: string,
  temperature: number,
  onChunk: (text: string) => void
) => {
  const ai = getAIClient();
  
  // Utilizando Gemini 3 Pro para suportar thinkingConfig e alta complexidade
  const modelName = 'gemini-3-pro-preview';

  const contents = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user',
      parts: [{ text: message }]
    }
  ];

  try {
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        systemInstruction: `${MASTER_SYSTEM_PROMPT}\n\nMODO OPERACIONAL SELECIONADO:\n${modePrompt}`,
        temperature: temperature,
        topP: 0.95,
        topK: 64,
        // O maxOutputTokens deve englobar o thinkingBudget + o texto gerado.
        // Definindo 32k para acomodar 16k de pensamento com folga para a resposta.
        maxOutputTokens: 32768,
        thinkingConfig: {
          thinkingBudget: 16000
        }
      }
    });

    let fullText = "";
    for await (const chunk of result) {
      const text = (chunk as GenerateContentResponse).text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
