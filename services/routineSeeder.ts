
import { supabase } from '../supabaseClient';
import { Database, Exercise } from '../types';

// A map of canonical muscle groups to their possible variations/synonyms.
// All synonyms should be lowercase and without accents for the mapping logic to work.
const MUSCLE_GROUP_SYNONYMS: { [canonical: string]: string[] } = {
  pecho: ['pecho', 'pectoral', 'pectorales', 'chest', 'pecs'],
  espalda: ['espalda', 'dorsal', 'dorsales', 'back', 'lats', 'trapecio', 'trapecios', 'remo', 'espalda baja', 'lumbares'],
  hombros: ['hombro', 'hombros', 'deltoides', 'shoulders', 'delts'],
  triceps: ['triceps', 'tríceps'],
  biceps: ['biceps', 'bíceps', 'brazos'],
  piernas: [ // Consolidated leg group for robustness
    'piernas', 'pierna', 'tren inferior', 'legs',
    'cuadriceps', 'cuádriceps', 'quads', 'quadriceps',
    'isquiotibiales', 'isquiotibial', 'femoral', 'femorales', 'hamstrings', 'isquios', 'isquiosurales', 'corva', 'parte posterior pierna', 'biceps femoral',
    'gluteos', 'glúteo', 'glúteos', 'glute', 'glutes', 'cadera', 'caderas', 'nalgas', 'gluteo mayor',
    'pantorrillas', 'pantorrilla', 'gemelos', 'gemelo', 'calves', 'calf', 'soleo', 'sóleo', 'gastrocnemio'
  ],
  abdominales: ['abdominales', 'abdominal', 'abdomen', 'abs', 'core', 'oblicuos'],
};


// Create a reverse map for quick lookup: from a synonym to its canonical name.
const CANONICAL_GROUP_MAP = new Map<string, string>();
for (const canonical in MUSCLE_GROUP_SYNONYMS) {
  for (const synonym of MUSCLE_GROUP_SYNONYMS[canonical]) {
    CANONICAL_GROUP_MAP.set(synonym, canonical);
  }
}

/**
 * Normalizes a muscle group name and finds its canonical representation.
 * Handles case, accents, and synonyms.
 * @param name The raw muscle group name from the database or template.
 * @returns The canonical muscle group name (e.g., 'piernas') or the normalized name if no synonym is found.
 */
const getCanonicalMuscleGroup = (name: string): string => {
  if (!name) return '';
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return CANONICAL_GROUP_MAP.get(normalized) || normalized; // Return canonical or the normalized self as fallback
};


// Define the structure of our routine templates
type RoutineTemplate = {
  nombre: string;
  descripcion: string;
  // A map of muscle groups to the number of exercises to pick from each.
  exerciseDistribution: { [muscleGroup: string]: number };
};

// Helper to shuffle an array
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Define the templates for auto-generation.
// Using canonical muscle group names.
const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    nombre: 'Día de Empuje (Push) - Autogenerado',
    descripcion: 'Una rutina generada automáticamente enfocada en los músculos de empuje: pecho, hombros y tríceps.',
    exerciseDistribution: {
      'pecho': 2,
      'hombros': 2,
      'triceps': 1,
    },
  },
  {
    nombre: 'Día de Tirón (Pull) - Autogenerado',
    descripcion: 'Una rutina generada automáticamente enfocada en los músculos de tirón: espalda y bíceps.',
    exerciseDistribution: {
      'espalda': 3,
      'biceps': 2,
    },
  },
  {
    nombre: 'Día de Piernas - Autogenerado',
    descripcion: 'Una rutina generada automáticamente para un entrenamiento completo del tren inferior.',
    exerciseDistribution: {
      'piernas': 5, // Simplified to use the consolidated 'piernas' group
    },
  },
   {
    nombre: 'Cuerpo Completo (Full Body) - Autogenerado',
    descripcion: 'Una rutina de cuerpo completo generada automáticamente, ideal para empezar o para días con poco tiempo.',
    exerciseDistribution: {
      'piernas': 1, // Simplified to use the consolidated 'piernas' group
      'pecho': 1,
      'espalda': 1,
      'hombros': 1,
      'abdominales': 1,
    },
  },
];


/**
 * Seeds dynamically generated workout routines for a given user.
 * It fetches available exercises and creates routines based on muscle groups.
 * @param userId The UUID of the user to create the routines for.
 * @returns {Promise<{success: boolean, message: string}>} An object indicating success or failure.
 */
