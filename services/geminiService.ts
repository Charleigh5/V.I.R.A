import { SynthesizedProjectData, ProjectDetails, ImageAnalysisReport, ActionItem } from '../types';

export class GeminiApiError extends Error {
  public readonly isRetryable: boolean;
  constructor(message: string, isRetryable: boolean = false) {
    super(message);
    this.name = 'GeminiApiError';
    this.isRetryable = isRetryable;
  }
}

type GeminiSchemaKey = 'salesforce' | 'email' | 'image';

type GeminiFilePayload = {
  name: string;
  type: string;
  isText: boolean;
  data: string;
};

type GeminiProxyResponse<T> = {
  data?: T;
  text?: string;
  error?: {
    message: string;
    isRetryable: boolean;
  };
};

type GeminiProxyRequest =
  | {
      type: 'analyze';
      prompt: string;
      schema: GeminiSchemaKey;
      file: GeminiFilePayload;
    }
  | {
      type: 'chat';
      systemInstruction: string;
      contents: string;
    };

const GEMINI_ENDPOINT = '/api/gemini';

const isTextFile = (file: File): boolean => /\.(md|txt|csv|html|json|eml)$/i.test(file.name);

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve(base64Data ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const buildFilePayload = async (file: File): Promise<GeminiFilePayload> => {
  if (isTextFile(file)) {
    const textContent = await file.text();
    return {
      name: file.name,
      type: file.type,
      isText: true,
      data: textContent,
    };
  }

  const base64Data = await fileToBase64(file);
  return {
    name: file.name,
    type: file.type,
    isText: false,
    data: base64Data,
  };
};

const requestGemini = async <T>(payload: GeminiProxyRequest): Promise<GeminiProxyResponse<T>> => {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let body: GeminiProxyResponse<T> | null = null;
  try {
    body = (await response.json()) as GeminiProxyResponse<T>;
  } catch (error) {
    body = null;
  }

  if (!response.ok) {
    const message = body?.error?.message || 'The AI service failed to respond.';
    const isRetryable = body?.error?.isRetryable ?? response.status >= 500;
    throw new GeminiApiError(message, isRetryable);
  }

  if (!body) {
    throw new GeminiApiError('The AI service returned an empty response.', true);
  }

  return body;
};

const makeApiCall = async <T>(file: File, prompt: string, schema: GeminiSchemaKey): Promise<T> => {
  const filePayload = await buildFilePayload(file);
  const response = await requestGemini<T>({
    type: 'analyze',
    prompt,
    schema,
    file: filePayload,
  });

  if (!response.data) {
    throw new GeminiApiError('The AI service did not return structured data.', true);
  }

  return response.data;
};

export const analyzeSalesforceFile = async (file: File): Promise<{ project_details: ProjectDetails }> => {
  const prompt = `
        You are an expert project management analyst.
        Your task is to analyze the provided Salesforce data.
        Based on this input, extract the project details.
        Your entire output must be a single, valid JSON object conforming to the provided schema.
    `;
  return makeApiCall<{ project_details: ProjectDetails }>(file, prompt, 'salesforce');
};

export const analyzeEmailConversation = async (
  file: File
): Promise<Omit<SynthesizedProjectData, 'project_details' | 'image_reports'>> => {
  const prompt = `
        You are an expert project management analyst.
        Your task is to analyze the provided email conversation.
        Based on this input, generate a structured JSON object that synthesizes all relevant information.
        
        ## INSTRUCTIONS
        1. Parse the email thread to identify action items, the conversation flow, and attachments.
        2. Scrutinize the conversation for any explicit mentions of file attachments (e.g., "I've attached the 'final_report.pdf'"). For each, list its name and context.
        3. Create a high-level summary of the entire email thread.
        4. Model the conversation as a series of nodes.
        5. Your entire output must be a single, valid JSON object conforming to the provided schema.
    `;
  const data = await makeApiCall<Omit<SynthesizedProjectData, 'project_details' | 'image_reports'>>(
    file,
    prompt,
    'email'
  );

  if (data.action_items && Array.isArray(data.action_items)) {
    data.action_items = data.action_items.map((item: any, index: number) => ({
      ...item,
      id: `task-${Date.now()}-${index}`,
    }));
  } else {
    data.action_items = [];
  }

  if (!data.conversation_summary) data.conversation_summary = 'No conversation summary was generated.';
  if (!data.conversation_nodes || !Array.isArray(data.conversation_nodes)) data.conversation_nodes = [];
  if (!data.attachments || !Array.isArray(data.attachments)) data.attachments = [];
  if (!data.mentioned_attachments || !Array.isArray(data.mentioned_attachments)) data.mentioned_attachments = [];

  return data;
};

export const analyzeImage = async (file: File): Promise<ImageAnalysisReport> => {
  const prompt = `
        You are an AI specialist in document digitization and visual analysis, optimized for high-accuracy OCR.
        Your task is to meticulously analyze the provided image, "${file.name}", treating it as a potentially scanned document.
        
        ## INSTRUCTIONS
        1.  **Prioritize Text Extraction:** If the image appears to be a document, focus on extracting all text with the highest possible accuracy.
        2.  **Provide Confidence Scores:** For each piece of extracted text, you MUST provide a confidence score from 0.0 (no confidence) to 1.0 (complete confidence) representing the accuracy of the transcription.
        3.  **Summarize Content:** Provide a concise summary of the image's content.
        4.  **Detect Objects:** Detect key objects and provide their bounding boxes. This is secondary to text extraction if the image is a document.
        5.  **Identify Entities:** Identify any part numbers or people visible.
        6.  **Set Filename:** Ensure the 'fileName' field in your response is exactly "${file.name}".
        7.  **Format Output:** Your entire output must be a single, valid JSON object conforming to the provided schema. Bounding box coordinates must be normalized (0.0 to 1.0).
    `;
  const report = await makeApiCall<ImageAnalysisReport>(file, prompt, 'image');
  if (!report.fileName) {
    report.fileName = file.name;
  }
  return report;
};

export const chatWithProjectContext = async (
  projectData: Omit<SynthesizedProjectData, 'image_reports'>,
  actionItems: ActionItem[],
  userQuery: string
): Promise<string> => {
  try {
    const context = {
      projectName: projectData.project_details.project_name,
      accountName: projectData.project_details.account_name,
      revenue: projectData.project_details.opp_revenue,
      conversationSummary: projectData.conversation_summary,
      actionItems: actionItems.map(item => ({
        subject: item.subject,
        status: item.status,
        priority: item.priority,
        assignee: item.assigned_to_name,
        dueDate: item.due_date,
      })),
    };

    const systemInstruction =
      'You are an expert AI assistant for the project management platform V.I.R.A. Your task is to answer questions about a specific project based ONLY on the JSON data provided in the user prompt. Do not use any external knowledge or make assumptions beyond this data. If the answer cannot be found in the provided data, state that clearly. Provide concise and helpful answers.';

    const contents = `
## Project Context Data
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

## User's Question
"${userQuery}"
`;

    const response = await requestGemini<string>({
      type: 'chat',
      systemInstruction,
      contents,
    });

    if (!response.text) {
      throw new GeminiApiError('The AI assistant did not return a response.', true);
    }

    return response.text;
  } catch (error) {
    console.error('Error in chatWithProjectContext:', error);
    if (error instanceof GeminiApiError) {
      throw error;
    }
    throw new GeminiApiError('The AI assistant failed to respond. Please try again.', true);
  }
};
