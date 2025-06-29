
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RoutineForm from '../components/RoutineForm';
import { Workout, Exercise, WorkoutExercise, Database, AIGeneratedWorkout } from '../types';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase } from '../supabaseClient'; 
import { seedDefaultWorkouts } from '../services/routineSeeder';
import { useToast } from '../hooks/useToast';
import AIRoutineGeneratorModal from '../components/AIRoutineGeneratorModal';

const RoutinesPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);

  const fetchAllExercises = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('exercises').select('*').order('nombre');
      if (error) throw error;
      setAvailableExercises(data || []);
    } catch (error: any) {
      console.error("Error fetching exercises from Supabase for RoutineForm:", error); 
      addToast('Error al cargar la lista de ejercicios.', 'error');
      setAvailableExercises([]);
    } 
  }, [addToast]);


  const fetchWorkouts = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setWorkouts([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (workoutsError) throw workoutsError;
      
      const workoutIds = workoutsData.map(w => w.id);
      if (workoutIds.length === 0) {
        setWorkouts([]);
        return;
      }

      const { data: workoutExercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select('*')
        .in('workout_id', workoutIds);

      if (exercisesError) throw exercisesError;

      const exercisesByWorkoutId = new Map<string, any[]>();
      workoutExercisesData.forEach(ex => {
        if (!exercisesByWorkoutId.has(ex.workout_id)) {
          exercisesByWorkoutId.set(ex.workout_id, []);
        }
        exercisesByWorkoutId.get(ex.workout_id)!.push(ex);
      });

      const fetchedWorkouts: Workout[] = workoutsData.map((workout) => ({
        id: workout.id,
        user_id: workout.user_id,
        nombre: workout.nombre,
        descripcion: workout.descripcion,
        created_at: workout.created_at,
        exercises: (exercisesByWorkoutId.get(workout.id) || []).map((dbEx): WorkoutExercise => ({
            exercise_id: dbEx.exercise_id,
            orden: dbEx.orden,
            series: dbEx.series,
            repeticiones: dbEx.repeticiones,
            peso_objetivo: dbEx.peso_objetivo,
        })).sort((a,b) => (a.orden || 0) - (b.orden || 0))
      }));
      setWorkouts(fetchedWorkouts);

    } catch (error) {
      console.error("Error fetching workouts from Supabase:", error);
      addToast('Error al cargar tus workouts.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
        fetchAllExercises(),
        user ? fetchWorkouts() : Promise.resolve()
    ]).finally(() => {
        setIsLoading(false);
    });
  }, [user, fetchAllExercises, fetchWorkouts]);

  const handleSubmitWorkoutForm = async (workoutData: { nombre: string; descripcion?: string; exercises: Omit<WorkoutExercise, "exercise_details">[]}) => {
    if (!user) {
      addToast("Debes estar conectado para gestionar rutinas.", 'error');
      return;
    }
    setIsSubmitting(true);

    const createExercisePayload = (exercises: Omit<WorkoutExercise, 'exercise_details'>[], workout_id: string) => {
      return exercises.map((ex) => ({
        workout_id: workout_id,
        exercise_id: ex.exercise_id,
        orden: ex.orden,
        series: ex.series,
        repeticiones: ex.repeticiones,
        peso_objetivo: ex.peso_objetivo,
      }));
    };

    try {
      if (editingWorkout) {
        // Update existing workout
        const { error: workoutUpdateError } = await supabase
          .from('workouts')
          .update({
            nombre: workoutData.nombre,
            descripcion: workoutData.descripcion,
          })
          .eq('id', editingWorkout.id);
        if (workoutUpdateError) throw workoutUpdateError;

        // Delete old exercises
        const { error: deleteError } = await supabase.from('workout_exercises').delete().eq('workout_id', editingWorkout.id);
        if (deleteError) throw deleteError;
        
        // Insert new exercises
        const exercisesToInsert = createExercisePayload(workoutData.exercises, editingWorkout.id);
        if (exercisesToInsert.length > 0) {
            const { error: insertError } = await supabase.from('workout_exercises').insert(exercisesToInsert);
            if (insertError) throw insertError;
        }
        addToast('Workout actualizado con éxito.', 'success');
      } else { 
        // Create new workout
        const { data: newWorkout, error: workoutInsertError } = await supabase
          .from('workouts')
          .insert({
            user_id: user.id,
            nombre: workoutData.nombre,
            descripcion: workoutData.descripcion,
          })
          .select()
          .single();
        
        if (workoutInsertError) throw workoutInsertError;
        if (!newWorkout) throw new Error("Failed to create workout.");

        const exercisesToInsert = createExercisePayload(workoutData.exercises, newWorkout.id);
         if (exercisesToInsert.length > 0) {
            const { error: insertError } = await supabase.from('workout_exercises').insert(exercisesToInsert);
            if (insertError) throw insertError;
         }
         addToast('Nuevo workout creado con éxito.', 'success');
      }
      setShowForm(false);
      setEditingWorkout(null);
      await fetchWorkouts();
    } catch (error: any) {
      console.error("Error saving workout to Supabase:", error);
      addToast(`Error al guardar el workout: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!user) {
        addToast("Debes estar conectado para eliminar rutinas.", 'error');
        return;
    }
    if (window.confirm('¿Estás seguro de que quieres eliminar este workout? Esta acción no se puede deshacer.')) {
      try {
        // First delete associated exercises (or rely on CASCADE delete if set up in DB)
        const { error: exercisesDeleteError } = await supabase.from('workout_exercises').delete().eq('workout_id', workoutId);
        if(exercisesDeleteError) throw exercisesDeleteError;
        
        // Then delete the workout itself
        const { error: workoutDeleteError } = await supabase.from('workouts').delete().eq('id', workoutId);
        if (workoutDeleteError) throw workoutDeleteError;

        addToast('Workout eliminado correctamente.', 'success');
        await fetchWorkouts();
      } catch (error: any) {
        console.error("Error deleting workout from Supabase:", error);
        addToast(`Error al eliminar el workout: ${error.message}`, 'error');
      }
    }
  };
  
  const handleStartEdit = (workout: Workout) => {
    setEditingWorkout(workout);
    setShowForm(true);
  };
  
  const handleSeedRoutines = async () => {
    if (!user) return;
    setIsSeeding(true);
    try {
        const result = await seedDefaultWorkouts(user.id);
        addToast(result.message, result.success ? 'success' : 'info');
        if (result.success) {
            await fetchWorkouts(); // Refresh the list on success
        }
    } catch (error: any) {
        console.error("Failed to seed routines:", error);
        addToast(`Error al generar rutinas de ejemplo: ${error.message}`, 'error');
    } finally {
        setIsSeeding(false);
    }
  };

  // New handler to save the AI-generated routine
  const handleSaveAIGeneratedWorkout = async (aiWorkout: AIGeneratedWorkout) => {
      if (!user) {
          addToast("Debes estar conectado para guardar rutinas.", 'error');
          throw new Error("User not authenticated");
      }
      
      const exerciseNameToIdMap = new Map(availableExercises.map(ex => [ex.nombre, ex.id]));

      const formattedExercises = aiWorkout.exercises
          .map((aiEx, index) => {
              const exerciseId = exerciseNameToIdMap.get(aiEx.exerciseName);
              if (!exerciseId) {
                  console.warn(`AI-generated exercise "${aiEx.exerciseName}" not found in available exercises. Skipping.`);
                  return null;
              }
              return {
                  exercise_id: exerciseId,
                  series: Number(aiEx.series) || 3,
                  repeticiones: Number(aiEx.repeticiones) || 10,
                  peso_objetivo: undefined, // Let user set this
                  orden: index + 1,
              };
          })
          .filter(ex => ex !== null) as Omit<WorkoutExercise, 'exercise_details'>[];

      if (formattedExercises.length === 0) {
          addToast("La rutina generada no contenía ejercicios válidos. No se pudo guardar.", 'warning');
          throw new Error("No valid exercises in generated routine.");
      }

      const submissionData = {
          nombre: aiWorkout.nombre,
          descripcion: aiWorkout.descripcion,
          exercises: formattedExercises,
      };

      // Reuse the existing form submission logic.
      await handleSubmitWorkoutForm(submissionData);
  };

  if (isLoading) { 
    return <div className="flex justify-center items-center h-full"><LoadingSpinner text="Cargando datos de rutinas..." /></div>;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-zinc-800 p-4 md:p-6 rounded-lg shadow-xl border border-zinc-700 space-y-4 md:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#06b6d4] text-center md:text-left">Mis Workouts</h1>
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <button
              onClick={() => setIsAIGeneratorOpen(true)}
              className="bg-[#fb923c] text-white py-2 px-4 rounded-md hover:bg-[#f97316] transition-colors font-medium text-sm flex items-center justify-center w-full sm:w-auto"
              disabled={isSubmitting || isSeeding || availableExercises.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2"><path d="M9.53 7.924a2.594 2.594 0 0 1 3.404-3.404l2.253 2.253a2.594 2.594 0 0 1-3.404 3.404l-2.253-2.253Z" /><path d="m4.94 10.99 2.253-2.253a2.594 2.594 0 0 1 3.404-3.404L12.85 7.586a4.094 4.094 0 0 1-5.79 5.79l-2.253-2.253a2.594 2.594 0 0 1-.95-2.508c.19-1.25.932-2.268 1.944-2.888a.75.75 0 0 0-.712-1.33c-1.393.82-2.454 2.24-2.69 3.9C2.48 9.998 2.8 11.23 3.69 12.12l-1.352 1.351a.75.75 0 0 0 1.06 1.061l1.542-1.542Z" /><path d="M12.879 12.121a.75.75 0 0 0-1.06-1.06l-1.542 1.541a.75.75 0 0 0 1.06 1.06l1.542-1.541Z" /><path d="M12.121 8.379a.75.75 0 0 0-1.06-1.06l-.53.53a.75.75 0 1 0 1.06 1.06l.53-.53Z" /></svg>
              <span>Generar con IA</span>
            </button>
            <button
              onClick={handleSeedRoutines}
              className="bg-zinc-600 text-white py-2 px-4 rounded-md hover:bg-zinc-500 transition-colors font-medium text-sm flex items-center justify-center w-full sm:w-auto"
              disabled={isSeeding || isSubmitting}
            >
              {isSeeding ? <LoadingSpinner size="sm" /> : (
                  <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                  </svg>
                  <span>Cargar Ejemplos</span>
                  </>
              )}
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setEditingWorkout(null); }}
              className="bg-[#06b6d4] text-white py-2 px-4 rounded-md hover:bg-[#0891b2] transition-colors font-semibold w-full sm:w-auto"
              disabled={isSubmitting || isSeeding}
            >
              {showForm && !editingWorkout ? 'Cancelar' : 'Crear Nuevo Workout'}
            </button>
        </div>
      </div>

      {(isSubmitting || isSeeding) && <div className="my-4 flex justify-center"><LoadingSpinner text={isSubmitting ? "Guardando workout..." : "Cargando workouts de ejemplo..."} size="sm"/></div>}

      {showForm && (
        <RoutineForm 
            onSubmit={handleSubmitWorkoutForm} 
            availableExercises={availableExercises}
            initialWorkout={editingWorkout || undefined}
        />
      )}
       {showForm && availableExercises.length === 0 && !isLoading && (
         <p className="text-center text-orange-400 p-4 bg-orange-900/50 rounded-md">Cargando lista de ejercicios disponibles para el formulario... Si este mensaje persiste, podría haber un problema al obtener los ejercicios.</p>
       )}

      <AIRoutineGeneratorModal
          isOpen={isAIGeneratorOpen}
          onClose={() => setIsAIGeneratorOpen(false)}
          onSave={handleSaveAIGeneratedWorkout}
          availableExercises={availableExercises}
       />

      {!isLoading && !isSubmitting && !isSeeding && workouts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workouts.map(workout => (
            <div key={workout.id} className="bg-zinc-800 p-6 rounded-lg shadow-md border border-zinc-700 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#06b6d4] mb-2">{workout.nombre}</h2>
                <p className="text-sm text-zinc-400 mb-1">Ejercicios: {workout.exercises?.length || 0}</p>
                {workout.descripcion && <p className="text-sm text-zinc-500 mb-3 italic">"{workout.descripcion}"</p>}
                <ul className="text-xs text-zinc-300 mb-4 list-disc list-inside max-h-24 overflow-y-auto custom-scrollbar">
                    {workout.exercises?.map((wEx, idx) => {
                        const exDetail = availableExercises.find(e => e.id === wEx.exercise_id);
                        return <li key={`${wEx.exercise_id}-${idx}`}>{exDetail?.nombre || wEx.exercise_id} - {wEx.series} series x {wEx.repeticiones} reps</li>
                    })}
                </ul>
              </div>
              <div className="mt-auto space-y-2">
                <Link
                  to={`/workout/${workout.id}`}
                  className="block w-full text-center bg-[#06b6d4] text-white py-2 px-4 rounded-md hover:bg-[#0891b2] transition-colors font-medium"
                >
                  Iniciar Workout
                </Link>
                 <button
                  onClick={() => handleStartEdit(workout)}
                  className="block w-full text-center bg-zinc-600 text-white py-2 px-4 rounded-md hover:bg-zinc-500 transition-colors font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteWorkout(workout.id)}
                  className="block w-full text-center bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && !isLoading && !isSubmitting && !isSeeding && (
          <div className="text-center text-zinc-400 text-xl py-10 bg-zinc-800 border border-zinc-700 rounded-lg">
            <h2 className="text-2xl font-bold text-[#06b6d4] mb-4">No has creado ningún workout todavía</h2>
            <p className="mb-6">¡Empieza creando uno o carga nuestras rutinas de ejemplo para empezar!</p>
            <button 
                onClick={handleSeedRoutines} 
                disabled={isSeeding} 
                className="inline-block bg-[#06b6d4] text-white py-3 px-6 rounded-md hover:bg-[#0891b2] transition-colors text-lg font-semibold"
            >
                {isSeeding ? <LoadingSpinner text="Cargando..." /> : 'Cargar Rutinas de Ejemplo'}
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default RoutinesPage;