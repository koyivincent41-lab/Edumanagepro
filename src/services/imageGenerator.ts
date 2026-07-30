import { GoogleGenAI } from "@google/genai";

export async function generateSchoolImages() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompts = [
    "A modern, high-tech school campus with glass buildings and green spaces, professional architectural photography, bright daylight.",
    "A diverse group of happy students in a modern classroom collaborating on a project, professional photography, warm lighting.",
    "A teacher using a tablet to manage school records in a bright, modern office, professional photography, clean background."
  ];

  const images = [];

  for (const prompt of prompts) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          images.push(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
    }
  }

  return images;
}
