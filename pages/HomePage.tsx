



import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AICoachPanel from '../components/AICoachPanel';
import { useAuth } from '../hooks/useAuth';
import { WorkoutLog, LoggedExerciseData } from '../types'; 
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase } from '../supabaseClient';

const HomePage: React.FC = () => {
  const { user } = useAuth(); // user is Profile | null
  const [lastWorkout, setLastWorkout] = useState<WorkoutLog | null>(null);
  const [totalWorkouts, setTotalWorkouts] = useState<number>(0);
  const [workoutsCount, setWorkoutsCount] = useState<number>(0); // Changed from routinesCount
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch total counts and the most recent workout log
      const [workoutsResponse, logsResponse] = await Promise.all([
        supabase
          .from('workouts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('workout_logs')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .order('start_time', { ascending: false })
      ]);

      const { count: workoutsPlanCount, error: workoutsError } = workoutsResponse;
      if (workoutsError) throw workoutsError;
      
      const { data: logsData, count: totalLogs, error: logsError } = logsResponse;
      if (logsError) throw logsError;

      setWorkoutsCount(workoutsPlanCount || 0);
      setTotalWorkouts(totalLogs || 0);

      if (logsData && logsData.length > 0) {
        const lastLog = logsData[0];
        
        // Fetch workout name if there's a workout_id
        let workoutName = 'Entrenamiento personalizado';
        if (lastLog.workout_id) {
          const { data: workoutData, error: workoutNameError } = await supabase
            .from('workouts')
            .select('nombre')
            .eq('id', lastLog.workout_id)
            .single();
          if (workoutNameError) {
            console.error("Error fetching workout name for homepage:", workoutNameError);
          } else {
            workoutName = workoutData.nombre;
          }
        }
        
        // Fetch related exercise_logs for the last workout to populate AICoachPanel
        const { data: exerciseLogsData, error: exerciseLogsError } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('workout_log_id', lastLog.id)
          .order('serie', { ascending: true });

        if (exerciseLogsError) {
          console.error("Error fetching exercise logs for homepage:", exerciseLogsError);
          setLastWorkout({ ...lastLog, workout_name: workoutName } as WorkoutLog); // Set workout without exercises if this fails
        } else {
          // Group exercise logs by exercise_id to reconstruct the `completed_exercises` array
          const exercisesMap = new Map<string, LoggedExerciseData>();
          exerciseLogsData.forEach(eLog => {
            if (!exercisesMap.has(eLog.exercise_id)) {
              exercisesMap.set(eLog.exercise_id, {
                exercise_id: eLog.exercise_id,
                sets_performed: [],
                notes_for_exercise: eLog.comentario || ''
              });
            }
            const exData = exercisesMap.get(eLog.exercise_id)!;
            exData.sets_performed.push({
              reps_achieved: eLog.repeticiones,
              weight_used: eLog.peso,
            });
            // Since note might be duplicated, just ensure it's captured
            if(!exData.notes_for_exercise && eLog.comentario) {
                exData.notes_for_exercise = eLog.comentario;
            }
          });

          const reconstructedLog: WorkoutLog = {
              ...(lastLog as WorkoutLog),
              workout_name: workoutName, // Add the fetched name
              completed_exercises: Array.from(exercisesMap.values())
          };
          setLastWorkout(reconstructedLog);
        }
      } else {
        setLastWorkout(null);
      }

    } catch (error: any) {
      console.error("Error fetching dashboard data from Supabase:", error.message || error);
      setLastWorkout(null);
      setTotalWorkouts(0);
      setWorkoutsCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading || !user) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner text="Cargando tu panel de control..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-zinc-800 p-6 rounded-lg shadow-xl border border-zinc-700">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#06b6d4] mb-2">¡Bienvenido de nuevo, {user.name}!</h1>
        <p className="text-zinc-300">Tu objetivo actual es: <span className="font-semibold text-[#06b6d4]">{user.goal || 'No establecido'}</span>. ¡Sigue así!</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-zinc-800 p-6 rounded-lg shadow-md text-center border border-zinc-700">
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">Entrenamientos Completados</h2>
          <p className="text-4xl font-bold text-[#06b6d4]">{totalWorkouts}</p>
        </div>
        <div className="bg-zinc-800 p-6 rounded-lg shadow-md text-center border border-zinc-700">
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">Planes de Workout Creados</h2>
          <p className="text-4xl font-bold text-[#06b6d4]">{workoutsCount}</p>
        </div>
        <div className="bg-zinc-800 p-6 rounded-lg shadow-md text-center border border-zinc-700 flex flex-col justify-center">
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">Próximo Entrenamiento</h2>
            {workoutsCount > 0 ? (
                <Link to="/routines" className="mt-2 inline-block bg-[#06b6d4] text-white py-3 px-6 rounded-md hover:bg-[#0891b2] transition-colors text-lg font-semibold">
                    Iniciar Workout
                </Link>
            ) : (
                 <Link to="/routines" className="mt-2 inline-block bg-[#06b6d4] text-white py-3 px-6 rounded-md hover:bg-[#0891b2] transition-colors text-lg font-semibold">
                    Crear Workout
                </Link>
            )}
        </div>
      </div>
      
      <AICoachPanel userId={user.id} userGoal={user.goal} lastWorkoutLog={lastWorkout || undefined} />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-800 p-6 rounded-lg shadow-md border border-zinc-700">
          <h3 className="text-xl font-semibold text-[#06b6d4] mb-4">Acciones Rápidas</h3>
          <div className="space-y-3">
            <Link to="/routines" className="block w-full text-center bg-[#06b6d4] text-white py-3 px-4 rounded-md hover:bg-[#0891b2] transition-colors font-medium">
              Ver/Crear Workouts
            </Link>
            <Link to="/exercises" className="block w-full text-center bg-[#06b6d4] opacity-90 text-white py-3 px-4 rounded-md hover:bg-[#0891b2] transition-colors font-medium">
              Explorar Ejercicios
            </Link>
             <Link to="/profile" className="block w-full text-center bg-zinc-600 text-white py-3 px-4 rounded-md hover:bg-zinc-500 transition-colors font-medium">
              Actualizar Perfil y Metas
            </Link>
          </div>
        </div>
        {lastWorkout && (
           <div className="bg-zinc-800 p-6 rounded-lg shadow-md border border-zinc-700">
            <h3 className="text-xl font-semibold text-[#06b6d4] mb-4">Último Entrenamiento Registrado</h3>
            <p className="text-zinc-300"><span className="font-medium text-white">Nombre:</span> {lastWorkout.workout_name || 'Entrenamiento personalizado'}</p>
            <p className="text-zinc-300"><span className="font-medium text-white">Fecha:</span> {new Date(lastWorkout.start_time).toLocaleDateString('es-ES')}</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;