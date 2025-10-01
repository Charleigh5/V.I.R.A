import { GoogleGenAI, Type } from "@google/genai";
import { SynthesizedProjectData } from '../types';

export class GeminiApiError extends Error {
  public readonly isRetryable: boolean;
  constructor(message: string, isRetryable: boolean = false) {
    super(message);
    this.name = 'GeminiApiError';
    this.isRetryable = isRetryable;
  }
}

const MASTER_PROMPT_TEMPLATE = `
# SYSTEM PROMPT

You are an expert project management analyst AI. Your task is to analyze the provided Salesforce data, email conversation, and images. Based on this input, generate a structured JSON object that synthesizes all information.

## INSTRUCTIONS

1.  **Analyze Text:** Parse the Salesforce data and email thread to identify project details, action items, conversation flow, and attachments. Correlate information between sources.
2.  **Extract Mentioned Attachments:** Scrutinize the email conversation for any explicit mentions of file attachments (e.g., "I've attached the 'final_report.pdf'"). For each mentioned file, list its name and provide a brief context about the mention (e.g., who mentioned it and why).
3.  **Summarize Conversation:** Create a high-level summary of the entire email thread. This summary should capture the main topic, key decisions made, critical questions asked, and any unresolved issues.
4.  **Analyze Images:** For each image, provide a summary, extract all text (OCR) with its bounding box, detect key objects with their bounding boxes, and identify any part numbers or people.
5.  **Output:** Your entire output must be a single, valid JSON object conforming to the schema provided in the API configuration. Bounding box coordinates must be normalized (0.0 to 1.0).

---
# INPUT DATA

{{{context_blob}}}
`;

const boundingBoxSchema = {
    type: Type.OBJECT,
    properties: {
        x1: { type: Type.NUMBER },
        y1: { type: Type.NUMBER },
        x2: { type: Type.NUMBER },
        y2: { type: Type.NUMBER },
    },
    required: ["x1", "y1", "x2", "y2"],
};

const analyzedDetailSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING },
        boundingBox: boundingBoxSchema,
    },
    required: ["text", "boundingBox"],
};


const responseSchema = {
  type: Type.OBJECT,
  properties: {
    project_details: {
      type: Type.OBJECT,
      properties: {
        project_name: { type: Type.STRING },
        opportunity_number: { type: Type.STRING },
        account_name: { type: Type.STRING },
        opp_revenue: { type: Type.NUMBER },
      },
      required: ["project_name", "opportunity_number", "account_name", "opp_revenue"]
    },
    action_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          description: { type: Type.STRING },
          status: { type: Type.STRING },
          priority: { type: Type.STRING },
          due_date: { type: Type.STRING },
          assigned_to_name: { type: Type.STRING },
          task_types: { type: Type.STRING },
          hours_remaining: { type: Type.NUMBER },
          total_hours: { type: Type.NUMBER },
        },
        required: ["subject", "description", "status", "priority", "due_date", "assigned_to_name", "task_types", "hours_remaining"]
      }
    },
    conversation_summary: {
      type: Type.STRING,
      description: "A concise summary of the entire email conversation thread, highlighting key decisions, outcomes, and unanswered questions.",
    },
    conversation_nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          node_id: { type: Type.INTEGER },
          parent_node_id: { type: Type.INTEGER },
          speaker_name: { type: Type.STRING },
          speaker_email: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["node_id", "speaker_name", "speaker_email", "timestamp", "summary"]
      }
    },
    attachments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          file_name: { type: Type.STRING },
          file_type: { type: Type.STRING },
          file_size_mb: { type: Type.NUMBER },
          upload_date: { type: Type.STRING },
        },
        required: ["file_name", "file_type", "file_size_mb", "upload_date"]
      }
    },
    mentioned_attachments: {
      type: Type.ARRAY,
      description: "A list of file attachments explicitly mentioned by name in the email conversation.",
      items: {
        type: Type.OBJECT,
        properties: {
          file_name: { 
            type: Type.STRING,
            description: "The full name of the mentioned file, including its extension."
          },
          context: { 
            type: Type.STRING,
            description: "A brief description of the context in which the file was mentioned (e.g., who mentioned it and in relation to what)."
          }
        },
        required: ["file_name", "context"]
      }
    },
    image_reports: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                fileName: { type: Type.STRING },
                summary: { type: Type.STRING },
                extractedText: { type: Type.ARRAY, items: analyzedDetailSchema },
                detectedObjects: { type: Type.ARRAY, items: analyzedDetailSchema },
                partNumbers: { type: Type.ARRAY, items: { type: Type.STRING } },
                people: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["fileName", "summary", "extractedText", "detectedObjects", "partNumbers", "people"]
        }
    }
  },
  required: ["project_details", "action_items", "conversation_summary", "conversation_nodes", "attachments", "mentioned_attachments"]
};


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const fileToGenerativePart = (file: File) => {
    return new Promise<{inlineData: {data: string, mimeType: string}}>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = (reader.result as string).split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const summarizeSingleChunk = async (promptText: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: { temperature: 0.1 },
    });
    return response.text;
};

