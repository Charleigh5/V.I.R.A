import React, { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false, className }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`bg-white rounded-lg shadow-md border border-neutral-200 overflow-hidden ${className}`}>
      <div
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-')}`}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleOpen(); }}
      >
        <h2 className="text-xl font-bold text-neutral-800">{title}</h2>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 text-neutral-500 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div
        id={`collapsible-content-${title.replace(/\s+/g, '-')}`}
        className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
        style={{ overflow: 'hidden' }}
      >
        <div className="p-6 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
