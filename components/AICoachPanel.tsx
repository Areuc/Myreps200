
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AICoachPanelProps, AICoachMessage, WorkoutLog, UserGoal, LoggedExerciseData, Exercise } from '../types';
import { GEMINI_MODEL_NAME } from '../constants'; // GEMINI_SAFETY_SETTINGS removed from here as it's not used directly
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '../hooks/useToast';

const AICoachPanel: React.FC<AICoachPanelProps> = ({ userId, userGoal, lastWorkoutLog }) => {
  const [messages, setMessages] = useState<AICoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const addMessage = (text: string, sender: 'user' | 'ai') => {
    setMessages(prev => [...prev, { id: Date.now().toString(), text, sender, timestamp: new Date().toISOString() }]);
  };
  
  const constructPrompt = useCallback(() => {
    let prompt = `Eres Myreps AI Coach, un entrenador personal virtual experto y motivador para la app Myreps. Estás hablando con un usuario con ID: ${userId}. El objetivo principal del usuario es "${userGoal || 'mejorar su condición física general'}".\n\n`;

    if (lastWorkoutLog) {
      prompt += `El usuario acaba de registrar un entrenamiento:
      - Nombre/Tipo: ${lastWorkoutLog.workout_name || 'Entrenamiento personalizado'}
      - Fecha: ${new Date(lastWorkoutLog.start_time).toLocaleDateString('es-ES')}\n`;
      
      if (lastWorkoutLog.completed_exercises && lastWorkoutLog.completed_exercises.length > 0) {
        const firstLoggedExercise = lastWorkoutLog.completed_exercises[0];
        // We need a way to get exercise names if we want to include them.
        // For now, using exercise_id. If Exercise details are needed, they should be populated in lastWorkoutLog.
        prompt += `- Primer ejercicio registrado (ID): ${firstLoggedExercise.exercise_id}, realizó ${firstLoggedExercise.sets_performed.length} series. Por ejemplo, en la primera serie hizo ${firstLoggedExercise.sets_performed[0]?.reps_achieved || 'N/A'} repeticiones con ${firstLoggedExercise.sets_performed[0]?.weight_used || 'N/A'}kg.\n`;
      }
       // Data for difficulty is not saved in the DB, but might be passed for the session summary.
      if (lastWorkoutLog.overall_difficulty_rating) {
         prompt += `- Calificó el entrenamiento general como: "${lastWorkoutLog.overall_difficulty_rating}".\n`;
      }

    } else {
      prompt += "El usuario no ha registrado un entrenamiento recientemente.\n";
    }

    prompt += `\nBasado en esta información (especialmente su objetivo y su último entrenamiento, si está disponible), proporciona un consejo corto (2-4 frases), específico, práctico y motivador en español. Anímale y ayúdale a progresar hacia su objetivo. 
    Si el entrenamiento fue calificado como 'Difícil', sugiere cómo ajustarlo la próxima vez o la importancia del descanso. 
    Si fue 'Fácil', sugiere formas de progresar (ej. más peso, más repeticiones, variaciones más difíciles). 
    Si fue 'Justo', refuerza positivamente su esfuerzo y consistencia. 
    Si no hay calificación, da un consejo general y motivador.
    Sé directo y útil.`;
    return prompt;
  }, [userId, userGoal, lastWorkoutLog]);


  const fetchCoachAdvice = useCallback(async (isInitial: boolean = false) => {
    if (!process.env.API_KEY) {
      addToast("La API Key de Gemini no está configurada.", 'error');
      // Do not add AI message here if it's initial, greeting handles it.
      if (!isInitial) addMessage("Error: La API Key no está configurada. Por favor, contacta al administrador.", 'ai');
      return;
    }
    setIsLoading(true);

    const prompt = constructPrompt();
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: prompt,
        config: { temperature: 0.7, topP: 0.95, topK: 40 } 
      });
      
      const adviceText = response.text;
      if (adviceText) {
        addMessage(adviceText, 'ai');
      } else {
        const fallbackMsg = "No pude generar un consejo en este momento. Inténtalo de nuevo.";
        addMessage(fallbackMsg, 'ai');
        addToast(fallbackMsg, 'warning');
      }
    } catch (e: any) {
      console.error("Error fetching advice from Gemini:", e);
      const errorMsg = `Error al obtener consejo: ${e.message}`;
      addToast(errorMsg, 'error');
      addMessage(`Lo siento, tuve un problema al generar un consejo. Intenta más tarde.`, 'ai');
    } finally {
      setIsLoading(false);
    }
  }, [constructPrompt, addToast]);
  
  useEffect(() => {
    const initialGreeting = `¡Hola! Soy tu Myreps AI Coach. Estoy aquí para ayudarte a alcanzar tus metas de "${userGoal || 'fitness general'}".`;
    setMessages([{ id: Date.now().toString(), text: initialGreeting, sender: 'ai', timestamp: new Date().toISOString() }]);
    
    if (lastWorkoutLog) {
         fetchCoachAdvice(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGoal, userId]); 

  useEffect(() => {
    if (lastWorkoutLog && messages.length > 0 && !messages[messages.length-1].text.includes(lastWorkoutLog.workout_name || 'Entrenamiento personalizado')) {
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastWorkoutLog]); 


  return (
    <div className="bg-zinc-800 p-6 rounded-lg shadow-xl border border-zinc-700">
      <h3 className="text-2xl font-bold text-[#06b6d4] mb-4">Consejos del Coach AI</h3>
      <div className="h-64 overflow-y-auto mb-4 p-3 border border-zinc-700 rounded-md bg-zinc-700 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg shadow ${
                msg.sender === 'ai' ? 'bg-[#06b6d4]/20 text-zinc-200' : 'bg-zinc-600 text-white'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className="text-xs text-zinc-400 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {isLoading && messages.length > 0 && <div className="flex justify-center py-2"><LoadingSpinner size="sm" /></div>}
      </div>
      <button
        onClick={() => fetchCoachAdvice(false)} // isInitial false, user explicitly requested
        disabled={isLoading}
        className="w-full bg-[#06b6d4] text-white py-2.5 px-4 rounded-md hover:bg-[#0891b2] transition-colors disabled:bg-zinc-600 flex items-center justify-center font-semibold"
      >
        {isLoading ? <LoadingSpinner size="sm" textColor="text-white"/> : (
            <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 7.924C9.842 7.611 10.278 7.426 10.743 7.375C11.378 7.311 12.012 7.498 12.512 7.898L12.512 7.898C12.871 8.194 13.068 8.643 13.049 9.102C13.029 9.561 12.805 9.988 12.437 10.27L12.437 10.27L7.43702 14.27C7.03902 14.593 6.53602 14.777 6.00002 14.777C5.46402 14.777 4.96102 14.593 4.56302 14.27L4.56302 14.27C4.16402 13.948 3.94502 13.486 3.94502 13C3.94502 12.514 4.16402 12.052 4.56302 11.73L4.56302 11.73L9.53 7.924Z" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12.969 16.574C12.657 16.887 12.221 17.072 11.756 17.123C11.121 17.187 10.487 16.999 9.98703 16.6L9.98703 16.6C9.62803 16.304 9.43103 15.855 9.45003 15.396C9.47003 14.937 9.69403 14.51 10.062 14.228L10.062 14.228L15.062 10.228C15.46 9.90499 15.963 9.72099 16.5 9.72099C17.036 9.72099 17.539 9.90499 17.937 10.228L17.937 10.228C18.336 10.55 18.555 11.012 18.555 11.5C18.555 11.986 18.336 12.448 17.937 12.77L17.937 12.77L12.969 16.574Z" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M16 3V6M12 3V6M8 3V6M5 10H7M5 14H7M19 10H17M19 14H17M16 21V18M12 21V18M8 21V18" />
            </svg>
            Obtener Nuevo Consejo
            </>
        )}
      </button>
       <p className="text-xs text-zinc-500 mt-2">Nota: Los consejos son generados por IA y pueden no ser siempre perfectos. Consulta a un profesional para asesoramiento médico o de fitness específico.</p>
    </div>
  );
};

export default AICoachPanel;
