// Enum for UserGoal remains useful
export enum UserGoal {
  MUSCLE_GAIN = 'Ganar Músculo',
  WEIGHT_LOSS = 'Perder Peso',
  ENDURANCE = 'Mejorar Resistencia',
  GENERAL_FITNESS = 'Fitness General',
}

// Defines the structure for a single recorded weight entry for an exercise
export interface LastWeightRecord {
  weight: number;
  date: string; // ISO string
}

// UserLastWeights structure for storing last recorded weights for exercises
export interface UserLastWeights {
  [exerciseId: string]: LastWeightRecord;
}

// Corresponds to a 'profiles' table, linked to auth.users
export interface Profile {
  id: string; // UUID, matches auth.users.id
  email?: string; // email is in auth.users, can be here for convenience
  name: string;
  goal?: UserGoal;
  last_exercise_weights?: UserLastWeights; // Stored as JSONB
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

// Corresponds to 'exercises' table
export interface Exercise {
  id: string; // UUID or Supabase default ID type
  nombre: string;
  descripcion?: string;
  grupo_muscular: string;
  musculos?: string;
  enfoques?: string[];
  equipo?: string;
  instructions?: string;
  video_url?: string;
  dificultad?: 'Principiante' | 'Intermedio' | 'Avanzado';
  image_url?: string;
  gif_url?: string;
  es_core: boolean;
  machine_id?: string; // FK to machines.id
  created_at?: string;
}

// Corresponds to 'machines' table
export interface Machine {
  id: string;
  nombre: string;
  descripcion?: string;
  image_url?: string;
  created_at?: string;
}

// Corresponds to 'workouts' table
export interface Workout {
  id: string;
  user_id: string; // FK to auth.users.id
  nombre: string;
  descripcion?: string;
  created_at?: string;
  exercises: WorkoutExercise[]; // Assembled client-side from workout_exercises table
}

// This defines an exercise as part of a workout plan
export interface WorkoutExercise {
  exercise_id: string;
  exercise_details?: Exercise; // Populated by join or client-side enhancement
  orden?: number;
  series: number;
  repeticiones: number; // e.g., 10
  peso_objetivo?: number;
}


// --- Data structures for logging actual performance ---

// Represents data for a single set performed by the user
export interface LoggedSetData {
  reps_achieved: number;
  weight_used: number;
  notes_for_set?: string; // Optional: notes specific to this set
}

// Represents data for a specific exercise logged during a workout session
export interface LoggedExerciseData {
  exercise_id: string;
  // exercise_details?: Exercise; // Optional: Snapshot of exercise details at time of logging
  sets_performed: LoggedSetData[];
  notes_for_exercise?: string; // Optional: notes for the overall performance of this exercise in this session
}

// Represents a completed workout session log
export interface WorkoutLog {
  id: string;
  user_id: string;
  workout_id?: string; // FK to workouts.id (optional for custom, non-saved workouts)
  workout_name?: string; // Denormalized, or from joined workout.name
  start_time: string; // ISO timestamp
  end_time?: string; // ISO timestamp
  duration_minutes?: number;
  overall_difficulty_rating?: 'Fácil' | 'Justo' | 'Difícil';
  notes?: string; // General notes for the entire workout session
  created_at?: string;
  completed_exercises?: LoggedExerciseData[]; // Assembled on client-side, NOT a DB column
}

// Corresponds to 'exercise_logs' table (represents one set performed, for Supabase)
export interface ExerciseLog {
  id: string;
  workout_log_id: string; // FK to workout_logs.id
  exercise_id: string; // FK to exercises.id
  exercise_details?: Exercise; // Populated by join if needed
  serie: number;
  repeticiones: number;
  peso: number;
  comentario?: string;
  created_at?: string;
}


// --- Supabase specific Database definition ---
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string // UUID, PK, FK to auth.users.id
          name: string
          email?: string | null
          goal?: UserGoal | null
          last_exercise_weights?: Json | null // JSONB for UserLastWeights
          created_at?: string | null
          updated_at?: string | null
        }
        Insert: {
          id: string // Must match auth.users.id
          name: string
          email?: string | null
          goal?: UserGoal | null
          last_exercise_weights?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          goal?: UserGoal | null
          last_exercise_weights?: Json | null
          updated_at?: string | null
        }
      }
      exercises: {
        Row: Exercise
        Insert: Omit<Exercise, 'id' | 'created_at'> & { id?: string; created_at?: string; }
        Update: Partial<Omit<Exercise, 'id' | 'created_at'>> & { id?: string }
      }
      machines: {
        Row: Omit<Machine, 'name'> & { nombre: string }
        Insert: Omit<Machine, 'id' | 'created_at' | 'name'> & { nombre: string; id?: string; created_at?: string; }
        Update: Partial<Omit<Machine, 'id' | 'created_at' | 'name'>> & { nombre?: string; id?: string }
      }
      workouts: {
        Row: {
          id: string // PK
          user_id: string // FK to auth.users.id
          nombre: string
          descripcion?: string | null
          created_at?: string | null
        }
        Insert: {
          id?: string
          user_id: string
          nombre: string
          descripcion?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          nombre?: string
          descripcion?: string | null
        }
      }
      workout_exercises: {
        Row: {
          id: string // PK
          workout_id: string // FK
          exercise_id: string // FK
          orden: number
          series: number
          repeticiones: number
          peso_objetivo?: number | null
          created_at?: string | null
        }
        Insert: {
          id?: string
          workout_id: string
          exercise_id: string
          orden: number
          series: number
          repeticiones: number
          peso_objetivo?: number | null
          created_at?: string | null
        }
        Update: {
          orden?: number
          series?: number
          repeticiones?: number
          peso_objetivo?: number | null
        }
      }
      workout_logs: { // Supabase row for workout_logs table
        Row: {
          id: string // PK
          user_id: string // FK
          workout_id?: string | null // FK, optional for ad-hoc
          start_time: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_id?: string | null
          start_time: string
        }
        Update: {}
      }
      exercise_logs: { // Represents one set performed (Supabase table)
        Row: {
          id: string;
          workout_log_id: string;
          exercise_id: string;
          serie: number;
          repeticiones: number;
          peso: number;
          comentario?: string | null;
          created_at?: string | null;
        }
        Insert: {
          id?: string;
          workout_log_id: string;
          exercise_id: string;
          serie: number;
          repeticiones: number;
          peso: number;
          comentario?: string | null;
          created_at?: string | null;
        }
        Update: {
          id?: string;
          serie?: number;
          repeticiones?: number;
          peso?: number;
          comentario?: string | null;
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_goal_enum: UserGoal
      difficulty_enum: 'Principiante' | 'Intermedio' | 'Avanzado'
      workout_difficulty_rating_enum: 'Fácil' | 'Justo' | 'Difícil'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}


// --- Toast Notification Types ---
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}


