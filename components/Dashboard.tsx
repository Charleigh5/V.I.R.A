import React, { useState } from 'react';
import { Project, FileProcessingStatus } from '../types';
import ProjectCard from './ProjectCard';
import ChatHistory, { ChatMessage } from './ChatHistory';
import Button from './ui/Button';
import FileImporter from './ui/FileImporter';
import {
  MAX_SALESFORCE_FILE_SIZE_MB,
  MAX_EMAIL_FILE_SIZE_MB,
  MAX_IMAGE_FILE_SIZE_MB,
  MAX_SALESFORCE_FILE_SIZE_BYTES,
  MAX_EMAIL_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_IMAGE_FILES,
  isSalesforceFile,
  isEmailFile,
  isImageFile
} from '../utils/validation';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  chatHistory: ChatMessage[];
  isProcessing: boolean;
  onCreateProject: (salesforceFile: File, emailFile: File, imageFiles: File[]) => void;
  onOpenTemplateModal: () => void;
  fileStatuses: Record<string, { status: FileProcessingStatus, error?: string }>;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, chatHistory, isProcessing, onCreateProject, onOpenTemplateModal, fileStatuses }) => {
  const [salesforceFile, setSalesforceFile] = useState<File | null>(null);
  const [emailFile, setEmailFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearError = () => {
      if (uploadError) setUploadError(null);
  }

  const handleFileSelect = (
    selectedFiles: File[],
    setFile: (file: File | null) => void,
    validator: (file: File) => boolean,
    maxSize: number,
    maxSizeMb: number,
    fileTypeName: string
  ) => {
    clearError();
    if (selectedFiles.length === 0) return;
    const file = selectedFiles[0];
    
    if (!validator(file)) {
      setUploadError(`Invalid file type for ${fileTypeName}. Please upload a supported file.`);
      return;
    }

    if (file.size > maxSize) {
        setUploadError(`File "${file.name}" is too large. Max size is ${maxSizeMb}MB.`);
        return;
    }
    
    setFile(file);
  };
  
  const handleImageSelect = (selectedFiles: File[]) => {
      clearError();
      const newFiles = selectedFiles;
      const errors: string[] = [];
      const filesToAdd: File[] = [];

      if (imageFiles.length + newFiles.length > MAX_IMAGE_FILES) {
          errors.push(`You can upload a maximum of ${MAX_IMAGE_FILES} images.`);
      } else {
          for (const file of newFiles) {
              if (!isImageFile(file)) {
                  errors.push(`"${file.name}" is not a valid image file.`);
                  continue;
              }
              if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
                  errors.push(`Image "${file.name}" is too large (max ${MAX_IMAGE_FILE_SIZE_MB}MB).`);
                  continue;
              }
              if (imageFiles.some(f => f.name === file.name)) {
                  // Skip duplicates without erroring
                  continue;
              }
              filesToAdd.push(file);
          }
      }

      if (errors.length > 0) {
          setUploadError(errors.join('\n'));
          return;
      }
      setImageFiles(prev => [...prev, ...filesToAdd]);
  };
  
  const handleRemoveImage = (fileName: string) => {
      setImageFiles(prev => prev.filter(f => f.name !== fileName));
  };
  
  const handleStartProjectCreation = () => {
      if (!salesforceFile || !emailFile) {
          setUploadError("Both a Salesforce file and an Email file are required to create a project.");
          return;
      }
      
      onCreateProject(salesforceFile, emailFile, imageFiles);
  };

  return (
    <div className="flex-grow flex flex-col p-8 pb-32">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-neutral-900">Project Dashboard</h1>
            <Button onClick={onOpenTemplateModal}>Create from Template</Button>
        </div>
        
        {/* New Project Creation UI */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-neutral-200 mb-8">
            <h2 className="text-xl font-semibold text-neutral-800 mb-1">Create New Project</h2>
            <p className="text-sm text-neutral-500 mb-6">Upload the required source files to begin the AI analysis.</p>

            {uploadError && (
                <div className="bg-red-50 border border-accent-red text-accent-red text-sm px-4 py-3 rounded-lg mb-4 whitespace-pre-wrap">
                    {uploadError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <FileImporter
                    title="Salesforce Data"
                    description="Upload .md, .jpg, .png, etc."
                    acceptedFileTypes=".md,image/*,.tiff"
                    files={salesforceFile ? [salesforceFile] : []}
                    onFilesSelected={(files) => handleFileSelect(files, setSalesforceFile, isSalesforceFile, MAX_SALESFORCE_FILE_SIZE_BYTES, MAX_SALESFORCE_FILE_SIZE_MB, 'Salesforce')}
                    onFileRemove={() => setSalesforceFile(null)}
                    fileStatuses={fileStatuses}
                />
                 <FileImporter
                    title="Email Conversation"
                    description="Upload docs, images, etc."
                    acceptedFileTypes=".pdf,.txt,.md,.csv,.xls,.html,.doc,.ppt,.json,.eml,image/*,.tiff"
                    files={emailFile ? [emailFile] : []}
                    onFilesSelected={(files) => handleFileSelect(files, setEmailFile, isEmailFile, MAX_EMAIL_FILE_SIZE_BYTES, MAX_EMAIL_FILE_SIZE_MB, 'Email')}
                    onFileRemove={() => setEmailFile(null)}
                    fileStatuses={fileStatuses}
                />
            </div>

            <FileImporter
                title="Supporting Images (Optional)"
                description={`Drag & drop or click to upload (up to ${MAX_IMAGE_FILES} images)`}
                acceptedFileTypes="image/*"
                files={imageFiles}
                onFilesSelected={handleImageSelect}
                onFileRemove={handleRemoveImage}
                isMultiple
                iconType="image"
                fileStatuses={fileStatuses}
            />
            
            <div className="mt-6 text-right">
                <Button
                    onClick={handleStartProjectCreation}
                    isLoading={isProcessing}
                    disabled={!salesforceFile || !emailFile || isProcessing}
                >
                    Create Project
                </Button>
            </div>
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
