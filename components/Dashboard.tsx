import React, { useMemo } from 'react';
import { Project, FileProcessingStatus, TaskStatus } from '../types';
import ProjectCard from './ProjectCard';
import ChatHistory, { ChatMessage } from './ChatHistory';
import Button from './ui/Button';
import FileImporter from './ui/FileImporter';
import { isSalesforceFile, isEmailFile } from '../utils/validation';
import Card from './ui/Card';
import BarChart from './ui/BarChart';


interface DashboardProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  chatHistory: ChatMessage[];
  onOpenTemplateModal: () => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSubmitFiles: () => void;
  isProcessing: boolean;
  uploadError: string | null;
  fileStatuses: Record<string, { status: FileProcessingStatus; error?: string }>;
}

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.Open]: '#9E9E9E', // neutral-500
  [TaskStatus.InProcess]: '#F5A623', // accent-yellow
  [TaskStatus.TODO]: '#F5A623',
  [TaskStatus.IN_PROGRESS]: '#4A90E2', // primary-blue
  [TaskStatus.DONE]: '#7ED321', // accent-green
  [TaskStatus.BLOCKED]: '#D0021B', // accent-red
};

const Dashboard: React.FC<DashboardProps> = ({
  projects,
  onSelectProject,
  chatHistory,
  onOpenTemplateModal,
  files,
  onFilesChange,
  onSubmitFiles,
  isProcessing,
  uploadError,
  fileStatuses,
}) => {
  const hasSalesforceFile = useMemo(() => files.some(isSalesforceFile), [files]);
  const hasEmailFile = useMemo(() => files.some(isEmailFile), [files]);

  const taskStatusDistribution = useMemo(() => {
    const statusCounts = projects.reduce((acc, project) => {
        project.data?.action_items?.forEach(item => {
            // Group similar statuses for a cleaner chart
            let normalizedStatus: TaskStatus;
            switch(item.status) {
                case TaskStatus.InProcess:
                case TaskStatus.TODO:
                    normalizedStatus = TaskStatus.IN_PROGRESS;
                    break;
                default:
                    normalizedStatus = item.status;
            }
            acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
        });
        return acc;
    }, {} as Record<TaskStatus, number>);

    // Order statuses for consistent chart display
    const orderedStatuses = [
        TaskStatus.Open, 
        TaskStatus.IN_PROGRESS, 
        TaskStatus.BLOCKED, 
        TaskStatus.DONE
    ];

    return orderedStatuses
      .filter(status => statusCounts[status] > 0)
      .map(status => ({
        label: status.replace(/_/g, ' '), // Prettify label
        value: statusCounts[status],
        color: statusColors[status as TaskStatus] || '#E0E0E0',
    }));
  }, [projects]);


  const handleFileRemove = (fileName: string) => {
    onFilesChange(files.filter(f => f.name !== fileName));
  };
  
  return (
    <div className="flex-grow flex flex-col p-8 pb-32">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-neutral-900">Project Dashboard</h1>
            <Button onClick={onOpenTemplateModal}>Create from Template</Button>
        </div>
        
        {projects.length > 0 ? (
            <>
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-neutral-800 mb-4">Overall Task Status</h2>
                    <Card>
                        <div className="h-80">
                            {taskStatusDistribution.length > 0 ? (
                                <BarChart data={taskStatusDistribution} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-neutral-500">
                                    No action items found across projects.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-neutral-800 mb-4">Available Projects</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {projects.map((project) => (
                            <ProjectCard key={project.id} project={project} onSelect={onSelectProject} />
                        ))}
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-grow flex items-center justify-center -mt-16">
                 <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-neutral-200 w-full max-w-4xl">
                    <div className="inline-block p-4 bg-blue-50 rounded-full">
                        <svg xmlns="http://www.w.org/2000/svg" className="h-10 w-10 text-primary-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-neutral-800">Ready to Synthesize a New Project?</h2>
                     <div className="mt-8">
                        <FileImporter
                            files={files}
                            onFilesSelected={onFilesChange}
                            onFileRemove={handleFileRemove}
                            acceptedFileTypes=".md,.pdf,.txt,.csv,.xls,.html,.doc,.ppt,.json,.eml,image/*,.tiff"
                            isMultiple={true}
                            fileStatuses={fileStatuses}
                            title="Upload from device"
                            description="Drag & drop Salesforce data, email threads, and images here."
                        />
                    </div>
                    {uploadError && (
                        <div className="mt-4 text-sm text-accent-red whitespace-pre-wrap bg-red-50 p-3 rounded-md">
                            {uploadError}
                        </div>
                    )}
                    <div className="mt-6">
                        <Button
                            onClick={onSubmitFiles}
                            disabled={isProcessing || !hasSalesforceFile || !hasEmailFile}
                            isLoading={isProcessing}
                            className="px-8 py-3 text-base"
                        >
                            Synthesize Project
                        </Button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex-grow bg-white rounded-lg shadow-md p-4 flex flex-col min-h-[300px]">
            <h2 className="text-xl font-semibold text-neutral-800 mb-4 border-b pb-2">Conversation</h2>
            <ChatHistory messages={chatHistory} />
        </div>
    </div>
  );
};

export default Dashboard;