const summarizeTextIfNeeded = async (text: string, contentType: string, charLimit: number): Promise<string> => {
    if (text.length <= charLimit) {
        return text;
    }

    console.warn(`${contentType} content is too long (${text.length} chars). Summarizing...`);
    
    // Using a more conservative character limit to avoid potential 500 internal server errors or timeouts with very large single prompts.
    const API_CALL_CHAR_LIMIT = 950000;

    try {
        let summary;
        if (text.length <= API_CALL_CHAR_LIMIT) {
            // Text is long but fits in a single API call
            const prompt = `Please summarize the following ${contentType} document, retaining all critical information such as names, dates, financial figures, action items, and key decisions. The summary needs to be comprehensive yet concise as it will be used by another AI for analysis. Here is the document:\n\n---\n\n${text}`;
            summary = await summarizeSingleChunk(prompt);
        } else {
            // Text is too long for one call, so we chunk it (MapReduce)
            console.warn(`${contentType} is extremely long (${text.length} chars). Using chunked summarization.`);
            
            const chunks: string[] = [];
            for (let i = 0; i < text.length; i += API_CALL_CHAR_LIMIT) {
                chunks.push(text.substring(i, i + API_CALL_CHAR_LIMIT));
            }
            console.log(`Split content into ${chunks.length} chunks.`);

            const chunkSummaryPromises = chunks.map((chunk, index) => {
                const prompt = `This is part ${index + 1} of ${chunks.length} of a larger ${contentType} document. Please summarize the following text, retaining all critical information such as names, dates, financial figures, action items, and key decisions. The summary needs to be comprehensive yet concise. Here is the text chunk:\n\n---\n\n${chunk}`;
                return summarizeSingleChunk(prompt);
            });

            const chunkSummaries = await Promise.all(chunkSummaryPromises);

            const combinedSummaries = chunkSummaries.join('\n\n---\n\n');
            
            console.log(`Combined intermediate summaries. Total length: ${combinedSummaries.length} chars.`);

            if (combinedSummaries.length > API_CALL_CHAR_LIMIT) {
                console.warn(`Combined summaries are still too long for a final summarization pass. Using combined summaries directly, which may affect quality.`);
                summary = combinedSummaries;
            } else {
                // Final summarization pass to create a cohesive narrative from the chunk summaries
                const finalSummaryPrompt = `The following are separate summaries from a very long ${contentType} document. Please synthesize them into a single, cohesive final summary, retaining all critical details like names, dates, and action items.\n\n---\n\n${combinedSummaries}`;
                summary = await summarizeSingleChunk(finalSummaryPrompt);
            }
        }
        
        console.log(`Successfully summarized ${contentType}. Original length: ${text.length}, Summary length: ${summary.length}`);
        return `[AI-Generated Summary of ${contentType}]\n${summary}`;

    } catch (e) {
        console.error(`Failed to summarize ${contentType}. Falling back to truncation.`, e);
        const truncatedText = text.substring(0, charLimit);
        return `${truncatedText}\n\n...[CONTENT TRUNCATED DUE TO EXCESSIVE LENGTH & SUMMARIZATION ERROR]...`;
    }
};

