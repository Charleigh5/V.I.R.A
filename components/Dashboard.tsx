import React, { useState } from 'react';
import { Project } from '../types';
import ProjectCard from './ProjectCard';
import ChatHistory, { ChatMessage } from './ChatHistory';
import Button from './ui/Button';
import {
  MAX_TEXT_FILE_SIZE_MB,
  MAX_IMAGE_FILE_SIZE_MB,
  MAX_TEXT_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_CSV_FILE_SIZE_MB,
  MAX_CSV_FILE_SIZE_BYTES,
  isMdFile,
  isEmailFile,
  isImageFile
} from '../utils/validation';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  chatHistory: ChatMessage[];
  isProcessing: boolean;
  onFileDrop: (text: string, files: File[]) => void;
  onOpenTemplateModal: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, chatHistory, isProcessing, onFileDrop, onOpenTemplateModal }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const handleDragEvent = (e: React.DragEvent<HTMLDivElement>, type: 'enter' | 'leave' | 'over') => {
      e.preventDefault();
      e.stopPropagation();
      if (isProcessing) return;
      if (type === 'enter' || type === 'over') {
        // Clear previous errors when a new drag starts
        if (dropError) setDropError(null);
        setIsDragging(true);
      }
      else if (type === 'leave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      handleDragEvent(e, 'leave');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const droppedFiles = Array.from(e.dataTransfer.files);
          const errors: string[] = [];

          const mdFiles = droppedFiles.filter(isMdFile);
          const emailFiles = droppedFiles.filter(isEmailFile);
          
          if (mdFiles.length !== 1 || emailFiles.length !== 1) {
              errors.push("Please drop exactly one Salesforce (.md) file and one email thread (.txt, .eml, or .csv) file together.");
          }

          for (const file of droppedFiles) {
              if (isMdFile(file) || isEmailFile(file)) {
                  const isCsv = file.name.toLowerCase().endsWith('.csv');
                  const sizeLimit = isCsv ? MAX_CSV_FILE_SIZE_BYTES : MAX_TEXT_FILE_SIZE_BYTES;
                  const sizeLimitMb = isCsv ? MAX_CSV_FILE_SIZE_MB : MAX_TEXT_FILE_SIZE_MB;
                  if (file.size > sizeLimit) {
                      errors.push(`• File "${file.name}" is too large (max ${sizeLimitMb}MB).`);
                  }
              } else if (isImageFile(file)) {
                  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
                      errors.push(`• Image "${file.name}" is too large (max ${MAX_IMAGE_FILE_SIZE_MB}MB).`);
                  }
              } else {
                   errors.push(`• Unsupported file type: "${file.name}".`);
              }
          }
          
          if (errors.length > 0) {
              setDropError(`Upload Error:\n${errors.join('\n')}`);
              setTimeout(() => setDropError(null), 7000); // Error visible for 7 seconds
              return;
          }

          onFileDrop("Dropped files to create a project", droppedFiles);
      }
  };


  return (
    <div 
        className="flex-grow flex flex-col p-8 pb-32 relative"
        onDragEnter={(e) => handleDragEvent(e, 'enter')}
        onDragLeave={(e) => handleDragEvent(e, 'leave')}
        onDragOver={(e) => handleDragEvent(e, 'over')}
        onDrop={handleDrop}
    >
       {dropError && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-100 border border-accent-red text-accent-red px-4 py-3 rounded-lg shadow-lg z-30 animate-pulse">
            <p className="text-sm whitespace-pre-wrap">{dropError}</p>
          </div>
        )}
       {isDragging && !dropError && (
        <div className="absolute inset-0 bg-primary-blue bg-opacity-20 border-4 border-dashed border-primary-blue rounded-2xl flex items-center justify-center pointer-events-none z-20 m-8">
          <p className="text-primary-blue font-bold text-2xl">Drop files to create a project</p>
        </div>
      )}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">Project Dashboard</h1>
        <Button onClick={onOpenTemplateModal}>Create from Template</Button>
      </div>
      
      {projects.length > 0 && (
         <div className="mb-8">
            <h2 className="text-xl font-semibold text-neutral-800 mb-4">Available Projects</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} onSelect={onSelectProject} />
              ))}
            </div>
        </div>
      )}

      <div className="flex-grow bg-white rounded-lg shadow-md p-4 flex flex-col">
         <h2 className="text-xl font-semibold text-neutral-800 mb-4 border-b pb-2">Conversation</h2>
        <ChatHistory messages={chatHistory} />
      </div>
    </div>
  );
};

export default Dashboard;