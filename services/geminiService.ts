
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { MCQ, TextbookAnalysis, FileData, Part } from "../types";

const MODEL_NAME = 'gemini-3-pro-preview';

export class GeminiMathService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not defined");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async analyzeTextbook(files: FileData[]): Promise<TextbookAnalysis> {
    const parts = files.map(file => ({
      inlineData: {
        mimeType: file.type,
        data: file.base64.split(',')[1] || file.base64
      }
    }));

    const prompt = `Analyze this mathematics textbook thoroughly. 
    1. Extract all chapters, topics, and subtopics.
    2. Divide the book into exactly 4 logical PARTS based on topic similarity, concept flow, and weightage.
    3. Ensure each part covers multiple chapters.
    
    Respond strictly in JSON format.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [...parts, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  topics: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "topics"]
              }
            },
            parts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  chapterTitles: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "chapterTitles"]
              },
              minItems: 4,
              maxItems: 4
            },
            totalTopics: { type: Type.NUMBER },
            summary: { type: Type.STRING }
          },
          required: ["chapters", "parts", "totalTopics", "summary"]
        }
      }
    });

    return JSON.parse(response.text);
  }

  async generatePartMCQs(
    analysis: TextbookAnalysis, 
    partIndex: number, 
    existingMCQs: MCQ[]
  ): Promise<MCQ[]> {
    const currentPart = analysis.parts[partIndex];
    const partChapters = analysis.chapters.filter(ch => 
      currentPart.chapterTitles.includes(ch.title)
    );

    const prompt = `Act as an expert Mathematics examiner. 
    Generate exactly 100 high-quality MCQs for ${currentPart.name}.
    
    CHAPTERS IN THIS PART:
    ${JSON.stringify(partChapters)}

    RULES:
    1. 100% mathematically correct.
    2. Exactly one correct option.
    3. Distribution: Spread the 100 questions fairly across all ${partChapters.length} chapters in this part. No single chapter should dominate.
    4. Mix of Concept, Formula, Numerical, and Application-based.
    5. Difficulty: Balanced Easy, Moderate, Challenging.
    6. Unique: Avoid repeating ideas from previous questions.
    
    Respond strictly in JSON format matching the schema.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 16000 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              chapterTitle: { type: Type.STRING, description: "Must match one of the titles in this part exactly" },
              question: { type: Type.STRING },
              options: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING }
                },
                required: ["A", "B", "C", "D"]
              },
              correctAnswer: { type: Type.STRING, enum: ["A", "B", "C", "D"] },
              topic: { type: Type.STRING },
              difficulty: { type: Type.STRING, enum: ["Easy", "Moderate", "Challenging"] },
              explanation: { type: Type.STRING }
            },
            required: ["chapterTitle", "question", "options", "correctAnswer", "topic", "difficulty"]
          }
        }
      }
    });

    const rawMcqs = JSON.parse(response.text);
    return rawMcqs.map((m: any, i: number) => ({
      ...m,
      id: `part-${partIndex}-q-${i}`,
      partName: currentPart.name
    }));
  }
}
