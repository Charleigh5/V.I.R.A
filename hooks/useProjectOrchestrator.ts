import { useReducer, useEffect, useCallback } from 'react';
import { 
    Project, ProjectImage, RawImageAnalysis, SynthesizedProjectData, 
    FileProcessingStatus, ProjectDetails, ActionItem, ConversationNode, 
    Attachment, MentionedAttachment 
} from '../types';
import { 
    analyzeSalesforceFile, analyzeEmailConversation, analyzeImage 
} from '../services/geminiService';
import { resizeAndCompressImage } from '../utils/imageUtils';
import { convertPdfToImages } from '../utils/pdfUtils';
import { 
    isSalesforceFile, isEmailFile, isImageFile, isPdfFile, MAX_TOTAL_FILES,
    MAX_SALESFORCE_FILES, MAX_EMAIL_FILES, MAX_IMAGE_FILES,
    MAX_SALESFORCE_FILE_SIZE_BYTES, MAX_SALESFORCE_FILE_SIZE_MB,
    MAX_EMAIL_FILE_SIZE_BYTES, MAX_EMAIL_FILE_SIZE_MB,
    MAX_IMAGE_FILE_SIZE_BYTES, MAX_IMAGE_FILE_SIZE_MB
} from '../utils/validation';
import { GeminiAnalysisPool, AggregateAnalysisError } from '../services/geminiAnalysisPool';

// 1. STATE DEFINITION (FSM States and Context)

