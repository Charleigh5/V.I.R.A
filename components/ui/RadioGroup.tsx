import React from 'react';

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
}

const RadioGroup: React.FC<RadioGroupProps> = ({ options, value, onChange }) => {
  const name = React.useId();
  return (
    <fieldset>
      <div className="space-y-4">
        {options.map((option) => (
          <label
            key={option.value}
            htmlFor={option.value}
            className={`relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-primary-blue focus-within:ring-offset-2 hover:bg-neutral-50 ${
              value === option.value ? 'border-primary-blue ring-2 ring-primary-blue' : 'border-neutral-300'
            }`}
          >
            <input
              type="radio"
              id={option.value}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
              aria-labelledby={`${option.value}-label`}
              aria-describedby={`${option.value}-description`}
            />
            <div className="flex flex-1">
              <div className="flex flex-col">
                <span id={`${option.value}-label`} className="block text-sm font-medium text-neutral-900">
                  {option.label}
                </span>
                {option.description && (
                  <span id={`${option.value}-description`} className="mt-1 flex items-center text-sm text-neutral-500">
                    {option.description}
                  </span>
                )}
              </div>
            </div>
            {value === option.value && (
                <svg className="h-5 w-5 text-primary-blue" xmlns="http://www.w.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default RadioGroup;
