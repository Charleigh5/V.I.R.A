import React, { useState, useCallback } from 'react';
import { Project, ProjectImage, RawImageAnalysis, SynthesizedProjectData, TaskStatus, TaskPriority } from './types';
import Dashboard from './components/Dashboard';
import ProjectWorkspace from './components/ProjectWorkspace';
import ImageReviewModal from './components/ImageReviewModal';
import CommandBar from './components/CommandBar';
import { GeminiApiError, analyzeProjectFiles } from './services/geminiService';
import { resizeAndCompressImage } from './utils/imageUtils';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import { projectTemplates, ProjectTemplate } from './services/templates';
import { MAX_TEXT_FILE_SIZE_BYTES, MAX_TEXT_FILE_SIZE_MB, MAX_CSV_FILE_SIZE_BYTES, MAX_CSV_FILE_SIZE_MB } from './utils/validation';


interface ChatMessage {
    sender: 'user' | 'ai' | 'system';
    text: string;
}

// Utilities moved from deleted CreateProjectModal
const fileReader = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file "${file.name}". It may be corrupted or inaccessible.`));
    reader.readAsText(file);
  });
};

const parseAndFormatCsv = (csvText: string): string => {
    const parseCsv = (text: string): { data: { [key: string]: string }[], error?: string } => {
        const lines = [];
        let currentLine = '';
        let inQuotes = false;
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                if (inQuotes && text[i + 1] === '"') {
                    currentLine += '"';
                    i++;
                    continue;
                }
                inQuotes = !inQuotes;
            }
            if (char === '\n' && !inQuotes) {
                lines.push(currentLine);
                currentLine = '';
            } else {
                currentLine += char;
            }
        }
        lines.push(currentLine);

        const parseCsvRow = (row: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuote = false;
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') {
                    if (inQuote && row[i+1] === '"') { 
                        current += '"';
                        i++;
                    } else {
                        inQuote = !inQuote;
                    }
                } else if (char === ',' && !inQuote) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result.map(val => val.trim());
        };
        
        const nonEmptyRows = lines.filter(line => line.trim() !== '');
        if (nonEmptyRows.length < 2) return { data: [], error: "Invalid CSV: File must contain a header row and at least one data row." };

        const headers = parseCsvRow(nonEmptyRows[0]).map(h => h.replace(/^"|"$/g, '').trim());
        const dataRows = nonEmptyRows.slice(1);
        const jsonData = [];

        for (let i = 0; i < dataRows.length; i++) {
            const rowValues = parseCsvRow(dataRows[i]);
            if (rowValues.length !== headers.length) return { data: [], error: `CSV Parse Error: Row ${i + 2} has ${rowValues.length} columns, but the header has ${headers.length}.` };
            const entry: { [key: string]: string } = {};
            headers.forEach((header, index) => {
                entry[header] = rowValues[index]?.replace(/^"|"$/g, '').trim() || '';
            });
            jsonData.push(entry);
        }
        return { data: jsonData };
    };

    const result = parseCsv(csvText);
    if (result.error) throw new Error(result.error);
    const emailData = result.data;

    const requiredColumns = ['from', 'to', 'subject', 'body', 'timestamp'];
    if (emailData.length > 0 && !requiredColumns.every(col => Object.keys(emailData[0]).includes(col))) {
        throw new Error("Invalid CSV format: Must contain 'from', 'to', 'subject', 'body', 'timestamp' columns.");
    }
    
    let formattedText = "--- Email Conversation from CSV ---\n";
    emailData.forEach(email => {
        if (Object.values(email).some(v => v && v.trim() !== '')) {
            formattedText += `From: ${email.from || 'N/A'}\nTo: ${email.to || 'N/A'}\nDate: ${email.timestamp || 'N/A'}\nSubject: ${email.subject || 'N/A'}\n\n${email.body || ''}\n---\n`;
        }
    });
    return formattedText;
};


const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
   const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'ai', text: "Welcome to the Project Dashboard. To create a new project, please describe your project and drop the relevant Salesforce (.md) and email thread (.txt, .eml, .csv) files into the command bar below." }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<{
    textData: Omit<SynthesizedProjectData, 'image_reports'>,
    imageData: RawImageAnalysis[],
    sourceFiles: { salesforceFileNames: string[], emailFileNames:string[] },
    rawSalesforceContent: string,
    rawEmailContent: string,
  } | null>(null);

  const addMessageToHistory = (message: ChatMessage) => {
    setChatHistory(prev => [...prev, message]);
  }

  const handleAnalysisComplete = useCallback((
    synthesizedData: SynthesizedProjectData,
    imageFiles: File[],
    sourceFiles: { salesforceFileNames: string[], emailFileNames: string[] },
    rawSalesforceContent: string,
    rawEmailContent: string
  ) => {
    const { image_reports, ...textData } = synthesizedData;
    
    const rawImageAnalyses = image_reports?.map((report, index) => ({
        ...report,
        base64Data: URL.createObjectURL(imageFiles.find(f => f.name === report.fileName) || imageFiles[index])
    })) || [];

    setAnalysisResult({ textData, imageData: rawImageAnalyses, sourceFiles, rawSalesforceContent, rawEmailContent });
    
    if (rawImageAnalyses.length > 0) {
        addMessageToHistory({ sender: 'ai', text: 'Analysis complete. Please review the extracted image details before finalizing the project.' });
        setReviewModalOpen(true);
    } else {
        // If no images, create project directly
        handleProjectCreate([]);
    }
  }, []);

  const handleCommandSubmit = async (text: string, files: File[]) => {
      addMessageToHistory({ sender: 'user', text: text || `Uploading ${files.length} file(s)...`});
      setIsProcessing(true);

      const mdFile = files.find(f => f.name.endsWith('.md'));
      const textEmailFile = files.find(f => /\.(txt|eml|csv)$/i.test(f.name));

      if (!mdFile || !textEmailFile) {
          addMessageToHistory({ sender: 'system', text: "Project creation requires one Salesforce .md file and one email thread file (.txt, .eml, or .csv). Please provide both."});
          setIsProcessing(false);
          return;
      }
      
      const textFiles = files.filter(f => /\.(md|txt|eml|csv)$/i.test(f.name));
      for (const file of textFiles) {
          const isCsv = file.name.toLowerCase().endsWith('.csv');
          const sizeLimit = isCsv ? MAX_CSV_FILE_SIZE_BYTES : MAX_TEXT_FILE_SIZE_BYTES;
          const sizeLimitMb = isCsv ? MAX_CSV_FILE_SIZE_MB : MAX_TEXT_FILE_SIZE_MB;
          if (file.size > sizeLimit) {
              addMessageToHistory({ sender: 'system', text: `File Processing Error: File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). The limit for this file type is ${sizeLimitMb}MB.` });
              setIsProcessing(false);
              return;
          }
      }

      try {
          addMessageToHistory({ sender: 'system', text: "Reading and processing files..." });
          const salesforceContent = await fileReader(mdFile);
          let emailContent = await fileReader(textEmailFile);

          if (textEmailFile.name.endsWith('.csv')) {
              addMessageToHistory({ sender: 'system', text: `Parsing large CSV file "${textEmailFile.name}". The interface may be unresponsive for a moment...` });
              // Allow the message to render before blocking the main thread with a large parse.
              await new Promise(resolve => setTimeout(resolve, 50));
              emailContent = parseAndFormatCsv(emailContent);
          }

          const allImages = files.filter(f => f.type.startsWith('image/'));
          const processedImages: File[] = [];
          for (const imageFile of allImages) {
              const processedImage = await resizeAndCompressImage(imageFile);
              processedImages.push(processedImage);
          }

          addMessageToHistory({ sender: 'system', text: "Sending data for AI analysis. This may take a moment..." });
          const synthesizedData = await analyzeProjectFiles(salesforceContent, emailContent, processedImages);
          
          const sourceFiles = {
              salesforceFileNames: [mdFile.name],
              emailFileNames: [textEmailFile.name, ...allImages.map(f => f.name)],
          };

          handleAnalysisComplete(synthesizedData, processedImages, sourceFiles, salesforceContent, emailContent);

      } catch (err) {
          let errorText = "An unexpected error occurred.";
          if (err instanceof GeminiApiError) {
              errorText = `AI Analysis Error: ${err.message}`;
          } else if (err instanceof Error) {
              errorText = `File Processing Error: ${err.message}`;
          }
          addMessageToHistory({ sender: 'system', text: errorText });
      } finally {
          setIsProcessing(false);
      }
  };


  const handleProjectCreate = useCallback((finalImages: ProjectImage[]) => {
    if (!analysisResult) return;

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: analysisResult.textData.project_details.project_name || `Project ${Date.now()}`,
      opportunityNumber: analysisResult.textData.project_details.opportunity_number || 'N/A',
      status: 'READY' as any,
      data: analysisResult.textData,
      images: finalImages,
      createdAt: new Date().toISOString(),
      sourceFiles: analysisResult.sourceFiles,
      rawSalesforceContent: analysisResult.rawSalesforceContent,
      rawEmailContent: analysisResult.rawEmailContent,
    };

    setProjects(prevProjects => [...prevProjects, newProject]);
    addMessageToHistory({ sender: 'ai', text: `Project "${newProject.name}" has been successfully created!` });
    setReviewModalOpen(false);
    setAnalysisResult(null);
    setSelectedProjectId(newProject.id);
  }, [analysisResult]);


  const handleCreateProjectFromTemplate = (template: ProjectTemplate, projectName: string) => {
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
    setReviewModalOpen(false);
    setAnalysisResult(null);
    addMessageToHistory({ sender: 'system', text: 'Project creation cancelled.' });
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

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
                    isProcessing={isProcessing}
                    onFileDrop={handleCommandSubmit}
                    onOpenTemplateModal={() => setTemplateModalOpen(true)}
                />
            )}
        </main>
        
        {!selectedProject && (
          <CommandBar onSubmit={handleCommandSubmit} isProcessing={isProcessing} />
        )}

        {analysisResult && (
            <ImageReviewModal
                isOpen={isReviewModalOpen}
                onClose={handleCloseReviewModal}
                analysisResults={analysisResult.imageData}
                onConfirm={handleProjectCreate}
            />
        )}

        <CreateFromTemplateModal 
            isOpen={isTemplateModalOpen}
            onClose={() => setTemplateModalOpen(false)}
            onCreate={handleCreateProjectFromTemplate}
            templates={projectTemplates}
        />
    </div>
  );
};

export default App;