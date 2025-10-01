import React, { useState, useCallback } from 'react';
import { Project, ProjectImage, RawImageAnalysis, SynthesizedProjectData, TaskStatus, TaskPriority, FileProcessingStatus } from './types';
import Dashboard from './components/Dashboard';
import ProjectWorkspace from './components/ProjectWorkspace';
import ImageReviewModal from './components/ImageReviewModal';
import CommandBar from './components/CommandBar';
import { GeminiApiError, analyzeSalesforceFile, analyzeEmailConversation, analyzeImage } from './services/geminiService';
import { resizeAndCompressImage } from './utils/imageUtils';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import { projectTemplates, ProjectTemplate } from './services/templates';
import { 
    isSalesforceFile, 
    isEmailFile,
    isImageFile,
    MAX_SALESFORCE_FILE_SIZE_BYTES, 
    MAX_SALESFORCE_FILE_SIZE_MB, 
    MAX_EMAIL_FILE_SIZE_BYTES, 
    MAX_EMAIL_FILE_SIZE_MB
} from './utils/validation';


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
  const [fileProcessingStatus, setFileProcessingStatus] = useState<Record<string, { status: FileProcessingStatus, error?: string }>>({});


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
    
    const rawImageAnalyses = image_reports?.map((report) => ({
        ...report,
        base64Data: URL.createObjectURL(imageFiles.find(f => f.name === report.fileName)!)
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

  const handleCreateProject = async (salesforceFile: File, emailFile: File, supportingImages: File[]) => {
      addMessageToHistory({ sender: 'system', text: `Starting analysis of ${1 + 1 + supportingImages.length} files...` });
      setIsProcessing(true);

      const allFilesForStatus = [salesforceFile, emailFile, ...supportingImages];
      const initialStatuses = allFilesForStatus.reduce((acc, file) => {
          acc[file.name] = { status: 'processing' };
          return acc;
      }, {} as Record<string, { status: FileProcessingStatus; error?: string | undefined; }>);
      setFileProcessingStatus(initialStatuses);
      
      try {
          const salesforcePromise = analyzeSalesforceFile(salesforceFile).then(result => {
              setFileProcessingStatus(prev => ({ ...prev, [salesforceFile.name]: { status: 'success' } }));
              return result;
          }).catch(e => {
              setFileProcessingStatus(prev => ({ ...prev, [salesforceFile.name]: { status: 'error', error: e.message } }));
              throw e;
          });

          const emailPromise = analyzeEmailConversation(emailFile).then(result => {
              setFileProcessingStatus(prev => ({ ...prev, [emailFile.name]: { status: 'success' } }));
              return result;
          }).catch(e => {
              setFileProcessingStatus(prev => ({ ...prev, [emailFile.name]: { status: 'error', error: e.message } }));
              throw e;
          });

          const imageProcessingPromises = supportingImages.map(async (img) => {
              const processedImage = await resizeAndCompressImage(img);
              return analyzeImage(processedImage).then(result => {
                  setFileProcessingStatus(prev => ({ ...prev, [img.name]: { status: 'success' } }));
                  return { originalFile: img, report: result };
              }).catch(e => {
                  setFileProcessingStatus(prev => ({ ...prev, [img.name]: { status: 'error', error: e.message } }));
                  throw e;
              });
          });
          
          const [salesforceData, emailData, ...imageResults] = await Promise.all([
              salesforcePromise,
              emailPromise,
              ...imageProcessingPromises
          ]);

          const synthesizedData: SynthesizedProjectData = {
              ...salesforceData,
              ...emailData,
              image_reports: imageResults.map(r => r.report),
          };
          
          const sourceFiles = {
              salesforceFileNames: [salesforceFile.name],
              emailFileNames: [emailFile.name],
          };
          
          const isEmailTextBased = /\.(txt|eml|csv|md|html|json)$/i.test(emailFile.name);
          let rawEmailContentForUi = `Content from file "${emailFile.name}" was used for analysis. Preview is not available for this file type.`;
          let rawSalesforceContentForUi = `Content from file "${salesforceFile.name}" was used for analysis. Preview is not available for this file type.`;

          if (salesforceFile.name.endsWith('.md')) {
              rawSalesforceContentForUi = await fileReader(salesforceFile);
          }

          if (isEmailTextBased) {
              try {
                  let emailText = await fileReader(emailFile);
                  if (emailFile.name.toLowerCase().endsWith('.csv')) {
                      rawEmailContentForUi = parseAndFormatCsv(emailText);
                  } else {
                      rawEmailContentForUi = emailText;
                  }
              } catch (readError) {
                  console.error("Failed to read text-based email file for UI preview:", readError);
                  rawEmailContentForUi = `Could not read content from file "${emailFile.name}" for preview.`;
              }
          }
          
          // Pass original image files for object URL creation
          const originalImageFiles = imageResults.map(r => r.originalFile);
          handleAnalysisComplete(synthesizedData, originalImageFiles, sourceFiles, rawSalesforceContentForUi, rawEmailContentForUi);

      } catch (err) {
          const errorText = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
          addMessageToHistory({ sender: 'system', text: `Project creation failed. One or more files could not be processed. Please review the errors and try again.` });
          console.error("Parallel analysis failed:", err);
      } finally {
          setIsProcessing(false);
          // Optionally clear statuses after a delay
          setTimeout(() => setFileProcessingStatus({}), 5000);
      }
  };

  const handleCommandSubmit = async (text: string, files: File[]) => {
      addMessageToHistory({ sender: 'user', text: text || `Uploading ${files.length} file(s)...`});

      // Prioritize .md for salesforce, then look for other valid types.
      const salesforceFile = files.find(f => f.name.endsWith('.md')) || files.find(isSalesforceFile);
      // Find an email file that isn't the one we picked for Salesforce.
      const emailFile = files.find(f => f !== salesforceFile && isEmailFile(f));

      if (!salesforceFile || !emailFile) {
          addMessageToHistory({ sender: 'system', text: "Project creation requires one Salesforce file (.md or image) and one supported email/conversation file. Please provide both."});
          return;
      }
      
      const sourceContentFiles = [salesforceFile, emailFile];
      for (const file of sourceContentFiles) {
          const isSf = file === salesforceFile;
          const sizeLimit = isSf ? MAX_SALESFORCE_FILE_SIZE_BYTES : MAX_EMAIL_FILE_SIZE_BYTES;
          const sizeLimitMb = isSf ? MAX_SALESFORCE_FILE_SIZE_MB : MAX_EMAIL_FILE_SIZE_MB;
          if (file.size > sizeLimit) {
              addMessageToHistory({ sender: 'system', text: `File Processing Error: File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). The limit for this file type is ${sizeLimitMb}MB.` });
              return;
          }
      }
      const supportingImages = files.filter(f => f !== salesforceFile && f !== emailFile && isImageFile(f));
      
      handleCreateProject(salesforceFile, emailFile, supportingImages);
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
                    onCreateProject={handleCreateProject}
                    onOpenTemplateModal={() => setTemplateModalOpen(true)}
                    fileStatuses={fileProcessingStatus}
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