import React, { useState, useCallback } from 'react';
import { Project, ProjectImage, RawImageAnalysis, SynthesizedProjectData, TaskStatus, TaskPriority, FileProcessingStatus, ProjectDetails, ActionItem, ConversationNode, Attachment, MentionedAttachment } from './types';
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
    MAX_EMAIL_FILE_SIZE_MB,
    MAX_SALESFORCE_FILES,
    MAX_EMAIL_FILES,
    MAX_IMAGE_FILES,
    MAX_IMAGE_FILE_SIZE_BYTES,
    MAX_IMAGE_FILE_SIZE_MB,
    MAX_TOTAL_FILES,
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
    { sender: 'ai', text: "Welcome to V.I.R.A. To create a new project, please drop the relevant Salesforce and email thread files into the command bar below." }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileProcessingStatus, setFileProcessingStatus] = useState<Record<string, { status: FileProcessingStatus, error?: string }>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);


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

  const handleCreateProject = async (salesforceFiles: File[], emailFiles: File[], imageFiles: File[]) => {
      const allUniqueFiles = [...new Set([...salesforceFiles, ...emailFiles, ...imageFiles])];
      addMessageToHistory({ sender: 'system', text: `Starting analysis of ${allUniqueFiles.length} files...` });
      setIsProcessing(true);

      const initialStatuses = allUniqueFiles.reduce((acc, file) => {
          acc[file.name] = { status: 'processing' };
          return acc;
      }, {} as Record<string, { status: FileProcessingStatus; error?: string | undefined; }>);
      setFileProcessingStatus(initialStatuses);
      
      try {
          const filesProcessed = new Set<string>();

          const salesforcePromises = salesforceFiles.map(file => {
              if (filesProcessed.has(file.name)) return Promise.resolve(null);
              filesProcessed.add(file.name);
              return analyzeSalesforceFile(file).then(result => {
                  setFileProcessingStatus(prev => ({ ...prev, [file.name]: { status: 'success' } }));
                  return result;
              }).catch(e => {
                  setFileProcessingStatus(prev => ({ ...prev, [file.name]: { status: 'error', error: e.message } }));
                  throw e;
              });
          });

          const emailPromises = emailFiles.map(file => {
              if (filesProcessed.has(file.name)) return Promise.resolve(null);
              filesProcessed.add(file.name);
              return analyzeEmailConversation(file).then(result => {
                  setFileProcessingStatus(prev => ({ ...prev, [file.name]: { status: 'success' } }));
                  return result;
              }).catch(e => {
                  setFileProcessingStatus(prev => ({ ...prev, [file.name]: { status: 'error', error: e.message } }));
                  throw e;
              });
          });

          const imageProcessingPromises = imageFiles.map(async (img) => {
              if (filesProcessed.has(img.name)) return Promise.resolve(null);
              filesProcessed.add(img.name);
              const processedImage = await resizeAndCompressImage(img);
              return analyzeImage(processedImage).then(result => {
                  setFileProcessingStatus(prev => ({ ...prev, [img.name]: { status: 'success' } }));
                  return { originalFile: img, report: result };
              }).catch(e => {
                  setFileProcessingStatus(prev => ({ ...prev, [img.name]: { status: 'error', error: e.message } }));
                  throw e;
              });
          });
          
          const [salesforceResults, emailResults, imageResults] = await Promise.all([
              Promise.all(salesforcePromises),
              Promise.all(emailPromises),
              Promise.all(imageProcessingPromises)
          ]);

          const validSalesforceResults = salesforceResults.filter((r): r is { project_details: ProjectDetails } => r !== null);
          const validEmailResults = emailResults.filter((r): r is Omit<SynthesizedProjectData, 'project_details' | 'image_reports'> => r !== null);
          const validImageResults = imageResults.filter((r): r is { originalFile: File, report: any } => r !== null);
          
          const mergedProjectDetails: ProjectDetails = validSalesforceResults.reduce((acc, result) => {
              return {
                  project_name: acc.project_name || result.project_details.project_name,
                  opportunity_number: acc.opportunity_number || result.project_details.opportunity_number,
                  account_name: acc.account_name || result.project_details.account_name,
                  opp_revenue: acc.opp_revenue || result.project_details.opp_revenue,
              };
          }, { project_name: '', opportunity_number: '', account_name: '', opp_revenue: 0 });

          const mergedEmailData = validEmailResults.reduce((acc, result) => {
              const maxNodeId = acc.conversation_nodes.reduce((maxId, node) => Math.max(maxId, node.node_id), 0);
              const idMap = new Map<number, number>();
              
              const tempNodes = result.conversation_nodes.map((node, i) => {
                  const newId = maxNodeId + 1 + i;
                  idMap.set(node.node_id, newId);
                  return { ...node, node_id: newId };
              });

              const reindexedNodes = tempNodes.map(node => {
                  let newParentId: number | null = null;
                  if (node.parent_node_id !== null && idMap.has(node.parent_node_id)) {
                      newParentId = idMap.get(node.parent_node_id)!;
                  }
                  return { ...node, parent_node_id: newParentId };
              });

              return {
                  action_items: [...acc.action_items, ...result.action_items],
                  conversation_summary: (acc.conversation_summary + '\n\n' + result.conversation_summary).trim(),
                  conversation_nodes: [...acc.conversation_nodes, ...reindexedNodes],
                  attachments: [...acc.attachments, ...result.attachments],
                  mentioned_attachments: [...acc.mentioned_attachments, ...result.mentioned_attachments],
              };
          }, { action_items: [] as ActionItem[], conversation_summary: '', conversation_nodes: [] as ConversationNode[], attachments: [] as Attachment[], mentioned_attachments: [] as MentionedAttachment[] });

          const synthesizedData: SynthesizedProjectData = {
              project_details: mergedProjectDetails,
              ...mergedEmailData,
              image_reports: validImageResults.map(r => r.report),
          };
          
          const sourceFiles = {
              salesforceFileNames: salesforceFiles.map(f => f.name),
              emailFileNames: emailFiles.map(f => f.name),
          };
          
          let rawSalesforceContentForUi = '';
          for (const file of salesforceFiles.filter(f => f.name.endsWith('.md'))) {
              rawSalesforceContentForUi += `\n\n--- Content from ${file.name} ---\n\n` + await fileReader(file);
          }
          if (!rawSalesforceContentForUi.trim()) rawSalesforceContentForUi = `Content from ${salesforceFiles.length} Salesforce file(s) was used for analysis. Preview is not available for all file types.`;

          let rawEmailContentForUi = '';
          for (const file of emailFiles.filter(f => /\.(txt|eml|csv|md|html|json)$/i.test(f.name))) {
              let content = await fileReader(file);
              if (file.name.toLowerCase().endsWith('.csv')) {
                  content = parseAndFormatCsv(content);
              }
              rawEmailContentForUi += `\n\n--- Content from ${file.name} ---\n\n` + content;
          }
           if (!rawEmailContentForUi.trim()) rawEmailContentForUi = `Content from ${emailFiles.length} email file(s) was used for analysis. Preview is not available for all file types.`;
          
          const originalImageFiles = validImageResults.map(r => r.originalFile);
          handleAnalysisComplete(synthesizedData, originalImageFiles, sourceFiles, rawSalesforceContentForUi.trim(), rawEmailContentForUi.trim());

      } catch (err) {
          addMessageToHistory({ sender: 'system', text: `Project creation failed. One or more files could not be processed. Please review the errors and try again.` });
          console.error("Parallel analysis failed:", err);
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleFileSubmit = async () => {
    addMessageToHistory({ sender: 'user', text: `Uploading ${files.length} file(s)...`});
    setUploadError(null);

    const salesforceFiles = files.filter(isSalesforceFile);
    const emailFiles = files.filter(isEmailFile);
    const imageFiles = files.filter(isImageFile);
    
    if (salesforceFiles.length === 0 || emailFiles.length === 0) {
        setUploadError("Project creation requires at least one Salesforce file (.md or image) and one email/conversation file. Please provide both types.");
        return;
    }
    
    handleCreateProject(salesforceFiles, emailFiles, imageFiles);
  };

  const handleFilesChange = (newFiles: File[]) => {
    setUploadError(null);
    const errors: string[] = [];
    const prospectiveFiles = [...newFiles];

    if (prospectiveFiles.length > MAX_TOTAL_FILES) {
        errors.push(`• You can upload a maximum of ${MAX_TOTAL_FILES} files.`);
    }

    const salesforceFileCount = prospectiveFiles.filter(isSalesforceFile).length;
    const emailFileCount = prospectiveFiles.filter(isEmailFile).length;
    const imageFileCount = prospectiveFiles.filter(isImageFile).length;

    if (salesforceFileCount > MAX_SALESFORCE_FILES) {
        errors.push(`• You can upload a maximum of ${MAX_SALESFORCE_FILES} Salesforce files (.md or image).`);
    }
    if (emailFileCount > MAX_EMAIL_FILES) {
        errors.push(`• You can upload a maximum of ${MAX_EMAIL_FILES} email thread files.`);
    }
    if (imageFileCount > MAX_IMAGE_FILES) {
        errors.push(`• You can upload a maximum of ${MAX_IMAGE_FILES} images.`);
    }

    for (const file of newFiles) {
        const existingFile = files.find(f => f.name === file.name);
        if (existingFile) continue;

        if (isSalesforceFile(file)) {
            if (file.size > MAX_SALESFORCE_FILE_SIZE_BYTES) {
                errors.push(`• SF File "${file.name}" is too large (max ${MAX_SALESFORCE_FILE_SIZE_MB}MB).`);
            }
        } 
        if (isEmailFile(file)) {
            if (file.size > MAX_EMAIL_FILE_SIZE_BYTES) {
                errors.push(`• Email File "${file.name}" is too large (max ${MAX_EMAIL_FILE_SIZE_MB}MB).`);
            }
        } 
        if (isImageFile(file)) {
            if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
                errors.push(`• Image "${file.name}" is too large (max ${MAX_IMAGE_FILE_SIZE_MB}MB).`);
            }
        }
        
        if (!isSalesforceFile(file) && !isEmailFile(file) && !isImageFile(file)) {
            errors.push(`• Unsupported file type: "${file.name}".`);
        }
    }

    if (errors.length > 0) {
        setUploadError(errors.join('\n'));
        return;
    }
    
    setFiles(newFiles);
  };

  const handleCommandSubmit = async (text: string) => {
      addMessageToHistory({ sender: 'user', text: text});
      addMessageToHistory({ sender: 'system', text: 'Text-based commands are not yet implemented.'});
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
    setFiles([]); // Clear files after successful creation
    setFileProcessingStatus({});
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
    setFileProcessingStatus({});
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
                    onOpenTemplateModal={() => setTemplateModalOpen(true)}
                    files={files}
                    onFilesChange={handleFilesChange}
                    onSubmitFiles={handleFileSubmit}
                    isProcessing={isProcessing}
                    uploadError={uploadError}
                    fileStatuses={fileProcessingStatus}
                />
            )}
        </main>
        
        {!selectedProject && (
          <CommandBar 
            onSubmit={handleCommandSubmit} 
            isProcessing={isProcessing}
          />
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