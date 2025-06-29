
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ExerciseCard from '../components/ExerciseCard';
import { Exercise, Workout, Database } from '../types';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

type WorkoutSlim = Pick<Workout, 'id' | 'nombre'>;

const ExercisesPage: React.FC = () => {
  const { addToast } = useToast();
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState(''); // Immediate value from input
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Debounced value for filtering
  const [muscleGroupFilter, setMuscleGroupFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [isCoreFilter, setIsCoreFilter] = useState<'' | 'core' | 'non_core'>('');

  // State for "Add to Routine" modal
  const { user } = useAuth();
  const [selectedExerciseForRoutine, setSelectedExerciseForRoutine] = useState<Exercise | null>(null);
  const [userWorkouts, setUserWorkouts] = useState<WorkoutSlim[]>([]);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');

  useEffect(() => {
    const fetchExercises = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from('exercises')
          .select('*')
          .order('nombre', { ascending: true });

        if (dbError) throw dbError;
        setAllExercises(data || []);
      } catch (e: any) {
        console.error("Error fetching exercises from Supabase:", e);
        let errorMessage = "Error al cargar ejercicios.";
        if (e && e.message) {
          errorMessage += ` Detalles: ${e.message}`;
        }
        setError(errorMessage);
        setAllExercises([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExercises();
  }, []);

  // Debounce effect for search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay before triggering filter

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);


  // Fetch user's workouts when modal is opened
  useEffect(() => {
    if (selectedExerciseForRoutine && user) {
        setIsLoadingWorkouts(true);
        supabase.from('workouts').select('id, nombre').eq('user_id', user.id).order('nombre', { ascending: true })
            .then(({ data, error: workoutError }) => {
                if (workoutError) {
                    console.error("Error fetching workouts", workoutError);
                    addToast('No se pudieron cargar tus rutinas.', 'error');
                    setUserWorkouts([]);
                } else {
                    setUserWorkouts(data || []);
                }
                setIsLoadingWorkouts(false);
            });
    }
  }, [selectedExerciseForRoutine, user, addToast]);

  const muscleGroups = useMemo(() => Array.from(new Set(allExercises.map(ex => ex.grupo_muscular))).sort(), [allExercises]);
  const equipmentTypes = useMemo(() => {
    const allEquipment = allExercises.flatMap(ex => ex.equipo?.split(',').map(e => e.trim()) || []);
    return Array.from(new Set(allEquipment.filter(e => e))).sort();
  }, [allExercises]);
  const difficulties = useMemo(() => Array.from(new Set(allExercises.map(ex => ex.dificultad).filter(Boolean) as string[])).sort(), [allExercises]);

  const commonInputClasses = "w-full px-3 py-2 border border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-[#06b6d4] focus:border-[#06b6d4] bg-zinc-700 text-white placeholder-zinc-400";

  const filteredExercises = useMemo(() => {
    return allExercises.filter(exercise => {
      const nameMatch = exercise.nombre.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const muscleGroupMatch = !muscleGroupFilter || exercise.grupo_muscular === muscleGroupFilter;
      const equipmentMatch = !equipmentFilter || (exercise.equipo && exercise.equipo.toLowerCase().includes(equipmentFilter.toLowerCase()));
      const difficultyMatch = !difficultyFilter || exercise.dificultad === difficultyFilter;
      const coreMatch = !isCoreFilter || (isCoreFilter === 'core' && exercise.es_core) || (isCoreFilter === 'non_core' && !exercise.es_core)

      return nameMatch && muscleGroupMatch && equipmentMatch && difficultyMatch && coreMatch;
    });
  }, [allExercises, debouncedSearchTerm, muscleGroupFilter, equipmentFilter, difficultyFilter, isCoreFilter]);

  const handleOpenAddToRoutineModal = (exercise: Exercise) => {
    setSelectedExerciseForRoutine(exercise);
    setSelectedWorkoutId('');
  };

  const handleConfirmAddToRoutine = async () => {
    if (!selectedWorkoutId || !selectedExerciseForRoutine || isLoadingWorkouts) return;
    setIsLoadingWorkouts(true);

    const targetWorkout = userWorkouts.find(w => w.id === selectedWorkoutId);
    if (!targetWorkout) {
        setIsLoadingWorkouts(false);
        return;
    }

    try {
        // Check if exercise already exists in the workout
        const { data: existingLink, error: checkError } = await supabase
            .from('workout_exercises')
            .select('id')
            .eq('workout_id', selectedWorkoutId)
            .eq('exercise_id', selectedExerciseForRoutine.id)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingLink) {
            addToast('Este ejercicio ya está en la rutina seleccionada.', 'info');
            setIsLoadingWorkouts(false);
            return;
        }

        // Get the current max order to append the new exercise
        const { count: currentExerciseCount, error: countError } = await supabase
            .from('workout_exercises')
            .select('*', { count: 'exact', head: true })
            .eq('workout_id', selectedWorkoutId);

        if (countError) throw countError;
        
        const newWorkoutExerciseData: Omit<Database['public']['Tables']['workout_exercises']['Insert'], 'id' | 'created_at'> = {
            workout_id: selectedWorkoutId,
            exercise_id: selectedExerciseForRoutine.id,
            series: 3,
            repeticiones: 10, // Default reps, as the DB requires an integer
            peso_objetivo: 0,
            orden: (currentExerciseCount || 0) + 1,
        };

        const { error: insertError } = await supabase
            .from('workout_exercises')
            .insert(newWorkoutExerciseData);

        if (insertError) throw insertError;

        addToast(`'${selectedExerciseForRoutine.nombre}' se añadió a '${targetWorkout.nombre}'.`, 'success');
        setTimeout(() => {
            setSelectedExerciseForRoutine(null);
        }, 500);

    } catch (error: any) {
        addToast('Error al añadir el ejercicio a la rutina.', 'error');
        console.error("Error adding exercise to workout:", error);
    } finally {
        setIsLoadingWorkouts(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><LoadingSpinner text="Cargando ejercicios..." /></div>;
  }

  if (error) {
    return <p className="text-center text-red-400 text-xl py-10">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-800 p-4 md:p-6 rounded-lg shadow-xl border border-zinc-700">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#06b6d4] mb-4">Biblioteca de Ejercicios</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={commonInputClasses}
          />
          <select 
            value={muscleGroupFilter} 
            onChange={(e) => setMuscleGroupFilter(e.target.value)}
            className={commonInputClasses}
          >
            <option value="" className="bg-zinc-700">Todos los Grupos Musculares</option>
            {muscleGroups.map(mg => <option key={mg} value={mg} className="bg-zinc-700">{mg}</option>)}
          </select>
          <select 
            value={equipmentFilter} 
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className={commonInputClasses}
          >
            <option value="" className="bg-zinc-700">Todo el Equipamiento</option>
            {equipmentTypes.map(eq => <option key={eq} value={eq} className="bg-zinc-700">{eq}</option>)}
          </select>
          <select 
            value={difficultyFilter} 
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className={commonInputClasses}
          >
            <option value="" className="bg-zinc-700">Todas las Dificultades</option>
            {difficulties.map(df => <option key={df} value={df} className="bg-zinc-700">{df}</option>)}
          </select>
           <select 
            value={isCoreFilter} 
            onChange={(e) => setIsCoreFilter(e.target.value as ('' | 'core' | 'non_core'))}
            className={commonInputClasses}
          >
            <option value="" className="bg-zinc-700">Todos (Core/No Core)</option>
            <option value="core" className="bg-zinc-700">Solo Core</option>
            <option value="non_core" className="bg-zinc-700">No Core</option>
          </select>
        </div>
      </div>

      {filteredExercises.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredExercises.map(exercise => (
            <ExerciseCard 
              key={exercise.id} 
              exercise={exercise} 
              onAddToRoutine={handleOpenAddToRoutineModal}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-zinc-400 text-xl py-10">No se encontraron ejercicios con los filtros seleccionados.</p>
      )}

      {selectedExerciseForRoutine && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
              <div className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-zinc-700 relative">
                  <button onClick={() => setSelectedExerciseForRoutine(null)} className="absolute top-3 right-3 text-zinc-400 hover:text-white" aria-label="Cerrar modal">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                  <h3 className="text-xl font-bold text-[#06b6d4] mb-4">Añadir "{selectedExerciseForRoutine.nombre}"</h3>
                  
                  {isLoadingWorkouts ? (
                      <div className="min-h-[150px] flex items-center justify-center">
                          <LoadingSpinner text="Cargando rutinas..." />
                      </div>
                  ) : userWorkouts.length > 0 ? (
                      <div className="space-y-4">
                          <div>
                              <label htmlFor="workout-select" className="block text-sm font-medium text-zinc-300 mb-1">Selecciona una rutina:</label>
                              <select
                                  id="workout-select"
                                  value={selectedWorkoutId}
                                  onChange={(e) => setSelectedWorkoutId(e.target.value)}
                                  className={commonInputClasses}
                              >
                                  <option value="" disabled>-- Mis Rutinas --</option>
                                  {userWorkouts.map(workout => (
                                      <option key={workout.id} value={workout.id} className="bg-zinc-700">{workout.nombre}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="flex justify-end pt-2 space-x-3">
                              <button onClick={() => setSelectedExerciseForRoutine(null)} className="px-4 py-2 rounded-md text-sm font-medium text-zinc-300 bg-zinc-600 hover:bg-zinc-500 transition-colors">Cancelar</button>
                              <button onClick={handleConfirmAddToRoutine} disabled={!selectedWorkoutId || isLoadingWorkouts} className="px-5 py-2 rounded-md text-sm font-medium text-white bg-[#06b6d4] hover:bg-[#0891b2] disabled:bg-zinc-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[100px]">
                                  {isLoadingWorkouts ? <LoadingSpinner size="sm"/> : "Confirmar"}
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="text-center py-4">
                          <p className="text-zinc-400 mb-4">No tienes rutinas creadas. Crea una primero para poder añadir ejercicios.</p>
                          <Link to="/routines" onClick={() => setSelectedExerciseForRoutine(null)} className="inline-block bg-[#06b6d4] text-white py-2 px-4 rounded-md hover:bg-[#0891b2] transition-colors">
                              Ir a Crear Rutina
                          </Link>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default ExercisesPage;
