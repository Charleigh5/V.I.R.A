export interface ProjectDetails {
  project_name: string;
  opportunity_number: string;
  account_name: string;
  opp_revenue: number;
}

export enum TaskStatus {
  Open = 'Open',
  InProcess = 'In-Process',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export enum TaskPriority {
  Low = 'Low',
  Normal = 'Normal',
  High = 'High',
}

export interface ActionItem {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  assigned_to_name: string;
  task_types: string;
  hours_remaining: number;
  total_hours?: number;
  sourceConversationNodeId?: number;
}

export interface ConversationNode {
  node_id: number;
  parent_node_id: number | null;
  speaker_name: string;
  speaker_email: string;
  timestamp: string;
  summary: string;
}

export interface Attachment {
  file_name: string;
  file_type: string;
  file_size_mb: number;
  upload_date: string;
}

export interface MentionedAttachment {
  file_name: string;
  context: string;
}

// Represents the bounding box of a detected item on an image
export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Represents a single analyzed detail with its text and location
export interface AnalyzedDetail {
  text: string;
  correctedText?: string;
  boundingBox: BoundingBox;
  confidence?: number;
}

// What the AI returns
export interface ImageAnalysisReport {
  fileName: string;
  summary: string;
  extractedText: AnalyzedDetail[];
  detectedObjects: AnalyzedDetail[];
  partNumbers: string[];
  people: string[];
}

// Data passed to the review modal
export interface RawImageAnalysis extends ImageAnalysisReport {
  base64Data: string;
}

// New type for grouped details
export interface ImportedImageDetails {
  extractedText?: AnalyzedDetail[];
  detectedObjects?: AnalyzedDetail[];
  partNumbers?: string[];
  people?: string[];
}

// Final structure for a stored image in a project
export interface ProjectImage {
  fileName: string;
  base64Data: string;
  report: {
    summary: string;
    importedDetails: ImportedImageDetails;
  };
}

// The full payload from the Gemini API
export interface SynthesizedProjectData {
  project_details: ProjectDetails;
  action_items: ActionItem[];
  conversation_summary: string;
  conversation_nodes: ConversationNode[];
  attachments: Attachment[];
  mentioned_attachments: MentionedAttachment[];
  image_reports?: ImageAnalysisReport[];
}

export enum ProjectStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR',
}

// The final, structured project object used throughout the app
export interface Project {
  id: string;
  name: string;
  opportunityNumber: string;
  status: ProjectStatus;
  createdAt: string; // ISO date string
  sourceFiles: {
      salesforceFileNames: string[];
      emailFileNames: string[];
  };
  rawSalesforceContent?: string;
  rawEmailContent?: string;
  data?: Omit<SynthesizedProjectData, 'image_reports'>;
  images?: ProjectImage[];
}

export type FileProcessingStatus = 'processing' | 'success' | 'error';