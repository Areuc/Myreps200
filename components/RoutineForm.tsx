
import React, { useState, useEffect, useMemo } from 'react';
import { Workout, WorkoutExercise, Exercise, RoutineFormProps } from '../types';
import { useToast } from '../hooks/useToast';

const RoutineForm: React.FC<RoutineFormProps> = ({ onSubmit, initialWorkout, availableExercises }) => {
  const { addToast } = useToast();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>([]);
  
  // State for adding a new exercise
  const [exerciseToAddId, setExerciseToAddId] = useState<string>('');
  const [series, setSeries] = useState<number>(3);
  const [repeticiones, setRepeticiones] = useState<number>(10);
  
  // --- State for new filters ---
  const [muscleGroupFilter, setMuscleGroupFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [isCoreFilter, setIsCoreFilter] = useState<'' | 'core' | 'non_core'>('');
  const [equipmentFilter, setEquipmentFilter] = useState('');

  // --- Derived options for filters ---
  const muscleGroups = useMemo(() => Array.from(new Set(availableExercises.map(ex => ex.grupo_muscular))).sort(), [availableExercises]);
  const difficulties = useMemo(() => Array.from(new Set(availableExercises.map(ex => ex.dificultad).filter(Boolean) as string[])).sort(), [availableExercises]);
  const equipmentTypes = useMemo(() => {
    const allEquipment = availableExercises.flatMap(ex => ex.equipo?.split(',').map(e => e.trim()) || []);
    return Array.from(new Set(allEquipment.filter(e => e))).sort();
  }, [availableExercises]);

  // --- Filtered list of exercises for the dropdown ---
  const filteredAvailableExercises = useMemo(() => {
    return availableExercises.filter(exercise => {
      const muscleGroupMatch = !muscleGroupFilter || exercise.grupo_muscular === muscleGroupFilter;
      const difficultyMatch = !difficultyFilter || exercise.dificultad === difficultyFilter;
      const coreMatch = !isCoreFilter || (isCoreFilter === 'core' && exercise.es_core) || (isCoreFilter === 'non_core' && !exercise.es_core);
      const equipmentMatch = !equipmentFilter || (exercise.equipo && exercise.equipo.toLowerCase().includes(equipmentFilter.toLowerCase()));
      return muscleGroupMatch && difficultyMatch && coreMatch && equipmentMatch;
    });
  }, [availableExercises, muscleGroupFilter, difficultyFilter, isCoreFilter, equipmentFilter]);


  useEffect(() => {
    if (initialWorkout) {
      setNombre(initialWorkout.nombre);
      setDescripcion(initialWorkout.descripcion || '');
      setSelectedExercises(initialWorkout.exercises.map(ex => ({
        exercise_id: ex.exercise_id,
        series: ex.series,
        repeticiones: ex.repeticiones,
        orden: ex.orden,
        peso_objetivo: ex.peso_objetivo,
      })));
    } else {
      // Reset form if initialWorkout is not provided (e.g., creating new)
      setNombre('');
      setDescripcion('');
      setSelectedExercises([]);
    }
  }, [initialWorkout]);

  const handleAddExerciseToWorkout = () => {
    if (!exerciseToAddId) {
        addToast("Por favor, selecciona un ejercicio.", 'warning');
        return;
    }
    const exerciseExists = selectedExercises.find(ex => ex.exercise_id === exerciseToAddId);
    if (exerciseExists) {
        addToast("Este ejercicio ya está en la rutina.", 'info');
        return;
    }
    const newExercise: WorkoutExercise = {
      exercise_id: exerciseToAddId,
      series: series,
      repeticiones: Number(repeticiones), // Ensure it's a number
      orden: selectedExercises.length + 1,
    };
    setSelectedExercises([...selectedExercises, newExercise]);
    // Reset add exercise form fields
    setExerciseToAddId('');
    setSeries(3);
    setRepeticiones(10);
  };

  const handleRemoveExercise = (exerciseIdToRemove: string) => {
    setSelectedExercises(selectedExercises.filter(ex => ex.exercise_id !== exerciseIdToRemove));
  };
  
  const handleUpdateExerciseInWorkout = (index: number, field: keyof WorkoutExercise, value: string | number) => {
    const updatedExercises = [...selectedExercises];
    const exerciseToUpdate = { ...updatedExercises[index] };
    
    // All these fields should be numbers
    if (field === 'series' || field === 'peso_objetivo' || field === 'repeticiones') {
        (exerciseToUpdate as any)[field] = parseInt(value as string, 10);
         if (isNaN((exerciseToUpdate as any)[field]) && (field === 'series' || field === 'repeticiones')) {
            (exerciseToUpdate as any)[field] = 0; // Default to 0 or handle error
        } else if (isNaN((exerciseToUpdate as any)[field]) && field === 'peso_objetivo') {
            (exerciseToUpdate as any)[field] = undefined;
        }

    } else {
        // This branch is for potential future string fields
        (exerciseToUpdate as any)[field] = value; 
    }
    updatedExercises[index] = exerciseToUpdate;
    setSelectedExercises(updatedExercises);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      addToast('Por favor, asigna un nombre a la rutina.', 'warning');
      return;
    }
    if (selectedExercises.length === 0) {
      addToast('Por favor, añade al menos un ejercicio a la rutina.', 'warning');
      return;
    }
    const submissionData = {
        nombre: nombre,
        descripcion: descripcion,
        exercises: selectedExercises.map((ex, index) => ({
            exercise_id: ex.exercise_id,
            series: ex.series,
            repeticiones: ex.repeticiones,
            peso_objetivo: ex.peso_objetivo,
            orden: index + 1, // Re-calculate order on submission
        })),
    };
    onSubmit(submissionData);
    
    if (!initialWorkout) {
        setNombre('');
        setDescripcion('');
        setSelectedExercises([]);
    }
  };
  
  const commonInputClasses = "w-full px-3 py-2 border border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-[#06b6d4] focus:border-[#06b6d4] bg-zinc-700 text-white placeholder-zinc-400";
  const filterSelectClasses = "bg-zinc-700 text-white";

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-800 p-6 rounded-lg shadow-xl space-y-6 border border-zinc-700">
      <div>
        <label htmlFor="workoutName" className="block text-sm font-medium text-zinc-300 mb-1">Nombre de la Rutina:</label>
        <input
          type="text"
          id="workoutName"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className={commonInputClasses}
        />
      </div>
      <div>
        <label htmlFor="workoutDescription" className="block text-sm font-medium text-zinc-300 mb-1">Descripción (Opcional):</label>
        <textarea
          id="workoutDescription"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          className={commonInputClasses}
        />
      </div>

      <div className="border-t border-zinc-700 pt-6">
        <h4 className="text-lg font-semibold text-[#06b6d4] mb-3">Añadir Ejercicio a la Rutina:</h4>
        
        {/* --- FILTERS --- */}
        <div className="mb-4 p-4 border border-zinc-600 rounded-md bg-zinc-900/50">
            <h5 className="text-md font-medium text-zinc-300 mb-2">Filtrar Ejercicios</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <select value={muscleGroupFilter} onChange={(e) => setMuscleGroupFilter(e.target.value)} className={commonInputClasses}>
                    <option value="" className={filterSelectClasses}>Todos los Grupos</option>
                    {muscleGroups.map(mg => <option key={mg} value={mg} className={filterSelectClasses}>{mg}</option>)}
                </select>
                <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className={commonInputClasses}>
                    <option value="" className={filterSelectClasses}>Cualquier Dificultad</option>
                    {difficulties.map(df => <option key={df} value={df} className={filterSelectClasses}>{df}</option>)}
                </select>
                <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} className={commonInputClasses}>
                    <option value="" className={filterSelectClasses}>Cualquier Equipo</option>
                    {equipmentTypes.map(eq => <option key={eq} value={eq} className={filterSelectClasses}>{eq}</option>)}
                </select>
                <select value={isCoreFilter} onChange={(e) => setIsCoreFilter(e.target.value as any)} className={commonInputClasses}>
                    <option value="" className={filterSelectClasses}>Core (Todos)</option>
                    <option value="core" className={filterSelectClasses}>Solo Core</option>
                    <option value="non_core" className={filterSelectClasses}>No Core</option>
                </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div>
            <label htmlFor="exerciseSelect" className="block text-sm font-medium text-zinc-300 mb-1">Ejercicio:</label>
            <select
              id="exerciseSelect"
              value={exerciseToAddId}
              onChange={(e) => setExerciseToAddId(e.target.value)}
              className={commonInputClasses}
            >
              <option value="">Selecciona un ejercicio ({filteredAvailableExercises.length} encontrados)</option>
              {filteredAvailableExercises.map(ex => (
                <option key={ex.id} value={ex.id} className="bg-zinc-700 text-white">{ex.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="series" className="block text-sm font-medium text-zinc-300 mb-1">Series:</label>
            <input type="number" id="series" value={series} onChange={(e) => setSeries(Number(e.target.value))} min="1" className={commonInputClasses}/>
          </div>
          <div>
            <label htmlFor="repeticiones" className="block text-sm font-medium text-zinc-300 mb-1">Repeticiones:</label>
            <input type="number" id="repeticiones" value={repeticiones} onChange={(e) => setRepeticiones(Number(e.target.value))} min="1" className={commonInputClasses}/>
          </div>
          
          <div className="md:col-span-3">
            <button
                type="button"
                onClick={handleAddExerciseToWorkout}
                className="w-full bg-[#06b6d4] text-white py-2 px-4 rounded-md hover:bg-[#0891b2] transition-colors"
            >
                Añadir Ejercicio Seleccionado
            </button>
          </div>

        </div>
      </div>
      
      {selectedExercises.length > 0 && (
        <div className="border-t border-zinc-700 pt-6">
          <h4 className="text-lg font-semibold text-[#06b6d4] mb-3">Ejercicios en la Rutina:</h4>
          <ul className="space-y-4">
            {selectedExercises.map((selectedEx, index) => {
              const exerciseDetail = availableExercises.find(ex => ex.id === selectedEx.exercise_id);
              return (
                <li key={`${selectedEx.exercise_id}-${index}`} className="p-4 border border-zinc-700 rounded-md bg-zinc-700">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-[#06b6d4]">{exerciseDetail?.nombre || 'Ejercicio Desconocido'}</p>
                    <button type="button" onClick={() => handleRemoveExercise(selectedEx.exercise_id)} className="text-red-500 hover:text-red-400 text-sm">Eliminar</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400">Series</label>
                        <input type="number" value={selectedEx.series} onChange={(e) => handleUpdateExerciseInWorkout(index, 'series', e.target.value)} min="1" className={`${commonInputClasses} p-1 text-sm`}/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-400">Repeticiones</label>
                        <input type="number" value={selectedEx.repeticiones} onChange={(e) => handleUpdateExerciseInWorkout(index, 'repeticiones', e.target.value)} min="1" className={`${commonInputClasses} p-1 text-sm`}/>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-[#06b6d4] text-white py-3 px-4 rounded-md hover:bg-[#0891b2] transition-colors text-lg font-semibold"
      >
        {initialWorkout ? 'Actualizar Rutina' : 'Crear Rutina'}
      </button>
    </form>
  );
};

export default RoutineForm;
