import React, { useState, useCallback, useRef, useMemo } from 'react';
import Button from './ui/Button';

interface CommandBarProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

const CommandBar: React.FC<CommandBarProps> = ({ onSubmit, isProcessing }) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (isProcessing || text.trim().length === 0) return;
    onSubmit(text);
    setText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };


  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-10">
      <div className="relative rounded-lg transition-all">
        <div 
            className="bg-neutral-100 p-2 rounded-lg"
        >
            <div className="flex gap-2 mb-2">
                <Button variant="secondary" className="text-xs px-2 py-1">Enhance assignee lookup</Button>
                <Button variant="secondary" className="text-xs px-2 py-1">Filter action items</Button>
                <Button variant="secondary" className="text-xs px-2 py-1">Add task type filter</Button>
                <div className="flex-grow"></div>
                <Button variant="secondary" className="text-xs px-2 py-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8v0a8 8 0 018 8v0a8 8 0 01-8 8v0a8 8 0 01-8-8v0z" /></svg>
                    Restore checkpoint
                </Button>
            </div>
            
            <div className="relative flex items-center">
                <button className="p-2 text-neutral-500 hover:text-primary-blue" aria-label="Use Microphone">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Make changes, add new features, ask for anything..."
                    className="flex-grow bg-transparent focus:outline-none resize-none text-sm p-2"
                    rows={1}
                    disabled={isProcessing}
                />
                <button onClick={handleSubmit} disabled={isProcessing || text.trim().length === 0} className="p-2 text-neutral-500 hover:text-primary-blue disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Send message">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                </button>
            </div>
        </div>
      </div>
    </footer>
  );
};

export default CommandBar;