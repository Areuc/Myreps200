import React, { useState } from 'react';
import { AIRoutineGeneratorModalProps, AIWorkoutPreferences, AIGeneratedWorkout, Exercise } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { generateAIRoutine } from '../services/geminiService';

const AIRoutineGeneratorModal: React.FC<AIRoutineGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableExercises,
}) => {
  const [preferences, setPreferences] = useState<AIWorkoutPreferences>({
    daysPerWeek: 3,
    workoutDuration: 60,
    availableEquipment: 'Mancuernas, Banco',
    fitnessLevel: 'Intermedio',
    focus: 'Cuerpo Completo',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedWorkout, setGeneratedWorkout] = useState<AIGeneratedWorkout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPreferences(prev => ({ ...prev, [name]: name === 'daysPerWeek' || name === 'workoutDuration' ? Number(value) : value }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setGeneratedWorkout(null);
    try {
      const workout = await generateAIRoutine(preferences, availableExercises);
      
      // Basic validation of the AI response
      if (!workout.nombre || !workout.exercises || workout.exercises.length === 0) {
        throw new Error("La IA generó una rutina incompleta. Por favor, intenta de nuevo con preferencias más claras.");
      }
       // More validation: check if exercise names are valid
      const exerciseNameSet = new Set(availableExercises.map(ex => ex.nombre));
      for (const ex of workout.exercises) {
        if (!exerciseNameSet.has(ex.exerciseName)) {
            console.warn(`AI generated an unknown exercise: "${ex.exerciseName}". It will be ignored.`);
        }
      }
      workout.exercises = workout.exercises.filter(ex => exerciseNameSet.has(ex.exerciseName));
      if (workout.exercises.length === 0) {
        throw new Error("La IA no pudo encontrar ejercicios válidos para tu solicitud. Intenta ajustar el equipamiento o el foco.");
      }

      setGeneratedWorkout(workout);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
      addToast(err.message || "Ocurrió un error inesperado.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!generatedWorkout) return;
    setIsSaving(true);
    try {
      await onSave(generatedWorkout);
      // Success toast is shown from parent, but we can add one here if needed
      // addToast("Rutina guardada con éxito!", 'success');
      resetAndClose();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAndClose = () => {
    setGeneratedWorkout(null);
    setError(null);
    setIsLoading(false);
    onClose();
  };
  
  const commonInputClasses = "w-full px-3 py-2 border border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-[#06b6d4] focus:border-[#06b6d4] bg-zinc-700 text-white placeholder-zinc-400";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity" aria-modal="true" role="dialog">
      <div className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-lg border border-zinc-700 relative transform transition-all max-h-[90vh] flex flex-col">
        <button onClick={resetAndClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white" aria-label="Cerrar modal" disabled={isLoading || isSaving}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h2 className="text-2xl font-bold text-[#06b6d4] mb-4">Generador de Workout con IA</h2>

        <div className="overflow-y-auto flex-grow pr-2">
            {!generatedWorkout && !isLoading && (
                <form onSubmit={handleGenerate} className="space-y-4">
                    {/* Form fields here */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Días de entrenamiento por semana:</label>
                        <input type="number" name="daysPerWeek" value={preferences.daysPerWeek} onChange={handleInputChange} min="1" max="7" className={commonInputClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Duración del workout (minutos):</label>
                        <select name="workoutDuration" value={preferences.workoutDuration} onChange={handleInputChange} className={commonInputClasses}>
                            <option value={30}>30 minutos</option>
                            <option value={45}>45 minutos</option>
                            <option value={60}>60 minutos</option>
                            <option value={90}>90 minutos</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Nivel de Fitness:</label>
                        <select name="fitnessLevel" value={preferences.fitnessLevel} onChange={handleInputChange} className={commonInputClasses}>
                            <option value="Principiante">Principiante</option>
                            <option value="Intermedio">Intermedio</option>
                            <option value="Avanzado">Avanzado</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Equipamiento Disponible:</label>
                        <textarea name="availableEquipment" value={preferences.availableEquipment} onChange={handleInputChange} rows={2} className={commonInputClasses} placeholder="Ej: Mancuernas, barra, banco, bandas de resistencia..."></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Foco Principal:</label>
                        <input type="text" name="focus" value={preferences.focus} onChange={handleInputChange} className={commonInputClasses} placeholder="Ej: Pecho y Tríceps, Piernas, Cuerpo Completo..."/>
                    </div>
                    <button type="submit" className="w-full bg-[#06b6d4] text-white py-2.5 px-4 rounded-md hover:bg-[#0891b2] font-semibold transition-colors">
                        Generar Workout
                    </button>
                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                </form>
            )}

            {isLoading && (
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                    <LoadingSpinner text="La IA está creando tu workout..." />
                    <p className="text-zinc-400 text-sm mt-2">Esto puede tardar unos segundos...</p>
                </div>
            )}

            {generatedWorkout && !isLoading && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white">{generatedWorkout.nombre}</h3>
                    <p className="text-sm text-zinc-300 italic">"{generatedWorkout.descripcion}"</p>
                    <div className="border-t border-zinc-600 pt-3">
                        <ul className="space-y-2">
                            {generatedWorkout.exercises.map((ex, index) => (
                                <li key={index} className="text-zinc-200 bg-zinc-700 p-2 rounded-md">
                                    <span className="font-medium text-[#06b6d4]">{ex.exerciseName}:</span> {ex.series} series de {ex.repeticiones} repeticiones.
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="flex space-x-3 pt-4">
                        <button onClick={handleGenerate} className="flex-1 bg-zinc-600 text-zinc-200 py-2.5 px-4 rounded-md hover:bg-zinc-500 font-medium transition-colors" disabled={isLoading || isSaving}>
                            Regenerar
                        </button>
                        <button onClick={handleSave} className="flex-1 bg-[#06b6d4] text-white py-2.5 px-4 rounded-md hover:bg-[#0891b2] font-semibold transition-colors" disabled={isSaving}>
                            {isSaving ? <LoadingSpinner size="sm"/> : "Guardar Workout"}
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AIRoutineGeneratorModal;