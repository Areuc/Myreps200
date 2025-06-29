
import React, { useState } from 'react';
import { Exercise, ExerciseCardProps } from '../types'; // Ensure types are imported correctly

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, onAddToRoutine }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-zinc-800 rounded-lg shadow-xl overflow-hidden transform hover:scale-105 transition-transform duration-300 border border-zinc-700 flex flex-col">
      {exercise.gif_url ? (
        <img loading="lazy" src={exercise.gif_url} alt={`${exercise.nombre} GIF`} className="w-full h-48 object-contain bg-zinc-950"/>
      ) : exercise.image_url && (
        <img loading="lazy" src={exercise.image_url} alt={exercise.nombre} className="w-full h-48 object-contain bg-zinc-950"/>
      )}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-xl font-semibold text-[#06b6d4] mb-2">{exercise.nombre}</h3>
        <p className="text-sm text-zinc-400 mb-1"><span className="font-medium text-zinc-300">Grupo Muscular:</span> {exercise.grupo_muscular}</p>
        {exercise.equipo && <p className="text-sm text-zinc-400 mb-1"><span className="font-medium text-zinc-300">Equipamiento:</span> {exercise.equipo}</p>}
        {exercise.dificultad && <p className="text-sm text-zinc-400 mb-2"><span className="font-medium text-zinc-300">Dificultad:</span> {exercise.dificultad}</p>}
        <p className="text-sm text-zinc-400 mb-2"><span className="font-medium text-zinc-300">Core:</span> {exercise.es_core ? 'Sí' : 'No'}</p>
        
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="text-[#06b6d4] hover:text-[#0891b2] text-sm font-medium mb-2 text-left"
          aria-expanded={showDetails}
          aria-controls={`details-${exercise.id}`}
        >
          {showDetails ? 'Ocultar Detalles' : 'Mostrar Detalles'}
        </button>

        {showDetails && (
          <div id={`details-${exercise.id}`} className="mt-2 text-sm text-zinc-300">
            {exercise.descripcion && (
                <>
                <p className="font-semibold mb-1 text-white">Descripción:</p>
                <p className="mb-2">{exercise.descripcion}</p>
                </>
            )}
            {exercise.instructions && (
                <>
                <p className="font-semibold mb-1 text-white">Instrucciones:</p>
                <p>{exercise.instructions}</p>
                </>
            )}
            {exercise.video_url && (
                 <a href={exercise.video_url} target="_blank" rel="noopener noreferrer" className="text-[#06b6d4] hover:underline mt-2 inline-block">Ver Video Ejemplo</a>
            )}
            {exercise.musculos && <p className="text-sm text-zinc-400 mt-2"><span className="font-medium text-zinc-300">Músculos Detallados:</span> {exercise.musculos}</p>}
            {exercise.enfoques && exercise.enfoques.length > 0 && <p className="text-sm text-zinc-400 mt-2"><span className="font-medium text-zinc-300">Enfoques:</span> {exercise.enfoques.join(', ')}</p>}
          </div>
        )}
        
        <div className="mt-auto pt-4 space-y-2">
            {onAddToRoutine && (
              <button
                onClick={() => onAddToRoutine(exercise)}
                className="w-full bg-[#06b6d4] text-white py-2 px-4 rounded-md hover:bg-[#0891b2] transition-colors duration-300"
              >
                Añadir a Rutina
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseCard;
