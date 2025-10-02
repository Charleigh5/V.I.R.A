
import React from 'react';

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const Panel: React.FC<PanelProps> = ({ title, children, className, noPadding = false }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md flex flex-col overflow-hidden ${className}`}>
      <div className="p-4 border-b border-neutral-200 flex-shrink-0">
        <h3 className="text-lg font-semibold text-neutral-800">{title}</h3>
      </div>
      <div className={`flex-1 overflow-y-auto ${noPadding ? '' : 'p-6'}`}>
        {children}
      </div>
    </div>
  );
};

export default Panel;
