import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    onSelectProject: (projectId: string) => void;
    onOpenTemplateModal: () => void;
}

const ProjectIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
);

const ActionIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l.293.293a1 1 0 001.414-1.414l-3-3z" clipRule="evenodd" />
    </svg>
);

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, projects, onSelectProject, onOpenTemplateModal }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const actions = [
        {
            id: 'create-template',
            name: 'Create Project from Template',
            description: 'Start a new project using a predefined template.',
            icon: <ActionIcon className="h-5 w-5 text-neutral-500" />,
            execute: onOpenTemplateModal,
        },
    ];

    const filteredItems = [
        ...actions.filter(action => action.name.toLowerCase().includes(searchQuery.toLowerCase())),
        ...projects.filter(project => project.name.toLowerCase().includes(searchQuery.toLowerCase())),
    ];
    
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setActiveIndex(0);
            // Timeout to allow the modal to render before focusing
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % filteredItems.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = filteredItems[activeIndex];
                if (item) {
                    if ('execute' in item) { // It's an action
                        item.execute();
                    } else { // It's a project
                        onSelectProject(item.id);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, activeIndex, filteredItems, onSelectProject, onOpenTemplateModal, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start pt-20" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 transform transition-all" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                     <svg xmlns="http://www.w3.org/2000/svg" className="absolute top-3.5 left-4 h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        placeholder="Search projects or run commands..."
                        className="w-full bg-transparent p-3 pl-11 text-base text-neutral-800 focus:outline-none"
                    />
                </div>
                <div className="border-t border-neutral-200 max-h-96 overflow-y-auto">
                    {filteredItems.length > 0 ? (
                        <ul>
                           {filteredItems.map((item, index) => {
                                const isProject = 'opportunityNumber' in item;
                                return (
                                    <li
                                        key={item.id}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => isProject ? onSelectProject(item.id) : item.execute()}
                                        className={`flex items-center justify-between p-3 cursor-pointer ${activeIndex === index ? 'bg-primary-blue text-white' : 'text-neutral-700'}`}
                                    >
                                        <div className="flex items-center">
                                            <div className={`mr-3 ${activeIndex === index ? 'text-white' : ''}`}>
                                                {isProject ? <ProjectIcon className="h-5 w-5 text-neutral-500" /> : item.icon}
                                            </div>
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className={`text-sm ${activeIndex === index ? 'text-blue-200' : 'text-neutral-500'}`}>
                                                    {isProject ? `Opp. #${item.opportunityNumber}` : item.description}
                                                </p>
                                            </div>
                                        </div>
                                         <span className="text-xs">
                                            {isProject ? 'Project' : 'Command'}
                                        </span>
                                    </li>
                                );
                           })}
                        </ul>
                    ) : (
                        <p className="p-4 text-center text-neutral-500">No results found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;