// --- Component Prop Types ---

export interface ExerciseCardProps {
  exercise: Exercise;
  onAddToRoutine?: (exercise: Exercise) => void;
}

export interface RoutineFormProps {
  onSubmit: (workoutData: Omit<Workout, 'id' | 'user_id' | 'created_at' | 'exercises'> & { exercises: Omit<WorkoutExercise, 'exercise_details'>[] }) => void;
  initialWorkout?: Workout; // For editing
  availableExercises: Exercise[];
}


export interface WorkoutLoggerProps {
  workout: Workout; // The workout plan, with exercises including their details
  allExercises: Exercise[]; // Pass all available exercises for detail lookup if needed
  onWorkoutComplete: (
    loggedExercises: LoggedExerciseData[], // Array of all exercises with their performed sets
    durationMinutes: number,
    overallDifficulty?: 'Fácil' | 'Justo' | 'Difícil'
  ) => void;
  user: Profile; // The user's profile, including last_exercise_weights
}

export interface AICoachPanelProps {
  userId: string;
  userGoal?: UserGoal;
  lastWorkoutLog?: WorkoutLog; // The full workout log, potentially with completed_exercises
}

export interface AICoachMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string; // ISO string
}

// --- AI Routine Generation Types ---
export interface AIWorkoutPreferences {
  daysPerWeek: number;
  workoutDuration: number; // in minutes
  availableEquipment: string;
  fitnessLevel: 'Principiante' | 'Intermedio' | 'Avanzado';
  focus: string; // e.g., 'upper body', 'glutes', 'full body'
}

export interface AIGeneratedWorkoutExercise {
    exerciseName: string;
    series: number;
    repeticiones: number; // Single number as requested in prompt
}

export interface AIGeneratedWorkout {
    nombre: string;
    descripcion: string;
    exercises: AIGeneratedWorkoutExercise[];
}

export interface AIRoutineGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (workout: AIGeneratedWorkout) => Promise<void>;
    availableExercises: Exercise[];
}