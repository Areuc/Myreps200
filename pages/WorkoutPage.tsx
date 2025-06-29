



import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WorkoutLogger from '../components/WorkoutLogger';
import { Workout, LoggedExerciseData, WorkoutLog, UserLastWeights, Exercise, WorkoutExercise, Database } from '../types';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import AICoachPanel from '../components/AICoachPanel';
import { supabase } from '../supabaseClient'; 

const WorkoutPage: React.FC = () => {
  const { workoutId } = useParams<{ workoutId?: string }>();
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();

  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [completedWorkoutLog, setCompletedWorkoutLog] = useState<WorkoutLog | null>(null);
  const [startTime] = useState<number>(Date.now());

  const fetchAllExercisesForLogger = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('exercises').select('*');
      if (error) throw error;
      const exercises = data || [];
      setAllExercises(exercises);
      return exercises; 
    } catch (error: any) {
      console.error("Error fetching all exercises for logger from Supabase:", error);
      setAllExercises([]);
      return [];
    }
  }, []);

  const fetchWorkoutDetails = useCallback(async (exercisesList: Exercise[]) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (workoutId) {
      try {
        const { data: workoutData, error: workoutError } = await supabase
          .from('workouts')
          .select('*')
          .eq('id', workoutId)
          .single();
        
        if (workoutError) throw workoutError;

        if (workoutData?.user_id === user.id) {
            const { data: workoutExercisesData, error: exercisesError } = await supabase
                .from('workout_exercises')
                .select('*')
                .eq('workout_id', workoutId)
                .order('orden', { ascending: true });

            if (exercisesError) throw exercisesError;

          const exercisesWithDetails: WorkoutExercise[] = 
            (workoutExercisesData || []).map((wEx): WorkoutExercise => { 
              const fullExDetail = exercisesList.find(e => e.id === wEx.exercise_id);
              return {
                exercise_id: wEx.exercise_id, 
                exercise_details: fullExDetail || undefined,
                orden: wEx.orden,
                series: wEx.series,
                repeticiones: wEx.repeticiones,
                peso_objetivo: wEx.peso_objetivo,
              };
            });

          setCurrentWorkout({ 
            id: workoutData.id, 
            nombre: workoutData.nombre,
            descripcion: workoutData.descripcion || '',
            user_id: workoutData.user_id,
            exercises: exercisesWithDetails, 
            created_at: workoutData.created_at || undefined,
          });
        } else {
          console.error("Workout no encontrado o no pertenece al usuario");
          navigate('/routines'); 
        }
      } catch (error) {
        console.error("Error fetching workout from Supabase:", error);
        navigate('/routines');
      }
    } else {
       if (exercisesList.length > 0) { 
            setCurrentWorkout({
                id: 'custom_' + Date.now(),
                nombre: 'Entrenamiento Personalizado Ad-Hoc',
                user_id: user.id,
                exercises: [], 
                descripcion: 'Un workout creado sobre la marcha (funcionalidad limitada).'
            });
        } else {
            console.warn("Cannot start custom ad-hoc workout without available exercises list.");
             navigate('/routines');
        }
    }
  }, [workoutId, user, navigate]); 

  useEffect(() => {
    setIsLoading(true);
    fetchAllExercisesForLogger().then(fetchedExercises => {
        fetchWorkoutDetails(fetchedExercises).finally(() => {
            setIsLoading(false);
        });
    }).catch(() => {
        setIsLoading(false);
    });
  }, [fetchAllExercisesForLogger, fetchWorkoutDetails]);

  const handleWorkoutComplete = async (
    loggedExercisesData: LoggedExerciseData[], 
    durationMinutes: number,
    difficultyRating?: 'Fácil' | 'Justo' | 'Difícil'
  ) => {
    if (!user || !currentWorkout) return;
    setIsLoading(true);

    try {
      // Step 1: Insert the main workout_log entry, only with columns that exist in the DB
      const newWorkoutLogData: Database['public']['Tables']['workout_logs']['Insert'] = { 
        user_id: user.id,
        workout_id: currentWorkout.id.startsWith('custom_') ? undefined : currentWorkout.id,
        start_time: new Date(startTime).toISOString(), 
      };

      const { data: insertedLog, error: logError } = await supabase
        .from('workout_logs')
        .insert(newWorkoutLogData)
        .select()
        .single();
      
      if (logError || !insertedLog) throw logError || new Error("Failed to save workout log.");

      // Step 2: Prepare and insert all the individual exercise set logs
      const exerciseLogsPayload: Database['public']['Tables']['exercise_logs']['Insert'][] = loggedExercisesData.flatMap((exLog) => 
        exLog.sets_performed.map((set, setIndex) => ({
          workout_log_id: insertedLog.id,
          exercise_id: exLog.exercise_id,
          serie: setIndex + 1,
          repeticiones: set.reps_achieved,
          peso: set.weight_used,
          comentario: exLog.notes_for_exercise || null
        }))
      );
      
      if (exerciseLogsPayload.length > 0) {
        const { error: exerciseLogError } = await supabase.from('exercise_logs').insert(exerciseLogsPayload);
        if (exerciseLogError) throw exerciseLogError;
      }

      // Step 3: Update the user's last recorded weights
      const currentLastWeights: UserLastWeights = { ...(user.last_exercise_weights || {}) };
      loggedExercisesData.forEach(exLog => {
        let maxWeight = 0;
        exLog.sets_performed.forEach(set => {
          if (set.weight_used > maxWeight) {
            maxWeight = set.weight_used;
          }
        });

        if (maxWeight > 0) {
          currentLastWeights[exLog.exercise_id] = {
            weight: maxWeight,
            date: insertedLog.start_time, 
          };
        }
      });
      
      await updateUserProfile({ last_exercise_weights: currentLastWeights });

      // Step 4: Prepare the completed log for the UI (with client-side data not present in DB)
      const savedLogForState: WorkoutLog = {
        ...insertedLog,
        workout_name: currentWorkout.nombre,
        duration_minutes: durationMinutes,
        overall_difficulty_rating: difficultyRating,
        end_time: new Date().toISOString(),
        completed_exercises: loggedExercisesData,
      };

      setCompletedWorkoutLog(savedLogForState);
      setWorkoutCompleted(true);

      // Step 5: Clean up the persisted state from localStorage
      const storageKey = `inProgressWorkout-${user.id}-${currentWorkout.id}`;
      localStorage.removeItem(storageKey);

    } catch (error) {
      console.error("Error saving workout log or updating last weights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !user ) { 
    return <div className="flex justify-center items-center h-full"><LoadingSpinner text="Cargando entrenamiento..." /></div>;
  }
  
  if (!currentWorkout || (workoutId && allExercises.length === 0 && currentWorkout.exercises.some(ex => !ex.exercise_details)) ) {
    return (
      <div className="text-center py-10 bg-zinc-800 p-6 rounded-lg shadow-lg border border-zinc-700">
        <p className="text-xl text-red-400">Error: El workout no se pudo cargar completamente, posiblemente debido a un problema al obtener los detalles de los ejercicios.</p>
        <button onClick={() => navigate('/routines')} className="mt-4 bg-[#06b6d4] text-white py-2 px-4 rounded hover:bg-[#0891b2]">
          Volver a Workouts
        </button>
      </div>
    );
  }

  if (currentWorkout.exercises.length === 0 && !currentWorkout.id.startsWith('custom_')) { // Only for non-custom workouts
    return (
      <div className="text-center py-10 bg-zinc-800 p-6 rounded-lg shadow-lg border border-zinc-700">
        <h2 className="text-2xl font-bold text-[#06b6d4] mb-4">Workout Vacío</h2>
        <p className="text-zinc-300 mb-6">Este workout ('{currentWorkout.nombre}') no tiene ejercicios. Por favor, edita el workout y añade algunos ejercicios antes de empezar.</p>
        <button onClick={() => navigate('/routines')} className="bg-[#06b6d4] text-white py-2 px-6 rounded-md hover:bg-[#0891b2] transition-colors">
          Ir a Mis Workouts
        </button>
      </div>
    );
  }

  if (workoutCompleted && completedWorkoutLog) {
    return (
      <div className="space-y-6">
        <div className="bg-zinc-800 p-8 rounded-lg shadow-xl text-center border border-zinc-700">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-[#22d916] mx-auto mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#06b6d4] mb-3">¡Workout Completado!</h2>
          <p className="text-zinc-300 mb-2">Has completado el workout: <span className="font-semibold text-white">{completedWorkoutLog.workout_name}</span>.</p>
          <p className="text-zinc-300 mb-2">Duración: <span className="font-semibold text-white">{completedWorkoutLog.duration_minutes} minutos</span>.</p>
          {completedWorkoutLog.overall_difficulty_rating && <p className="text-zinc-300 mb-2">Dificultad: <span className="font-semibold text-white">{completedWorkoutLog.overall_difficulty_rating}</span>.</p>}
          <p className="text-zinc-300 mb-6">¡Buen trabajo!</p>
        </div>
        <AICoachPanel userId={user.id} userGoal={user.goal} lastWorkoutLog={completedWorkoutLog} />
        <div className="text-center mt-6">
          <button onClick={() => navigate('/')} className="bg-[#06b6d4] text-white py-3 px-6 rounded-md hover:bg-[#0891b2] transition-colors text-lg font-semibold">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <WorkoutLogger 
        workout={currentWorkout} 
        allExercises={allExercises} 
        onWorkoutComplete={handleWorkoutComplete} 
        user={user} 
      />
    </div>
  );
};

export default WorkoutPage;