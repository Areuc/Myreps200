
import { UserGoal } from './types'; 
import { HarmCategory, HarmBlockThreshold } from "@google/genai";

export const APP_NAME = "Myreps";

// MOCK_EXERCISES has been removed. Data will come from Supabase or be passed as props.

export const USER_GOALS_OPTIONS = Object.values(UserGoal);

export const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

// These safety settings are defined but their direct use in ai.models.generateContent
// was commented out in geminiService.ts and AICoachPanel.tsx due to a reported issue.
// If the issue is resolved or a different client/method is used, these can be applied.
// Per latest Gemini SDK guidelines, safetySettings is a top-level parameter for generateContent.
export const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE}
];