const isTextFile = (file: File): boolean => /\.(md|txt|csv|html|json|eml)$/i.test(file.name);

export const analyzeProjectFiles = async (salesforceFile: File, emailFile: File, images: File[]): Promise<SynthesizedProjectData> => {
  const MAX_MD_CHARS = 200000; // ~50k tokens
  const modelToUse = 'gemini-2.5-flash';
  
  try {
    const parts: any[] = [];
    let contextBlob = '';

    // Process Salesforce File
    if (isTextFile(salesforceFile)) {
        const salesforceContent = await salesforceFile.text();
        const processedSalesforceContent = await summarizeTextIfNeeded(salesforceContent, 'Salesforce Data', MAX_MD_CHARS);
        contextBlob += `\n## Salesforce Data ##\n${processedSalesforceContent}\n`;
    } else { // It's an image or other binary
        parts.push(await fileToGenerativePart(salesforceFile));
        contextBlob += `\n## Salesforce Data ##\nThe Salesforce data is provided in the attached file: ${salesforceFile.name}. Please analyze its content.\n`;
    }

    // Process Email File
    parts.push(await fileToGenerativePart(emailFile));
    contextBlob += `\n## Email Conversation ##\nThe email conversation is provided in the attached file: ${emailFile.name}.\n`;
    
    // Process additional images
    const imageParts = await Promise.all(images.map(fileToGenerativePart));
    parts.push(...imageParts);
    if (images.length > 0) {
        const imageFileNames = images.map(f => f.name).join(', ');
        contextBlob += `\n\n The following image files have also been provided for analysis: ${imageFileNames}`;
    }

    let prompt = MASTER_PROMPT_TEMPLATE.replace('{{{context_blob}}}', contextBlob);

    // The text prompt must be the first part
    parts.unshift({text: prompt});

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: { parts: parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2,
      },
    });

    const jsonText = response.text.trim();
    const cleanedJson = jsonText.replace(/^```json\s*|```$/g, '');
    const data = JSON.parse(cleanedJson);
    
    // Defensively ensure arrays exist before mapping
    if (data.action_items && Array.isArray(data.action_items)) {
      data.action_items = data.action_items.map((item: any, index: number) => ({
        ...item,
        id: `task-${Date.now()}-${index}`
      }));
    } else {
      data.action_items = [];
    }
    
    if (!data.conversation_summary) {
        data.conversation_summary = "No conversation summary was generated.";
    }
    if (!data.conversation_nodes || !Array.isArray(data.conversation_nodes)) {
        data.conversation_nodes = [];
    }
    if (!data.attachments || !Array.isArray(data.attachments)) {
        data.attachments = [];
    }
    if (!data.mentioned_attachments || !Array.isArray(data.mentioned_attachments)) {
        data.mentioned_attachments = [];
    }
     if (!data.image_reports || !Array.isArray(data.image_reports)) {
        data.image_reports = [];
    }

    return data;
  } catch (error) {
    console.error("Error analyzing project files with Gemini:", error);
    
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    // Heuristic to determine if the error is a temporary server issue or a problem with the user's input.
    const isRetryable = message.includes('internal') || message.includes('server') || message.includes('500') || message.includes('network');

    throw new GeminiApiError(
      `The AI service failed to process the request. ${isRetryable ? 'This might be a temporary issue.' : 'Please check if your file content is valid or too large.'}`,
      isRetryable
    );
  }
};