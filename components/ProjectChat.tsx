import React, { useState, useRef, useEffect } from 'react';
import { Project, SynthesizedProjectData } from '../types';
import { chatWithProjectContext } from '../services/geminiService';
import Button from './ui/Button';

interface ChatMessage {
  sender: 'user' | 'ai' | 'system';
  text: string;
}

interface ProjectChatProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

const ProjectChat: React.FC<ProjectChatProps> = ({ project, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'ai', text: `Hi! I'm your AI assistant for "${project.name}". Ask me anything about this project.` }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = userInput.trim();
    if (!query || isLoading || !project.data) return;

    const newMessages: ChatMessage[] = [...messages, { sender: 'user', text: query }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await chatWithProjectContext(project.data, project.data.action_items, query);
      setMessages([...newMessages, { sender: 'ai', text: response }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sorry, I couldn't get a response.";
      setMessages([...newMessages, { sender: 'system', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getMessageStyle = (sender: ChatMessage['sender']) => {
    switch (sender) {
      case 'user': return 'bg-primary-blue text-white self-end';
      case 'ai': return 'bg-neutral-200 text-neutral-800 self-start';
      case 'system': return 'bg-red-100 text-accent-red text-sm self-center italic';
      default: return 'bg-gray-200 self-start';
    }
  };

  return (
    <>
      <div 
        className={`fixed top-0 right-0 h-full bg-black bg-opacity-50 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100 w-full' : 'opacity-0 w-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <header className="flex items-center justify-between p-4 border-b bg-neutral-800 text-white">
          <h2 className="text-lg font-semibold">Project AI Assistant</h2>
          <button onClick={onClose} className="text-neutral-300 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-grow overflow-y-auto p-4">
          <div className="flex flex-col space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`max-w-xs md:max-w-sm rounded-lg px-4 py-2 shadow-sm ${getMessageStyle(msg.sender)}`}>
                <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
              </div>
            ))}
             {isLoading && (
              <div className="self-start flex items-center space-x-2">
                <div className="h-2 w-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 bg-neutral-400 rounded-full animate-bounce"></div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t bg-neutral-100">
          <div className="relative">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask about this project..."
              className="w-full pl-3 pr-12 py-2 border border-neutral-300 rounded-full shadow-sm focus:ring-primary-blue focus:border-primary-blue"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim()}
              className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-10 text-primary-blue hover:text-blue-700 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ProjectChat;
