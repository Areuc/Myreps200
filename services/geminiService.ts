
import { GoogleGenAI, GenerateContentResponse, SafetySetting } from "@google/genai";
import { GEMINI_MODEL_NAME, GEMINI_SAFETY_SETTINGS } from '../constants';
import { AIWorkoutPreferences, Exercise, AIGeneratedWorkout } from '../types';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;

if (!API_KEY) {
  console.warn("API_KEY de Gemini no encontrada en process.env.API_KEY. El servicio Gemini no funcionará.");
} else {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (e) {
    console.error("Error initializing GoogleGenAI:", e);
    ai = null; // Ensure ai is null if initialization fails
  }
}

export const getGeminiAdvice = async (prompt: string): Promise<string> => {
  if (!ai) {
    console.error("Gemini AI client no está inicializado debido a la falta de API Key o error en inicialización.");
    return "Error: El servicio de IA no está disponible en este momento.";
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      // safetySettings: GEMINI_SAFETY_SETTINGS as SafetySetting[], // If used, ensure type compatibility.
                                                              // Commented out as per original file's indication of issues.
                                                              // If uncommented, ensure GEMINI_SAFETY_SETTINGS matches SafetySetting[]
      config: { // Corrected from 'generationConfig' to 'config'
        temperature: 0.7, 
        topK: 40,
        topP: 0.95,
        // thinkingConfig: { thinkingBudget: 0 } // For low latency if needed, otherwise omit for higher quality
      }
    });

    const text = response.text;
    if (text) {
      return text;
    } else {
      console.warn("Respuesta de Gemini recibida, pero .text está vacío o indefinido.", response);
      return "No se pudo generar una respuesta clara desde la IA. Intenta reformular tu solicitud.";
    }
  } catch (error: any) {
    console.error("Error al llamar a la API de Gemini:", error);
    if (error.message && error.message.includes('API key not valid')) {
        return "Error: La API Key de Gemini no es válida. Por favor, verifica la configuración.";
    }
     if (error.message && error.message.includes('permission')) {
        return "Error: Problema de permisos con la API Key de Gemini o el modelo.";
    }
    return `Error al comunicarse con el servicio de IA: ${error.message || 'Error desconocido'}.`;
  }
};


export const generateAIRoutine = async (
  preferences: AIWorkoutPreferences,
  availableExercises: Exercise[]
): Promise<AIGeneratedWorkout> => {
    if (!ai) {
        throw new Error("Gemini AI client no está inicializado.");
    }

    const exerciseListForPrompt = availableExercises.map(ex => ({
        id: ex.id,
        nombre: ex.nombre,
        grupo_muscular: ex.grupo_muscular,
        equipo: ex.equipo || 'Bodyweight'
    }));

    const prompt = `
        Eres Myreps AI Coach, un experto entrenador de fitness. Tu tarea es crear un plan de workout personalizado basado en las preferencias del usuario y la lista de ejercicios disponibles.

        **Preferencias del Usuario:**
        - Días por semana: ${preferences.daysPerWeek} (Esto es informativo, genera un solo workout para un día).
        - Duración del workout: ${preferences.workoutDuration} minutos.
        - Nivel de Fitness: ${preferences.fitnessLevel}.
        - Foco principal: ${preferences.focus}.
        - Equipamiento disponible: ${preferences.availableEquipment}.

        **Ejercicios Disponibles (Usa SOLAMENTE estos ejercicios):**
        ${JSON.stringify(exerciseListForPrompt, null, 2)}

        **Instrucciones de Salida:**
        1. Tu respuesta DEBE ser un único objeto JSON válido, sin texto adicional, explicaciones, o marcadores de markdown como \`\`\`json.
        2. El objeto JSON debe tener la siguiente estructura:
           {
             "nombre": "Un nombre creativo y descriptivo para la rutina (ej: 'Fuerza de Torso Nivel Intermedio')",
             "descripcion": "Una breve descripción de la rutina (1-2 frases).",
             "exercises": [
               {
                 "exerciseName": "Nombre exacto del ejercicio de la lista proporcionada.",
                 "series": "Un número de series (ej: 3).",
                 "repeticiones": "Un número de repeticiones (ej: 10). NO un rango."
               }
             ]
           }
        3. Selecciona un número apropiado de ejercicios para que el workout se ajuste a la duración especificada (${preferences.workoutDuration} minutos), considerando tiempo para series, repeticiones y descanso.
        4. Asegúrate que el campo "exerciseName" en tu respuesta coincida EXACTAMENTE con un campo "nombre" de la lista de ejercicios disponibles.
        5. Asegúrate que los ejercicios seleccionados sean apropiados para el equipamiento disponible y el nivel de fitness del usuario.
    `;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.8,
            }
        });
        
        const jsonText = response.text;
        if (!jsonText) {
            throw new Error("La respuesta de la IA estaba vacía.");
        }
        
        // Sometimes the model still wraps the JSON in markdown, so we strip it.
        let jsonStr = jsonText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }

        return JSON.parse(jsonStr) as AIGeneratedWorkout;
    } catch (e: any) {
        console.error("Error generando rutina con Gemini:", e);
        if (e instanceof SyntaxError) {
             throw new Error("La IA devolvió un formato JSON inválido. Inténtalo de nuevo.");
        }
        throw new Error(`Error al comunicarse con la IA: ${e.message}`);
    }
};

export default getGeminiAdvice;