


import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  textColor?: string; // Allow custom text color
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text, textColor = 'text-[#06b6d4]' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} border-[#06b6d4] border-t-transparent`}
      ></div>
      {text && <p className={`${textColor} font-medium`}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;