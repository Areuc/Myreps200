
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Profile, UserGoal, WorkoutLog } from '../types'; 
import { USER_GOALS_OPTIONS } from '../constants';
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase } from '../supabaseClient';
import { useToast } from '../hooks/useToast';


const ProfilePage: React.FC = () => {
  const { user, updateUserProfile, loading: authLoading } = useAuth(); // user is Profile
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<UserGoal | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [workoutStats, setWorkoutStats] = useState({ total: 0, lastDate: '' });
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
        if (user) {
            setName(user.name);
            setGoal(user.goal);

            // Fetch workout stats from Supabase
            try {
                // Fetch only count and the latest start_time, since duration is not available
                const { count, data, error } = await supabase
                    .from('workout_logs')
                    .select('start_time', { count: 'exact' })
                    .eq('user_id', user.id)
                    .order('start_time', { ascending: false });

                if (error) throw error;

                setWorkoutStats({
                    total: count || 0,
                    lastDate: data && data.length > 0 ? new Date(data[0].start_time).toLocaleDateString('es-ES') : 'N/A',
                });
            } catch (error) {
                console.error("Error fetching workout stats from Supabase:", error);
                setWorkoutStats({ total: 0, lastDate: 'Error' });
            }
            setPageLoading(false);
        } else if (!authLoading) {
            setPageLoading(false); // No user, not loading auth, so stop page load.
        }
    };
    fetchProfileData();
  }, [user, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateUserProfile({ name, goal }); // Pass only name and goal
      addToast('¡Perfil actualizado con éxito!', 'success');
      setIsEditing(false);
    } catch (error: any) {
      addToast(`Error al actualizar el perfil: ${error.message}`, 'error');
      console.error(error);
    }
  };

  const commonInputClasses = "w-full px-3 py-2 border border-zinc-600 rounded-md shadow-sm bg-zinc-700 text-white placeholder-zinc-400";
  const disabledInputClasses = "w-full px-3 py-2 border border-zinc-700 rounded-md shadow-sm bg-zinc-800 text-zinc-400 cursor-not-allowed";
  const enabledInputClasses = `${commonInputClasses} focus:outline-none focus:ring-[#06b6d4] focus:border-[#06b6d4]`;


  if (authLoading || pageLoading) {
    return <div className="flex justify-center items-center h-full"><LoadingSpinner text="Cargando perfil..." /></div>;
  }

  if (!user) {
    return <p className="text-center text-red-400">Usuario no encontrado. Por favor, inicia sesión.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto bg-zinc-800 p-6 md:p-8 rounded-xl shadow-2xl space-y-8 border border-zinc-700">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#06b6d4] mb-2">Tu Perfil</h1>
        <p className="text-zinc-400">Gestiona tu información personal y tus objetivos de fitness.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1">Correo Electrónico:</label>
          <input
            type="email"
            id="email"
            value={user.email || ''} // Email might be undefined on Profile if not set from auth
            disabled
            className={disabledInputClasses}
          />
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1">Nombre:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditing}
            required
            className={!isEditing ? disabledInputClasses : enabledInputClasses}
          />
        </div>
        <div>
          <label htmlFor="goal" className="block text-sm font-medium text-zinc-300 mb-1">Objetivo Principal:</label>
          <select
            id="goal"
            value={goal || ''}
            onChange={(e) => setGoal(e.target.value as UserGoal)}
            disabled={!isEditing}
            className={`${!isEditing ? disabledInputClasses : enabledInputClasses} appearance-none`}
          >
            <option value="" disabled className="bg-zinc-700 text-zinc-400">Selecciona tu objetivo</option>
            {USER_GOALS_OPTIONS.map(g => (
              <option key={g} value={g} className="bg-zinc-700 text-white">{g}</option>
            ))}
          </select>
        </div>
        
        {isEditing ? (
          <div className="flex space-x-3">
            <button
              type="submit"
              className="flex-1 bg-[#06b6d4] text-white py-2.5 px-4 rounded-md hover:bg-[#0891b2] transition-colors font-medium"
            >
              Guardar Cambios
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setName(user.name); setGoal(user.goal); }}
              className="flex-1 bg-zinc-600 text-zinc-200 py-2.5 px-4 rounded-md hover:bg-zinc-500 transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full bg-[#fb923c] text-white py-2.5 px-4 rounded-md hover:bg-[#f97316] transition-colors font-medium"
          >
            Editar Perfil
          </button>
        )}
      </form>

      <div className="border-t border-zinc-700 pt-6">
        <h2 className="text-2xl font-semibold text-[#06b6d4] mb-3">Estadísticas de Entrenamiento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="bg-zinc-700 p-4 rounded-lg">
                <p className="text-zinc-400 text-sm">Entrenamientos Totales</p>
                <p className="text-2xl font-bold text-[#06b6d4]">{workoutStats.total}</p>
            </div>
            <div className="bg-zinc-700 p-4 rounded-lg">
                <p className="text-zinc-400 text-sm">Último Entrenamiento</p>
                <p className="text-lg font-semibold text-[#06b6d4]">{workoutStats.lastDate}</p>
            </div>
        </div>
      </div>
       <p className="text-xs text-zinc-500 mt-4 text-center">Tu información de perfil y estadísticas de entrenamiento se guardan y recuperan de Supabase.</p>
    </div>
  );
};

export default ProfilePage;
