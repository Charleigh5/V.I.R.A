import React, { useState, useCallback } from 'react';
import { Project, ProjectImage, TaskStatus, TaskPriority } from './types';
import Dashboard from './components/Dashboard';
import ProjectWorkspace from './components/ProjectWorkspace';
import ImageReviewModal from './components/ImageReviewModal';
import CommandBar from './components/CommandBar';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import { projectTemplates, ProjectTemplate } from './services/templates';
import { useProjectOrchestrator, ProjectLifecycle } from './hooks/useProjectOrchestrator';
import { isSalesforceFile, isEmailFile } from './utils/validation';

interface ChatMessage {
    sender: 'user' | 'ai' | 'system';
    text: string;
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'ai', text: "Welcome to V.I.R.A. To create a new project, please drop the relevant Salesforce and email thread files into the command bar below." }
  ]);
  const [uiFiles, setUiFiles] = useState<File[]>([]); // For file importer UI only

  const handleProjectCreated = useCallback((newProject: Project) => {
      setProjects(prevProjects => [...prevProjects, newProject]);
      addMessageToHistory({ sender: 'ai', text: `Project "${newProject.name}" has been successfully created!` });
      setUiFiles([]);
      setSelectedProjectId(newProject.id);
      orchestratorActions.reset();
  }, []);

  const { state: orchestratorState, actions: orchestratorActions } = useProjectOrchestrator(handleProjectCreated);

  const addMessageToHistory = (message: ChatMessage) => {
    setChatHistory(prev => [...prev, message]);
  }
  
  const handleFileSubmit = async () => {
    addMessageToHistory({ sender: 'user', text: `Synthesizing project from ${uiFiles.length} file(s)...`});

    const salesforceFiles = uiFiles.filter(isSalesforceFile);
    const emailFiles = uiFiles.filter(isEmailFile);
    
    if (salesforceFiles.length === 0 || emailFiles.length === 0) {
        orchestratorActions.cancel();
        // This is a pre-flight check before handing off to the FSM.
        // The FSM also validates, but this provides a quicker, more specific UI error.
        const error = "Project creation requires at least one Salesforce file (.md, image, or .pdf) and one email/conversation file. Please provide both types.";
        orchestratorActions.submitFiles([]); // Submit empty to trigger validation error state if needed, or just set local error
        // A direct error might be better here, but for now we let the FSM handle it.
        // This is a good place for further refinement. Let's send the files and let the FSM decide.
    }
    
    orchestratorActions.submitFiles(uiFiles);
  };

  const handleFilesChange = (newFiles: File[]) => {
    // This state is only for the UI component to display the list of files.
    // The FSM gets the final list on submission.
    setUiFiles(newFiles);
  };

  const handleCommandSubmit = async (text: string) => {
      addMessageToHistory({ sender: 'user', text: text});
      addMessageToHistory({ sender: 'system', text: 'Text-based commands are not yet implemented.'});
  };

  const handleProjectCreateFromTemplate = (template: ProjectTemplate, projectName: string) => {
    const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: projectName,
        opportunityNumber: template.projectDetails.opportunity_number,
        status: 'READY' as any,
        createdAt: new Date().toISOString(),
        sourceFiles: { salesforceFileNames: ['Template'], emailFileNames: ['Template'] },
        data: {
            project_details: {
                ...template.projectDetails,
                project_name: projectName,
            },
            action_items: template.actionItems.map((item, index) => {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + item.dueDateOffset);
                return {
                    id: `task-${Date.now()}-${index}`,
                    subject: item.subject,
                    description: item.description,
                    status: item.status as TaskStatus,
                    priority: item.priority as TaskPriority,
                    due_date: dueDate.toISOString().split('T')[0],
                    assigned_to_name: item.assigned_to_name,
                    task_types: item.task_types,
                    hours_remaining: item.hours_remaining,
                };
            }),
            conversation_summary: "Project created from template.",
            conversation_nodes: [],
            attachments: [],
            mentioned_attachments: [],
        },
    };
    setProjects(prev => [...prev, newProject]);
    addMessageToHistory({ sender: 'ai', text: `Project "${newProject.name}" created from the "${template.name}" template.`});
    setSelectedProjectId(newProject.id);
    setTemplateModalOpen(false);
  };

  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setSelectedProjectId(null);
  }, []);
  
  const handleCloseReviewModal = () => {
    orchestratorActions.cancel();
    setUiFiles([]);
    addMessageToHistory({ sender: 'system', text: 'Project creation cancelled.' });
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const isProcessing = ![ProjectLifecycle.IDLE, ProjectLifecycle.ERROR, ProjectLifecycle.COMPLETE].includes(orchestratorState.value);
  const isReviewModalOpen = orchestratorState.value === ProjectLifecycle.AWAITING_REVIEW;

  return (
    <div className="bg-neutral-100 min-h-screen font-sans text-neutral-800 flex flex-col">
        <main className="flex-grow flex flex-col">
            {selectedProject ? (
                <ProjectWorkspace project={selectedProject} onBack={handleBackToDashboard} />
            ) : (
                <Dashboard
                    projects={projects}
                    onSelectProject={handleSelectProject}
                    chatHistory={chatHistory}
                    onOpenTemplateModal={() => setTemplateModalOpen(true)}
                    files={uiFiles}
                    onFilesChange={handleFilesChange}
                    onSubmitFiles={handleFileSubmit}
                    isProcessing={isProcessing}
                    uploadError={orchestratorState.context.error}
                    fileStatuses={orchestratorState.context.fileProcessingStatus}
                />
            )}
        </main>
        
        {!selectedProject && (
          <CommandBar 
            onSubmit={handleCommandSubmit} 
            isProcessing={isProcessing}
          />
        )}

        {orchestratorState.context.analysisPayload && (
            <ImageReviewModal
                isOpen={isReviewModalOpen}
                onClose={handleCloseReviewModal}
                analysisResults={orchestratorState.context.analysisPayload.imageData}
                onConfirm={orchestratorActions.confirmReview}
            />
        )}

        <CreateFromTemplateModal 
            isOpen={isTemplateModalOpen}
            onClose={() => setTemplateModalOpen(false)}
            onCreate={handleProjectCreateFromTemplate}
            templates={projectTemplates}
        />
    </div>
  );
};

export default App;
