import { GoogleGenAI, Type } from "@google/genai";
import { SynthesizedProjectData, ProjectDetails, ImageAnalysisReport, ActionItem } from '../types';

export class GeminiApiError extends Error {
  public readonly isRetryable: boolean;
  constructor(message: string, isRetryable: boolean = false) {
    super(message);
    this.name = 'GeminiApiError';
    this.isRetryable = isRetryable;
  }
}

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
        confidence: {
            type: Type.NUMBER,
            description: "A score from 0.0 to 1.0 indicating the model's confidence in the OCR accuracy."
        },
    },
    required: ["text", "boundingBox", "confidence"],
};

const salesforceSchema = {
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
  },
  required: ["project_details"]
};

const emailSchema = {
  type: Type.OBJECT,
  properties: {
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
    }
  },
  required: ["action_items", "conversation_summary", "conversation_nodes", "attachments", "mentioned_attachments"]
};

const imageReportSchema = {
    type: Type.OBJECT,
    properties: {
        fileName: { type: Type.STRING, description: "The exact filename of the image being analyzed." },
        summary: { type: Type.STRING },
        extractedText: { type: Type.ARRAY, items: analyzedDetailSchema },
        detectedObjects: { type: Type.ARRAY, items: analyzedDetailSchema },
        partNumbers: { type: Type.ARRAY, items: { type: Type.STRING } },
        people: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["fileName", "summary", "extractedText", "detectedObjects", "partNumbers", "people"]
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
const MAX_TEXT_CHARS = 200000; // ~50k tokens

const makeApiCall = async (file: File, prompt: string, schema: any) => {
    const modelToUse = 'gemini-2.5-flash';
    try {
        const parts: any[] = [];
        let finalPrompt = prompt;

        if (isTextFile(file)) {
            const fileContent = await file.text();
            const processedContent = await summarizeTextIfNeeded(fileContent, `File (${file.name})`, MAX_TEXT_CHARS);
            finalPrompt += `\n\n## File Content: ${file.name} ##\n${processedContent}\n`;
        } else { // Image or other binary
            parts.push(await fileToGenerativePart(file));
            finalPrompt += `\n\n## File: ${file.name} ##\nThe data is provided in the attached file. Please analyze its content based on the instructions.`;
        }

        parts.unshift({ text: finalPrompt });

        const response = await ai.models.generateContent({
            model: modelToUse,
            contents: { parts: parts },
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.2,
            },
        });

        const jsonText = response.text.trim();
        const cleanedJson = jsonText.replace(/^```json\s*|```$/g, '');
        return JSON.parse(cleanedJson);

    } catch (error) {
        console.error(`Error analyzing file ${file.name} with Gemini:`, error);
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const isRetryable = message.includes('internal') || message.includes('server') || message.includes('500') || message.includes('network');
        throw new GeminiApiError(
            `The AI service failed to process ${file.name}. ${isRetryable ? 'This might be a temporary issue.' : 'Please check if your file content is valid or too large.'}`,
            isRetryable
        );
    }
};

export const analyzeSalesforceFile = async (file: File): Promise<{ project_details: ProjectDetails }> => {
    const prompt = `
        You are an expert project management analyst.
        Your task is to analyze the provided Salesforce data.
        Based on this input, extract the project details.
        Your entire output must be a single, valid JSON object conforming to the provided schema.
    `;
    return makeApiCall(file, prompt, salesforceSchema);
};

export const analyzeEmailConversation = async (file: File): Promise<Omit<SynthesizedProjectData, 'project_details' | 'image_reports'>> => {
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
    const data = await makeApiCall(file, prompt, emailSchema);

    // Post-processing to add unique IDs to action items
    if (data.action_items && Array.isArray(data.action_items)) {
      data.action_items = data.action_items.map((item: any, index: number) => ({
        ...item,
        id: `task-${Date.now()}-${index}`
      }));
    } else {
      data.action_items = [];
    }

    // Defensive checks for other fields
    if (!data.conversation_summary) data.conversation_summary = "No conversation summary was generated.";
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
    const report = await makeApiCall(file, prompt, imageReportSchema);
    // Ensure the filename from the prompt is correctly passed through
    if (!report.fileName) {
        report.fileName = file.name;
    }
    return report;
};

export const chatWithProjectContext = async (projectData: Omit<SynthesizedProjectData, 'image_reports'>, actionItems: ActionItem[], userQuery: string): Promise<string> => {
    try {
        // Create a simplified context to keep the prompt efficient and focused
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

        const systemInstruction = `You are an expert AI assistant for the project management platform V.I.R.A. Your task is to answer questions about a specific project based ONLY on the JSON data provided in the user prompt. Do not use any external knowledge or make assumptions beyond this data. If the answer cannot be found in the provided data, state that clearly. Provide concise and helpful answers.`;

        const contents = `
## Project Context Data
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

## User's Question
"${userQuery}"
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2,
            },
        });

        return response.text;
    } catch (error) {
        console.error("Error in chatWithProjectContext:", error);
        throw new GeminiApiError("The AI assistant failed to respond. Please try again.", true);
    }
};