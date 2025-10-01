import React from 'react';

// Extend CardProps to include standard HTML attributes for a div element, allowing props like `onClick`.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    // Pass down any additional props (like onClick) to the underlying div.
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;