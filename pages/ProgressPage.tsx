


import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Exercise } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ExerciseProgressChart from '../components/ExerciseProgressChart';
import { Link } from 'react-router-dom';

const ProgressPage: React.FC = () => {
    const { user } = useAuth();
    const [loggedExercises, setLoggedExercises] = useState<Exercise[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

    useEffect(() => {
        const fetchLoggedExercises = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            
            try {
                // Step 1: Get all workout_log IDs for the user to find out which workouts they've done.
                const { data: workoutLogs, error: workoutLogsError } = await supabase
                    .from('workout_logs')
                    .select('id')
                    .eq('user_id', user.id);

                if (workoutLogsError) throw workoutLogsError;
                
                if (!workoutLogs || workoutLogs.length === 0) {
                    setLoggedExercises([]);
                    setIsLoading(false);
                    return; // User has no logged workouts
                }
                
                const workoutLogIds = workoutLogs.map(log => log.id);

                // Step 2: Get all unique exercise_ids from those workout logs
                const { data: exerciseLogs, error: exerciseLogsError } = await supabase
                    .from('exercise_logs')
                    .select('exercise_id')
                    .in('workout_log_id', workoutLogIds);
                
                if (exerciseLogsError) throw exerciseLogsError;

                const uniqueExerciseIds = [...new Set(exerciseLogs.map(log => log.exercise_id))];
                
                if (uniqueExerciseIds.length === 0) {
                     setLoggedExercises([]);
                     setIsLoading(false);
                     return; // No exercises logged for those workouts
                }

                // Step 3: Fetch the full details for those unique exercises
                const { data: exercises, error: exercisesError } = await supabase
                    .from('exercises')
                    .select('*')
                    .in('id', uniqueExerciseIds)
                    .order('nombre', { ascending: true });

                if (exercisesError) throw exercisesError;

                setLoggedExercises(exercises || []);
            } catch (e: any) {
                console.error("Error fetching logged exercises:", e);
                setError("No se pudo cargar la lista de ejercicios registrados.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLoggedExercises();
    }, [user]);

    const toggleExerciseExpansion = (exerciseId: string) => {
        setExpandedExerciseId(prevId => (prevId === exerciseId ? null : exerciseId));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><LoadingSpinner text="Cargando tu progreso..." /></div>;
    }

    if (error) {
        return <p className="text-center text-red-400 text-xl py-10">{error}</p>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-zinc-800 p-6 rounded-lg shadow-xl border border-zinc-700">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#06b6d4] mb-2">Mi Progreso</h1>
                <p className="text-zinc-300">Aquí puedes ver tu progreso en los ejercicios que has registrado. Haz clic en un ejercicio para ver el gráfico.</p>
            </div>
            
            {loggedExercises.length > 0 ? (
                <div className="space-y-4">
                    {loggedExercises.map(exercise => (
                        <div key={exercise.id} className="bg-zinc-800 rounded-lg shadow-md border border-zinc-700 overflow-hidden transition-all duration-300">
                            <button 
                                onClick={() => toggleExerciseExpansion(exercise.id)}
                                className="w-full p-4 text-left flex justify-between items-center hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#06b6d4] focus:ring-inset"
                                aria-expanded={expandedExerciseId === exercise.id}
                                aria-controls={`progress-chart-${exercise.id}`}
                            >
                                <span className="text-lg font-semibold text-[#06b6d4]">{exercise.nombre}</span>
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    className={`h-6 w-6 text-zinc-400 transform transition-transform ${expandedExerciseId === exercise.id ? 'rotate-180' : ''}`} 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {expandedExerciseId === exercise.id && user && (
                                <div id={`progress-chart-${exercise.id}`} className="p-4 bg-zinc-900 border-t border-zinc-700">
                                    <ExerciseProgressChart 
                                        userId={user.id}
                                        exerciseId={exercise.id}
                                        exerciseName={exercise.nombre}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-zinc-400 text-xl py-10 bg-zinc-800 p-6 rounded-lg shadow-lg border border-zinc-700">
                    <h2 className="text-2xl font-bold text-[#06b6d4] mb-4">No hay datos de progreso todavía</h2>
                    <p className="mb-6">Completa algunos entrenamientos para empezar a registrar tu progreso y verlo aquí.</p>
                    <Link to="/routines" className="inline-block bg-[#06b6d4] text-white py-2 px-4 rounded-md hover:bg-[#0891b2] transition-colors">
                        Ir a mis Workouts
                    </Link>
                </div>
            )}
        </div>
    );
};

export default ProgressPage;