export enum ProjectLifecycle {
  IDLE = 'IDLE',
  VALIDATING = 'VALIDATING',
  CONVERTING_PDFS = 'CONVERTING_PDFS',
  ANALYZING_PARALLEL = 'ANALYZING_PARALLEL',
  MERGING_RESULTS = 'MERGING_RESULTS',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  CREATING_PROJECT = 'CREATING_PROJECT',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

interface AnalysisPayload {
    textData: Omit<SynthesizedProjectData, 'image_reports'>;
    imageData: RawImageAnalysis[];
    sourceFiles: { salesforceFileNames: string[]; emailFileNames: string[] };
    rawSalesforceContent: string;
    rawEmailContent: string;
}

interface ProjectCreationContext {
  files: File[];
  convertedImagesFromPdfs: File[];
  fileProcessingStatus: Record<string, { status: FileProcessingStatus; error?: string }>;
  error: string | null;
  analysisPayload: AnalysisPayload | null;
  finalImages: ProjectImage[] | null;
  newlyCreatedProject: Project | null;
}

interface OrchestratorState {
  value: ProjectLifecycle;
  context: ProjectCreationContext;
}

// 2. EVENT DEFINITION (Actions that trigger state transitions)

type OrchestratorEvent =
  | { type: 'SUBMIT_FILES'; files: File[] }
  | { type: 'VALIDATION_SUCCESS' }
  | { type: 'PDF_CONVERSION_COMPLETE'; images: File[] }
  | { type: 'START_ANALYSIS' }
  | { type: 'UPDATE_STATUS'; payload: { fileName: string; status: FileProcessingStatus; error?: string } }
  | { type: 'ANALYSIS_COMPLETE'; payload: AnalysisPayload }
  | { type: 'CONFIRM_REVIEW'; images: ProjectImage[] }
  | { type: 'PROJECT_CREATED'; project: Project }
  | { type: 'CANCEL' }
  | { type: 'RESET' }
  | { type: 'SET_ERROR'; error: string };

// 3. THE REDUCER (Pure function to calculate the next state)

const initialState: OrchestratorState = {
  value: ProjectLifecycle.IDLE,
  context: {
    files: [],
    convertedImagesFromPdfs: [],
    fileProcessingStatus: {},
    error: null,
    analysisPayload: null,
    finalImages: null,
    newlyCreatedProject: null,
  },
};

const orchestratorReducer = (state: OrchestratorState, event: OrchestratorEvent): OrchestratorState => {
  switch (state.value) {
    case ProjectLifecycle.IDLE:
      if (event.type === 'SUBMIT_FILES') {
        return {
          ...state,
          value: ProjectLifecycle.VALIDATING,
          context: { ...initialState.context, files: event.files, error: null },
        };
      }
      break;

    case ProjectLifecycle.VALIDATING:
      if (event.type === 'VALIDATION_SUCCESS') {
        const hasPdfs = state.context.files.some(isPdfFile);
        const nextState = hasPdfs ? ProjectLifecycle.CONVERTING_PDFS : ProjectLifecycle.ANALYZING_PARALLEL;
        const initialStatuses = state.context.files.reduce((acc, file) => {
            acc[file.name] = { status: 'processing' };
            return acc;
        }, {} as Record<string, { status: FileProcessingStatus; error?: string | undefined; }>);

        return {
          ...state,
          value: nextState,
          context: { ...state.context, fileProcessingStatus: initialStatuses },
        };
      }
      if (event.type === 'SET_ERROR') {
        return {
          ...state,
          value: ProjectLifecycle.ERROR,
          context: { ...state.context, error: event.error, files: [] },
        };
      }
      break;
    
    case ProjectLifecycle.CONVERTING_PDFS:
        if (event.type === 'PDF_CONVERSION_COMPLETE') {
            return {
                ...state,
                value: ProjectLifecycle.ANALYZING_PARALLEL,
                context: {
                    ...state.context,
                    convertedImagesFromPdfs: event.images
                }
            }
        }
        if (event.type === 'SET_ERROR') {
             return { ...state, value: ProjectLifecycle.ERROR, context: { ...state.context, error: event.error } };
        }
        if (event.type === 'UPDATE_STATUS') {
            return {
                ...state,
                context: {
                    ...state.context,
                    fileProcessingStatus: {
                        ...state.context.fileProcessingStatus,
                        [event.payload.fileName]: { status: event.payload.status, error: event.payload.error }
                    }
                }
            }
        }
        break;

    case ProjectLifecycle.ANALYZING_PARALLEL:
        if (event.type === 'UPDATE_STATUS') {
            return {
                ...state,
                context: {
                    ...state.context,
                    fileProcessingStatus: {
                        ...state.context.fileProcessingStatus,
                        [event.payload.fileName]: { status: event.payload.status, error: event.payload.error }
                    }
                }
            }
        }
        if (event.type === 'ANALYSIS_COMPLETE') {
            return {
                ...state,
                value: ProjectLifecycle.MERGING_RESULTS,
                context: { ...state.context, analysisPayload: event.payload }
            }
        }
        if (event.type === 'SET_ERROR') {
            return {
                ...state,
                value: ProjectLifecycle.ERROR,
                context: { ...state.context, error: event.error }
            }
        }
        break;

    case ProjectLifecycle.MERGING_RESULTS:
        if (state.context.analysisPayload?.imageData && state.context.analysisPayload.imageData.length > 0) {
            return { ...state, value: ProjectLifecycle.AWAITING_REVIEW };
        }
        // No images to review, skip to creation
        return { ...state, value: ProjectLifecycle.CREATING_PROJECT, context: { ...state.context, finalImages: [] } };

    case ProjectLifecycle.AWAITING_REVIEW:
        if (event.type === 'CONFIRM_REVIEW') {
            return {
                ...state,
                value: ProjectLifecycle.CREATING_PROJECT,
                context: { ...state.context, finalImages: event.images }
            }
        }
        break;
    
    case ProjectLifecycle.CREATING_PROJECT:
        if (event.type === 'PROJECT_CREATED') {
            return {
                ...state,
                value: ProjectLifecycle.COMPLETE,
                context: { ...state.context, newlyCreatedProject: event.project }
            }
        }
        break;
    
    case ProjectLifecycle.COMPLETE:
    case ProjectLifecycle.AWAITING_REVIEW: // Allow cancellation from review modal
        if (event.type === 'RESET' || event.type === 'CANCEL') {
            return initialState;
        }
        break;
        
    case ProjectLifecycle.ERROR:
        if (event.type === 'SUBMIT_FILES') {
            // Allow restarting the process from an error state
            return {
                ...initialState,
                value: ProjectLifecycle.VALIDATING,
                context: { ...initialState.context, files: event.files },
            };
        }
        if (event.type === 'RESET' || event.type === 'CANCEL') {
            return initialState;
        }
        break;
  }
  return state;
};


// 4. THE CUSTOM HOOK (Manages reducer state and side-effects)

export const useProjectOrchestrator = (
    onSuccess: (project: Project) => void
) => {
  const [state, dispatch] = useReducer(orchestratorReducer, initialState);

  const { value, context } = state;

  // Side-effect for VALIDATING
  useEffect(() => {
    if (value !== ProjectLifecycle.VALIDATING) return;
    
    const errors: string[] = [];
    const prospectiveFiles = context.files;
    const salesforceFiles = prospectiveFiles.filter(isSalesforceFile);
    const emailFiles = prospectiveFiles.filter(isEmailFile);

    if (salesforceFiles.length === 0 || emailFiles.length === 0) {
        errors.push("• At least one Salesforce file and one email file are required.");
    }
    if (prospectiveFiles.length > MAX_TOTAL_FILES) errors.push(`• Max ${MAX_TOTAL_FILES} files.`);
    if (salesforceFiles.length > MAX_SALESFORCE_FILES) errors.push(`• Max ${MAX_SALESFORCE_FILES} Salesforce files.`);
    if (emailFiles.length > MAX_EMAIL_FILES) errors.push(`• Max ${MAX_EMAIL_FILES} email files.`);
    if (prospectiveFiles.filter(isImageFile).length > MAX_IMAGE_FILES) errors.push(`• Max ${MAX_IMAGE_FILES} images.`);

    for (const file of prospectiveFiles) {
        if (isSalesforceFile(file) && file.size > MAX_SALESFORCE_FILE_SIZE_BYTES) errors.push(`• SF File "${file.name}" > ${MAX_SALESFORCE_FILE_SIZE_MB}MB.`);
        if (isEmailFile(file) && file.size > MAX_EMAIL_FILE_SIZE_BYTES) errors.push(`• Email File "${file.name}" > ${MAX_EMAIL_FILE_SIZE_MB}MB.`);
        if (isImageFile(file) && !isPdfFile(file) && file.size > MAX_IMAGE_FILE_SIZE_BYTES) errors.push(`• Image "${file.name}" > ${MAX_IMAGE_FILE_SIZE_MB}MB.`);
    }

    if (errors.length > 0) {
      dispatch({ type: 'SET_ERROR', error: errors.join('\n') });
    } else {
      dispatch({ type: 'VALIDATION_SUCCESS' });
    }
  }, [value, context.files]);

  // Side-effect for CONVERTING_PDFS
  useEffect(() => {
    if (value !== ProjectLifecycle.CONVERTING_PDFS) return;

    const runPdfConversion = async () => {
        const pdfsToProcess = context.files.filter(isPdfFile);
        if (pdfsToProcess.length === 0) {
            dispatch({ type: 'PDF_CONVERSION_COMPLETE', images: [] });
            return;
        }

        try {
            const conversionPromises = pdfsToProcess.map(pdf => convertPdfToImages(pdf).catch(e => {
                dispatch({ type: 'UPDATE_STATUS', payload: { fileName: pdf.name, status: 'error', error: `PDF Fail: ${e.message}` } });
                throw e; // Propagate error to fail Promise.all
            }));
            const convertedImageArrays = await Promise.all(conversionPromises);
            const newImagesFromPdfs = convertedImageArrays.flat();

            pdfsToProcess.forEach(pdf => dispatch({ type: 'UPDATE_STATUS', payload: { fileName: pdf.name, status: 'success' }}));
            
            dispatch({ type: 'PDF_CONVERSION_COMPLETE', images: newImagesFromPdfs });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', error: 'Failed to convert one or more PDF files.' });
        }
    }
    runPdfConversion();

  }, [value, context.files]);


  // Side-effect for ANALYZING_PARALLEL
  useEffect(() => {
    if (value !== ProjectLifecycle.ANALYZING_PARALLEL) return;

    const runAnalysis = async () => {
        try {
            const pool = new GeminiAnalysisPool({ maxConcurrent: 5 });

            const allInputFiles = context.files;
            
            const salesforceFiles = allInputFiles.filter(isSalesforceFile);
            const emailFiles = allInputFiles.filter(isEmailFile);
            const imageFiles = allInputFiles.filter(f => isImageFile(f) && !isPdfFile(f));

            const analysisSalesforceFiles = salesforceFiles.filter(f => !isPdfFile(f));
            const analysisEmailFiles = emailFiles.filter(f => !isPdfFile(f));
            const analysisImageFiles = [...imageFiles, ...context.convertedImagesFromPdfs];

            const salesforceTasks = analysisSalesforceFiles.map(file => () =>
                analyzeSalesforceFile(file).then(r => {
                    dispatch({ type: 'UPDATE_STATUS', payload: { fileName: file.name, status: 'success' }});
                    return r;
                }).catch(e => {
                    dispatch({ type: 'UPDATE_STATUS', payload: { fileName: file.name, status: 'error', error: e.message }});
                    throw e;
                })
            );

            const emailTasks = analysisEmailFiles.map(file => () =>
                analyzeEmailConversation(file).then(r => {
                    dispatch({ type: 'UPDATE_STATUS', payload: { fileName: file.name, status: 'success' }});
                    return r;
                }).catch(e => {
                    dispatch({ type: 'UPDATE_STATUS', payload: { fileName: file.name, status: 'error', error: e.message }});
                    throw e;
                })
            );

            const imageProcessingTasks = analysisImageFiles.map(img => async () => {
                try {
                    const processedImage = await resizeAndCompressImage(img);
                    const report = await analyzeImage(processedImage);
                    dispatch({ type: 'UPDATE_STATUS', payload: { fileName: img.name, status: 'success' }});
                    return { 
                        originalFile: img, 
                        report,
                        fileSize: img.size,
                        uploadDate: new Date(img.lastModified).toISOString()
                    };
                } catch (e) {
                    dispatch({ type: 'UPDATE_STATUS', payload: { fileName: img.name, status: 'error', error: (e as Error).message }});
                    throw e;
                }
            });

            const [salesforceResults, emailResults, imageResults] = await Promise.all([
                pool.executeWithBackpressure(salesforceTasks),
                pool.executeWithBackpressure(emailTasks),
                pool.executeWithBackpressure(imageProcessingTasks)
            ]);

            // MERGING LOGIC
            const mergedProjectDetails: ProjectDetails = salesforceResults.reduce((acc, result) => ({...acc, ...result.project_details}), {} as ProjectDetails);
            const mergedEmailData = emailResults.reduce((acc, result) => {
                const maxNodeId = acc.conversation_nodes.reduce((max, node) => Math.max(max, node.node_id), 0);
                const reindexedNodes = result.conversation_nodes.map((node, i) => ({ ...node, node_id: maxNodeId + 1 + i, parent_node_id: node.parent_node_id ? maxNodeId + node.parent_node_id : null }));
                return {
                    action_items: [...acc.action_items, ...result.action_items],
                    conversation_summary: `${acc.conversation_summary}\n${result.conversation_summary}`.trim(),
                    conversation_nodes: [...acc.conversation_nodes, ...reindexedNodes],
                    attachments: [...acc.attachments, ...result.attachments],
                    mentioned_attachments: [...acc.mentioned_attachments, ...result.mentioned_attachments],
                };
            }, { action_items: [] as ActionItem[], conversation_summary: '', conversation_nodes: [] as ConversationNode[], attachments: [] as Attachment[], mentioned_attachments: [] as MentionedAttachment[] });
            
            const synthesizedData: SynthesizedProjectData = { project_details: mergedProjectDetails, ...mergedEmailData, image_reports: imageResults.map(r => r.report) };
            const { image_reports, ...textData } = synthesizedData;
            
            const rawImageAnalyses: RawImageAnalysis[] = imageResults.map(r => ({
                ...r.report,
                base64Data: URL.createObjectURL(r.originalFile),
                fileSize: r.fileSize,
                uploadDate: r.uploadDate,
            }));

            let rawSalesforceContent = `Content from ${salesforceFiles.length} file(s). Preview unavailable.`;
            if (analysisSalesforceFiles.length === 1 && analysisSalesforceFiles[0].name.endsWith('.md')) {
                rawSalesforceContent = await analysisSalesforceFiles[0].text();
            }

            let rawEmailContent = `Content from ${emailFiles.length} file(s). Preview unavailable.`;
            if(analysisEmailFiles.length === 1 && (analysisEmailFiles[0].name.endsWith('.eml') || analysisEmailFiles[0].name.endsWith('.txt'))) {
                rawEmailContent = await analysisEmailFiles[0].text();
            }


            dispatch({ type: 'ANALYSIS_COMPLETE', payload: {
                textData,
                imageData: rawImageAnalyses,
                sourceFiles: { salesforceFileNames: salesforceFiles.map(f=>f.name), emailFileNames: emailFiles.map(f=>f.name) },
                rawSalesforceContent,
                rawEmailContent,
            }});
        } catch (err) {
            let errorMessage = 'An unexpected error occurred during file analysis.';
            if (err instanceof AggregateAnalysisError) {
                // The individual file statuses have already been updated with specific errors.
                // This global message directs the user to look at them.
                errorMessage = 'Project synthesis failed. Please review the errors on the individual files below and try again.';
            } else if (err instanceof Error) {
                // For non-aggregate errors, the message might be more specific.
                errorMessage = `File analysis failed: ${err.message}`;
            }
            dispatch({ type: 'SET_ERROR', error: errorMessage });
        }
    };
    runAnalysis();
  }, [value, context.files, context.convertedImagesFromPdfs]);

  // Side-effect for CREATING_PROJECT
  useEffect(() => {
    if (value !== ProjectLifecycle.CREATING_PROJECT) return;
    if (!context.analysisPayload || !context.finalImages) return;

    const { textData, sourceFiles, rawSalesforceContent, rawEmailContent } = context.analysisPayload;
    
    const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: textData.project_details.project_name || `Project ${Date.now()}`,
        opportunityNumber: textData.project_details.opportunity_number || 'N/A',
        status: 'READY' as any,
        data: textData,
        images: context.finalImages,
        createdAt: new Date().toISOString(),
        sourceFiles: sourceFiles,
        rawSalesforceContent: rawSalesforceContent,
        rawEmailContent: rawEmailContent,
    };
    
    dispatch({ type: 'PROJECT_CREATED', project: newProject });

  }, [value, context.analysisPayload, context.finalImages]);

  // Side-effect for COMPLETE state
  useEffect(() => {
    if (value !== ProjectLifecycle.COMPLETE) return;
    if (context.newlyCreatedProject) {
        onSuccess(context.newlyCreatedProject);
    }
  }, [value, context.newlyCreatedProject, onSuccess]);


  // Exposed actions for the UI to call
  const submitFiles = useCallback((files: File[]) => {
    dispatch({ type: 'SUBMIT_FILES', files });
  }, []);

  const confirmReview = useCallback((images: ProjectImage[]) => {
    dispatch({ type: 'CONFIRM_REVIEW', images });
  }, []);

  const cancel = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, []);
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    actions: { submitFiles, confirmReview, cancel, reset }
  };
};