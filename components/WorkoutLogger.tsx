
import React, { useState, useEffect, useCallback } from 'react';
import { Workout, WorkoutLoggerProps, Profile, Exercise, LoggedExerciseData, LoggedSetData, LastWeightRecord, WorkoutExercise } from '../types';
import LoadingSpinner from './LoadingSpinner';


const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({ workout, allExercises, onWorkoutComplete, user }) => {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [loggedWorkoutExercises, setLoggedWorkoutExercises] = useState<LoggedExerciseData[]>([]);
  const [startTime, setStartTime] = useState<number>(0); // Initialized after checking local storage
  const [timer, setTimer] = useState<number | null>(null);
  const [timerDisplay, setTimerDisplay] = useState<string>("00:00");
  const [workoutDifficulty, setWorkoutDifficulty] = useState<'Fácil' | 'Justo' | 'Difícil' | undefined>(undefined);
  const [lastRecordedWeightInfo, setLastRecordedWeightInfo] = useState<LastWeightRecord | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // Prevents premature saving
  const [showDifficultyPrompt, setShowDifficultyPrompt] = useState(false);

  // --- START: Rest Timer State ---
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restTimerIntervalId, setRestTimerIntervalId] = useState<number | null>(null);
  // --- END: Rest Timer State ---

  // --- START: Screen Wake Lock ---
  useEffect(() => {
    let wakeLockSentinel: WakeLockSentinel | null = null;
    
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
          console.log('Screen Wake Lock is active.');
          wakeLockSentinel.addEventListener('release', () => {
            console.log('Screen Wake Lock was released.');
          });
        } catch (err: any) {
          console.error(`Could not acquire wake lock: ${err.name}, ${err.message}`);
        }
      } else {
        console.warn('Screen Wake Lock API not supported on this browser.');
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLockSentinel !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on component unmount
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release()
          .catch(e => console.error('Error releasing wake lock:', e));
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  // --- END: Screen Wake Lock ---

  // Effect for initialization and state restoration
  useEffect(() => {
    const storageKey = `inProgressWorkout-${user.id}-${workout.id}`;
    const savedStateJSON = localStorage.getItem(storageKey);

    if (savedStateJSON) {
        try {
            const savedState = JSON.parse(savedStateJSON);
            if (savedState.loggedWorkoutExercises && savedState.loggedWorkoutExercises.length === workout.exercises.length) {
                setLoggedWorkoutExercises(savedState.loggedWorkoutExercises);
                setCurrentExerciseIndex(savedState.currentExerciseIndex || 0);
                setStartTime(savedState.startTime || Date.now());
                setIsInitialized(true);
                console.log("Workout session restored from localStorage.");
                return; // Successfully restored
            } else {
                console.warn("Saved workout state does not match current workout plan. Starting fresh.");
                localStorage.removeItem(storageKey);
            }
        } catch (e) {
            console.error("Failed to parse saved workout state, starting fresh.", e);
            localStorage.removeItem(storageKey);
        }
    }

    // Initialize fresh state if no valid saved state is found
    setLoggedWorkoutExercises(
      workout.exercises.map(planExercise => ({
        exercise_id: planExercise.exercise_id,
        sets_performed: Array(planExercise.series).fill(null).map(() => ({ 
            reps_achieved: 0, 
            weight_used: 0 
        })),
        notes_for_exercise: '', // Initialize notes
      }))
    );
    setStartTime(Date.now());
    setIsInitialized(true);
  }, [workout, user.id]);

  // Effect for state persistence to localStorage
  useEffect(() => {
    if (isInitialized && startTime > 0) {
      const storageKey = `inProgressWorkout-${user.id}-${workout.id}`;
      const stateToSave = {
        loggedWorkoutExercises,
        currentExerciseIndex,
        startTime,
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }
  }, [loggedWorkoutExercises, currentExerciseIndex, startTime, user.id, workout.id, isInitialized]);


  const updateTimer = useCallback(() => {
    if (startTime === 0) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    setTimerDisplay(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }, [startTime]);

  useEffect(() => {
    const intervalId = window.setInterval(updateTimer, 1000);
    setTimer(intervalId);
    return () => window.clearInterval(intervalId);
  }, [startTime, updateTimer]);

  // Current exercise from the workout plan
  const currentWorkoutPlanExercise: WorkoutExercise | undefined = workout.exercises[currentExerciseIndex];
  // Find full exercise details from allExercises list
  const exerciseDetails: Exercise | undefined = currentWorkoutPlanExercise 
    ? allExercises.find(ex => ex.id === currentWorkoutPlanExercise.exercise_id) 
    : undefined;

  // Effect to fetch last recorded weight from user object
  useEffect(() => {
    if (exerciseDetails && user && user.last_exercise_weights) {
      const lastWeight = user.last_exercise_weights[exerciseDetails.id];
      setLastRecordedWeightInfo(lastWeight || null);
    } else {
      setLastRecordedWeightInfo(null);
    }
  }, [currentExerciseIndex, exerciseDetails, user]);

  useEffect(() => {
    // Component unmount cleanup for the rest timer interval
    return () => {
      if (restTimerIntervalId) {
        clearInterval(restTimerIntervalId);
      }
    };
  }, [restTimerIntervalId]);


  // --- START: Rest Timer Functions ---
  const playNotificationSound = () => {
    // Using Web Audio API for a self-contained sound without needing an asset file.
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Lower volume

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2); // Play for 0.2s
  };

  const handleRestComplete = () => {
    playNotificationSound();
    // The modal will show a "Done!" message and then close after a delay.
    setTimeout(() => {
        setIsResting(false);
        if (restTimerIntervalId) clearInterval(restTimerIntervalId);
        setRestTimerIntervalId(null);
    }, 2000);
  };

  const startRestTimer = (duration = 180) => {
    if (restTimerIntervalId) clearInterval(restTimerIntervalId);
    
    setRestTimeLeft(duration);
    setIsResting(true);
    
    const intervalId = window.setInterval(() => {
      setRestTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          handleRestComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setRestTimerIntervalId(intervalId);
  };

  const skipRestTimer = () => {
    if (restTimerIntervalId) clearInterval(restTimerIntervalId);
    setRestTimerIntervalId(null);
    setIsResting(false);
  };
  // --- END: Rest Timer Functions ---


  const handleSetChange = (exerciseLogIndex: number, setIndex: number, field: keyof LoggedSetData, value: string) => {
    const updatedLogs = [...loggedWorkoutExercises];
    if (updatedLogs[exerciseLogIndex] && updatedLogs[exerciseLogIndex].sets_performed[setIndex]) {
        const numValue = parseFloat(value); // Use parseFloat for weight
        if (!isNaN(numValue) || value === "") {
            (updatedLogs[exerciseLogIndex].sets_performed[setIndex] as any)[field] = value === "" ? 0 : numValue;
            setLoggedWorkoutExercises(updatedLogs);
        }
    }
  };
  
  const handleNotesChange = (exerciseLogIndex: number, notes: string) => {
    const updatedLogs = [...loggedWorkoutExercises];
     if (updatedLogs[exerciseLogIndex]) {
        updatedLogs[exerciseLogIndex].notes_for_exercise = notes;
        setLoggedWorkoutExercises(updatedLogs);
     }
  };
  
  const currentLoggedExercise = loggedWorkoutExercises[currentExerciseIndex];

  const goToNextExercise = () => {
    if (currentExerciseIndex < workout.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
    } else {
       setShowDifficultyPrompt(true);
    }
  };

  const goToPreviousExercise = () => {
    if (currentExerciseIndex > 0) {
        setCurrentExerciseIndex(currentExerciseIndex - 1);
    }
  };
  
  const handleFinishWorkout = (difficulty?: 'Fácil' | 'Justo' | 'Difícil') => {
    if (timer) window.clearInterval(timer);
    if (restTimerIntervalId) clearInterval(restTimerIntervalId);

    const durationMinutes = Math.floor((Date.now() - startTime) / 60000);
    onWorkoutComplete(loggedWorkoutExercises, durationMinutes, difficulty);
  };
  
  const commonInputClasses = "w-full px-2 py-1 border border-zinc-600 rounded-md shadow-sm bg-zinc-700 text-white placeholder-zinc-400 focus:outline-none focus:ring-[#06b6d4] focus:border-[#06b6d4]";

  if (!isInitialized || !exerciseDetails || !currentLoggedExercise) {
    return <div className="p-6 bg-zinc-800 rounded-lg shadow-xl"><LoadingSpinner text="Cargando ejercicio..." /></div>;
  }

  if (showDifficultyPrompt) {
    return (
      <div className="bg-zinc-800 p-6 rounded-lg shadow-xl text-center border border-zinc-700">
        <h2 className="text-2xl font-bold text-[#06b6d4] mb-4">¡Entrenamiento Completado!</h2>
        <p className="text-zinc-300 mb-4">¿Cómo calificarías la dificultad general de este entrenamiento?</p>
        <div className="flex justify-center space-x-3 mb-6">
          {(['Fácil', 'Justo', 'Difícil'] as const).map(level => (
            <button
              key={level}
              onClick={() => { setWorkoutDifficulty(level); handleFinishWorkout(level); }}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${workoutDifficulty === level ? 'bg-[#06b6d4] text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-[#06b6d4] hover:text-white'}`}
            >
              {level}
            </button>
          ))}
        </div>
         <button
          onClick={() => handleFinishWorkout(undefined)}
          className="bg-zinc-600 text-zinc-200 py-2 px-6 rounded-md hover:bg-zinc-500 transition-colors"
        >
          Omitir y Finalizar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 p-4 md:p-6 rounded-lg shadow-xl border border-zinc-700">
      {isResting && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
          <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-sm text-center border-2 border-[#06b6d4]">
            {restTimeLeft > 0 ? (
              <>
                <h3 className="text-2xl font-bold text-zinc-300 mb-4">Tiempo de Descanso</h3>
                <div className="text-7xl font-mono font-bold text-[#06b6d4] mb-6" aria-live="assertive">
                  {Math.floor(restTimeLeft / 60)}:{String(restTimeLeft % 60).padStart(2, '0')}
                </div>
                <button
                  onClick={skipRestTimer}
                  className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors font-medium"
                >
                  Saltar Descanso
                </button>
              </>
            ) : (
              <>
                <h3 className="text-4xl font-bold text-[#22d916] mb-4 animate-pulse">¡A por la siguiente!</h3>
                <p className="text-zinc-300">El descanso ha terminado.</p>
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-2 sm:space-y-0">
        <h2 className="text-xl md:text-2xl font-bold text-[#06b6d4]">{workout.nombre}</h2>
        <div className="text-lg md:text-xl font-semibold text-white">Tiempo: {timerDisplay}</div>
      </div>
      
      <div className="mb-8 p-4 border border-zinc-700 rounded-lg bg-zinc-700">
        <h3 className="text-lg md:text-xl font-semibold text-[#06b6d4] mb-2">{exerciseDetails.nombre}</h3>
        <p className="text-sm text-zinc-400 mb-1">Grupo Muscular: {exerciseDetails.grupo_muscular}</p>
        {lastRecordedWeightInfo && (
          <p className="text-sm text-[#fb923c] bg-[#fb923c]/20 px-2 py-1 rounded-md my-2 inline-block">
            Último peso registrado: <strong className="font-semibold">{lastRecordedWeightInfo.weight} kg</strong> el {new Date(lastRecordedWeightInfo.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
          </p>
        )}
        {currentWorkoutPlanExercise && currentWorkoutPlanExercise.series > 0 && currentWorkoutPlanExercise.repeticiones > 0 && (
          <p className="text-sm text-zinc-400 mb-1">Objetivo: {currentWorkoutPlanExercise.series} series x {currentWorkoutPlanExercise.repeticiones} reps</p>
        )}
        {exerciseDetails.instructions && <p className="text-sm text-zinc-400 mb-2 mt-1">Instrucciones: {exerciseDetails.instructions}</p>}
        {(exerciseDetails.gif_url || exerciseDetails.image_url) && 
            <img 
                src={exerciseDetails.gif_url || exerciseDetails.image_url} 
                alt={exerciseDetails.nombre} 
                className="w-full max-w-xs h-auto max-h-72 mx-auto rounded-md my-2 object-contain bg-zinc-950" 
            />
        }
      </div>

      <div className="space-y-4">
        {currentLoggedExercise.sets_performed.map((set, setIndex) => (
          <div key={setIndex} className="grid grid-cols-12 gap-3 items-center p-3 bg-zinc-700 rounded-md">
            <p className="col-span-12 md:col-span-4 font-medium text-zinc-300">Serie {setIndex + 1}</p>
            <div className="col-span-5 md:col-span-3">
              <label htmlFor={`reps-${setIndex}`} className="block text-xs font-medium text-zinc-400 mb-1">Reps:</label>
              <input
                type="number"
                id={`reps-${setIndex}`}
                value={set.reps_achieved === 0 && !document.getElementById(`reps-${setIndex}`)?.matches(':focus') ? '' : set.reps_achieved} 
                onChange={(e) => handleSetChange(currentExerciseIndex, setIndex, 'reps_achieved', e.target.value)}
                placeholder="0"
                className={commonInputClasses}
                min="0"
              />
            </div>
            <div className="col-span-5 md:col-span-3">
              <label htmlFor={`weight-${setIndex}`} className="block text-xs font-medium text-zinc-400 mb-1">Peso (kg):</label>
              <input
                type="number"
                id={`weight-${setIndex}`}
                value={set.weight_used === 0 && !document.getElementById(`weight-${setIndex}`)?.matches(':focus') ? '' : set.weight_used} 
                onChange={(e) => handleSetChange(currentExerciseIndex, setIndex, 'weight_used', e.target.value)}
                placeholder="0"
                className={commonInputClasses}
                min="0"
                step="0.25" // Allow for smaller weight increments
              />
            </div>
            <div className="col-span-2 md:col-span-2 flex items-center justify-center h-full">
              <button
                type="button"
                onClick={() => startRestTimer(180)}
                className="bg-[#0e7490] text-white p-2 rounded-full hover:bg-[#0891b2] transition-colors shadow-md"
                title={`Iniciar descanso de 3 min para serie ${setIndex + 1}`}
                aria-label={`Iniciar descanso para serie ${setIndex + 1}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6">
        <label htmlFor="exerciseNotes" className="block text-sm font-medium text-zinc-300 mb-1">Notas del Ejercicio (opcional):</label>
        <textarea
          id="exerciseNotes"
          value={currentLoggedExercise.notes_for_exercise || ''}
          onChange={(e) => handleNotesChange(currentExerciseIndex, e.target.value)}
          rows={2}
          className={`${commonInputClasses} placeholder-zinc-500`}
          placeholder="Ej: Aumentar peso la próxima vez, buena forma..."
        />
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button
            onClick={goToPreviousExercise}
            disabled={currentExerciseIndex === 0}
            className="bg-zinc-600 text-zinc-300 py-2 px-4 rounded-md hover:bg-zinc-500 disabled:opacity-50 transition-colors"
        >
          Anterior
        </button>
        <button
          onClick={goToNextExercise}
          className="bg-[#06b6d4] text-white py-2 px-6 rounded-md hover:bg-[#0891b2] transition-colors text-lg font-semibold"
        >
          {currentExerciseIndex === workout.exercises.length - 1 ? 'Finalizar' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
};

export default WorkoutLogger;
