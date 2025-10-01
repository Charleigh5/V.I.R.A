
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, color = 'gray', className }) => {
  const colorStyles = {
    blue: 'bg-blue-100 text-primary-blue',
    green: 'bg-green-100 text-accent-green',
    yellow: 'bg-yellow-100 text-accent-yellow',
    red: 'bg-red-100 text-accent-red',
    gray: 'bg-neutral-200 text-neutral-700',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorStyles[color]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
