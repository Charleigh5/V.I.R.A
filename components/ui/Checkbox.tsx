import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Checkbox: React.FC<CheckboxProps> = ({ label, ...props }) => {
  const id = React.useId();
  return (
    <div className="flex items-center">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-neutral-300 text-primary-blue focus:ring-primary-blue"
        {...props}
      />
      <label htmlFor={id} className="ml-3 block text-sm text-neutral-700">
        {label}
      </label>
    </div>
  );
};

export default Checkbox;
