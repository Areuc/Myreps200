
import React, { useEffect, useState } from 'react';
import { Toast as ToastProps } from '../types';
import { useToast } from '../hooks/useToast';

interface ToastComponentProps {
  toast: ToastProps;
  onRemove: (id: string) => void;
}

const ICONS = {
  success: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const BACKGROUND_COLORS = {
  success: 'bg-[#22d916]/80 backdrop-blur-sm border-[#22d916]',
  error: 'bg-red-500/80 backdrop-blur-sm border-red-500',
  warning: 'bg-[#fb923c]/80 backdrop-blur-sm border-[#fb923c]',
  info: 'bg-[#06b6d4]/80 backdrop-blur-sm border-[#06b6d4]',
};

const ToastComponent: React.FC<ToastComponentProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 500); // Wait for exit animation
    }, 5000); // Auto-remove after 5 seconds

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 500);
  };
  
  const animationClass = isExiting ? 'animate-toast-out-right' : 'animate-toast-in-right';

  return (
    <div
      className={`max-w-sm w-full rounded-lg shadow-2xl p-4 flex items-start space-x-3 border ${BACKGROUND_COLORS[toast.type]} ${animationClass}`}
    >
      <div className="flex-shrink-0 text-white">{ICONS[toast.type]}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{toast.message}</p>
      </div>
      <div className="flex-shrink-0">
        <button
          onClick={handleClose}
          className="text-white/70 hover:text-white focus:outline-none"
          aria-label="Cerrar notificación"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ToastComponent;
