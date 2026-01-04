
export interface MCQ {
  id: string;
  partName: string; // Logical part name
  chapterTitle: string; // Specific chapter
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  topic: string;
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
  explanation?: string;
}

export interface Chapter {
  title: string;
  topics: string[];
}

export interface Part {
  name: string;
  chapterTitles: string[];
}

export interface TextbookAnalysis {
  chapters: Chapter[];
  parts: Part[]; // 4 logical parts
  totalTopics: number;
  summary: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY_TO_GENERATE = 'READY_TO_GENERATE',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED'
}

export interface FileData {
  name: string;
  type: string;
  base64: string;
}
