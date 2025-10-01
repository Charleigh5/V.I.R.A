import React from 'react';

interface SalesforceDataViewProps {
  markdownContent: string;
}

const SalesforceDataView: React.FC<SalesforceDataViewProps> = ({ markdownContent }) => {
  const parsedData = markdownContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.includes(':'))
    .map(line => {
      // Handle markdown bolding for keys
      const parts = line.replace(/\*\*/g, '').split(':');
      const key = parts[0].trim();
      const value = parts.slice(1).join(':').trim();
      return { key, value };
    });

  const highlightedKeys = ['Opportunity Revenue', 'Opp Revenue', 'Amount', 'Total Opportunity Amount'];

  return (
    <div className="h-full overflow-y-auto bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {parsedData.map(({ key, value }, index) => (
                <div key={index} className="border-b border-neutral-200 pb-2">
                    <p className="text-sm font-medium text-neutral-500">{key}</p>
                    <p className={`text-base text-neutral-800 ${highlightedKeys.some(h => key.toLowerCase().includes(h.toLowerCase())) ? 'font-bold text-accent-green' : ''}`}>
                        {value || 'N/A'}
                    </p>
                </div>
            ))}
        </div>
    </div>
  );
};

export default SalesforceDataView;