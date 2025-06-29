


import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
  Filler,
} from 'chart.js';
import LoadingSpinner from './LoadingSpinner';

// Register the necessary components for Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ExerciseProgressChartProps {
  userId: string;
  exerciseId: string;
  exerciseName: string;
}

interface ProgressData {
  fecha: string; // Full ISO string timestamp for a session
  peso_maximo: number;
}

const ExerciseProgressChart: React.FC<ExerciseProgressChartProps> = ({ userId, exerciseId, exerciseName }) => {
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!userId || !exerciseId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Get all workout logs for the user to map log IDs to dates.
        const { data: workoutLogs, error: workoutLogsError } = await supabase
          .from('workout_logs')
          .select('id, start_time')
          .eq('user_id', userId);

        if (workoutLogsError) throw workoutLogsError;
        if (!workoutLogs || workoutLogs.length === 0) {
          setProgressData([]);
          setIsLoading(false);
          return;
        }

        const dateMap = new Map<string, string>();
        workoutLogs.forEach(log => {
          dateMap.set(log.id, log.start_time);
        });
        const workoutLogIds = workoutLogs.map(log => log.id);

        // Step 2: Get all exercise logs for the specific exercise that belong to the user's workouts.
        const { data: exerciseLogs, error: exerciseLogsError } = await supabase
          .from('exercise_logs')
          .select('workout_log_id, peso')
          .eq('exercise_id', exerciseId)
          .in('workout_log_id', workoutLogIds)
          .gt('peso', 0); // Optimization: only fetch logs with weight > 0

        if (exerciseLogsError) throw exerciseLogsError;

        // Step 3: Process data to find max weight PER SESSION (workout_log_id)
        const sessionMaxWeights: { [logId: string]: number } = {};
        (exerciseLogs || []).forEach(log => {
          if (log.peso > (sessionMaxWeights[log.workout_log_id] || 0)) {
            sessionMaxWeights[log.workout_log_id] = log.peso;
          }
        });

        const finalProgressData = Object.entries(sessionMaxWeights)
          .map(([logId, peso_maximo]) => ({
            fecha: dateMap.get(logId)!, // Get full ISO timestamp from map
            peso_maximo: peso_maximo,
          }))
          .filter(d => d.fecha) // Ensure date exists
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

        setProgressData(finalProgressData);

      } catch (e: any) {
        console.error("Error fetching exercise progress:", e);
        const errorMessage = e.message ? `No se pudo cargar el historial: ${e.message}` : "No se pudo cargar el historial de progreso.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, [userId, exerciseId]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `Progreso de Peso Máximo para ${exerciseName}`,
        color: '#06b6d4', // Primary
        font: { size: 16, weight: 'bold' },
        padding: { top: 10, bottom: 20 }
      },
      tooltip: {
        backgroundColor: '#27272a', // zinc-800
        titleColor: '#06b6d4', // Primary
        bodyColor: '#d4d4d8', // zinc-300
        borderColor: '#3f3f46', // zinc-700
        borderWidth: 1,
        callbacks: {
          title: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex;
            const dataPoint = progressData[index];
            if (dataPoint) {
                return new Date(dataPoint.fecha).toLocaleString('es-ES', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                });
            }
            return '';
          },
          label: (context) => `Peso máximo: ${context.parsed.y} kg`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#a1a1aa', font: { size: 10 } }, // zinc-400
        grid: { color: '#3f3f46' }  // zinc-700
      },
      y: {
        beginAtZero: false,
        ticks: { color: '#a1a1aa' },
        grid: { color: '#52525b' }, // zinc-600
        title: {
          display: true,
          text: 'Peso (kg)',
          color: '#e4e4e7' // zinc-200
        }
      }
    },
    interaction: {
        intersect: false,
        mode: 'index',
    },
  };

  const chartData: ChartData<'line'> = {
    labels: progressData.map(d => new Date(d.fecha).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Peso Máximo',
        data: progressData.map(d => d.peso_maximo),
        borderColor: '#06b6d4', // Primary
        backgroundColor: 'rgba(6, 182, 212, 0.2)', // Primary with transparency
        pointBackgroundColor: '#06b6d4', // Primary
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#06b6d4',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  if (isLoading) {
    return <div className="h-72 md:h-96 flex justify-center items-center"><LoadingSpinner text="Cargando progreso..." /></div>;
  }

  if (error) {
    return <p className="h-72 md:h-96 text-center text-red-400 flex justify-center items-center">{error}</p>;
  }

  if (progressData.length === 0) {
    return (
        <div className="h-72 md:h-96 flex flex-col justify-center items-center text-center p-4">
            <h4 className="font-semibold text-lg text-[#06b6d4]">¡Empieza a Registrar!</h4>
            <p className="text-zinc-400 mt-2 text-sm">No se han encontrado registros con peso para este ejercicio.</p>
            <p className="text-zinc-500 mt-1 text-xs">Completa un entrenamiento para que tu progreso aparezca aquí.</p>
        </div>
    );
  }

  return (
    <div className="relative h-72 md:h-96">
      <Line options={chartOptions} data={chartData} />
    </div>
  );
};

export default ExerciseProgressChart;