export const seedDefaultWorkouts = async (userId: string): Promise<{ success: boolean; message: string }> => {
  if (!userId) {
    return { success: false, message: 'Se requiere un ID de usuario.' };
  }

  try {
    // 1. Fetch all available exercises from the database
    const { data: allExercises, error: fetchError } = await supabase.from('exercises').select('*');
    if (fetchError) throw fetchError;
    if (!allExercises || allExercises.length === 0) {
      return { success: false, message: 'No hay ejercicios disponibles en la base de datos para generar rutinas.' };
    }

    // 2. Fetch existing workout names for this user to avoid duplication
    const { data: existingWorkouts, error: existingWorkoutsError } = await supabase
      .from('workouts')
      .select('nombre')
      .eq('user_id', userId);
    if (existingWorkoutsError) throw existingWorkoutsError;

    const existingWorkoutNames = new Set(existingWorkouts.map(w => w.nombre));

    // Filter templates for routines that don't already exist
    const routinesToCreateTemplates = ROUTINE_TEMPLATES.filter(template => !existingWorkoutNames.has(template.nombre));
    
    if (routinesToCreateTemplates.length === 0) {
      return { success: true, message: 'Las rutinas de ejemplo autogeneradas ya existen en tu cuenta.' };
    }
    
    // Group exercises by a CANONICAL muscle group for flexible matching
    const exercisesByMuscleGroup = new Map<string, Exercise[]>();
    allExercises.forEach(ex => {
        const canonicalGroup = getCanonicalMuscleGroup(ex.grupo_muscular);
        if (!canonicalGroup) return; // Skip exercises without a recognized group

        if (!exercisesByMuscleGroup.has(canonicalGroup)) {
            exercisesByMuscleGroup.set(canonicalGroup, []);
        }
        exercisesByMuscleGroup.get(canonicalGroup)!.push(ex);
    });

    let routinesCreatedCount = 0;
    for (const template of routinesToCreateTemplates) {
      // 3. Select exercises for the current routine template
      const selectedExercisesForRoutine: Exercise[] = [];
      let canCreateRoutine = true;
      let missingGroups: string[] = [];
      
      // First, validate that we have enough exercises for every muscle group in the template
      for (const [muscleGroup, count] of Object.entries(template.exerciseDistribution)) {
        const canonicalMuscleGroup = getCanonicalMuscleGroup(muscleGroup);
        const exercisePool = exercisesByMuscleGroup.get(canonicalMuscleGroup) || [];
        
        if (exercisePool.length < count) {
          missingGroups.push(muscleGroup);
          canCreateRoutine = false;
        }
      }

      if (!canCreateRoutine) {
          console.warn(`Se omitirá la rutina '${template.nombre}' por falta de ejercicios en los siguientes grupos: ${missingGroups.join(', ')}.`);
          continue; // Skip to the next template if it can't be fully created
      }
      
      // If validation passes, pick the exercises
      for (const [muscleGroup, count] of Object.entries(template.exerciseDistribution)) {
         const canonicalMuscleGroup = getCanonicalMuscleGroup(muscleGroup);
         const exercisePool = exercisesByMuscleGroup.get(canonicalMuscleGroup)!;
         const shuffledPool = shuffleArray(exercisePool);
         const pickedExercises = shuffledPool.slice(0, count);
         selectedExercisesForRoutine.push(...pickedExercises);
      }
      
      if (selectedExercisesForRoutine.length === 0) {
        continue;
      }

      // 4a. Insert the workout into the 'workouts' table
      const { data: newWorkout, error: workoutInsertError } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          nombre: template.nombre,
          descripcion: template.descripcion,
        })
        .select()
        .single();
      
      if (workoutInsertError) {
        console.error(`Error al insertar el workout '${template.nombre}':`, workoutInsertError);
        continue; // Skip to the next workout
      }
      if (!newWorkout) continue;

      // 4b. Prepare and insert the exercises for this workout
      const exercisesToInsert: Omit<Database['public']['Tables']['workout_exercises']['Insert'], 'id'|'created_at'>[] = shuffleArray(selectedExercisesForRoutine).map((exercise, index) => ({
        workout_id: newWorkout.id,
        exercise_id: exercise.id,
        orden: index + 1,
        series: 3, // Default values
        repeticiones: 10, // Default values
      }));
      
      if (exercisesToInsert.length > 0) {
        const { error: exercisesInsertError } = await supabase
          .from('workout_exercises')
          .insert(exercisesToInsert);
        
        if (exercisesInsertError) {
          console.error(`Error al insertar ejercicios para el workout '${template.nombre}':`, exercisesInsertError);
          // Optional: delete the workout if its exercises couldn't be added
          await supabase.from('workouts').delete().eq('id', newWorkout.id);
        } else {
          routinesCreatedCount++;
        }
      }
    }

    if (routinesCreatedCount > 0) {
      return { success: true, message: `${routinesCreatedCount} rutina(s) de ejemplo generada(s) con éxito.` };
    } else {
      return { success: false, message: 'No se pudieron crear nuevas rutinas. Puede que no haya suficientes ejercicios variados en la base de datos o que las rutinas ya existan.' };
    }
    
  } catch (error: any) {
    console.error('Ocurrió un error durante la creación de rutinas:', error);
    return { success: false, message: `Error al crear rutinas: ${error.message}` };
  }
};
