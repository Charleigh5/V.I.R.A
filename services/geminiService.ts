import { GoogleGenAI, Type } from "@google/genai";
import { SynthesizedProjectData } from '../types';

const MASTER_PROMPT_TEMPLATE = `
# SYSTEM PROMPT

You are an expert project management analyst AI. Your task is to analyze the provided Salesforce data, email conversation, and images. Based on this input, generate a structured JSON object that synthesizes all information.

## INSTRUCTIONS

1.  **Analyze Text:** Parse the Salesforce data and email thread to identify project details, action items, conversation flow, and attachments. Correlate information between sources.
2.  **Summarize Conversation:** Create a high-level summary of the entire email thread. This summary should capture the main topic, key decisions made, critical questions asked, and any unresolved issues.
3.  **Analyze Images:** For each image, provide a summary, extract all text (OCR) with its bounding box, detect key objects with their bounding boxes, and identify any part numbers or people.
4.  **Output:** Your entire output must be a single, valid JSON object conforming to the schema provided in the API configuration. Bounding box coordinates must be normalized (0.0 to 1.0).

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
  required: ["project_details", "action_items", "conversation_summary", "conversation_nodes", "attachments"]
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

const summarizeTextIfNeeded = async (text: string, contentType: string, charLimit: number): Promise<string> => {
    if (text.length <= charLimit) {
        return text;
    }

    console.warn(`${contentType} content is too long (${text.length} chars). Summarizing...`);
    
    try {
        const summaryPrompt = `Please summarize the following document, retaining all critical information such as names, dates, financial figures, action items, and key decisions. The summary needs to be comprehensive yet concise as it will be used by another AI for analysis. Here is the document:\n\n---\n\n${text}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: summaryPrompt,
            config: { temperature: 0.1 },
        });

        const summary = response.text;
        console.log(`Successfully summarized ${contentType}. Original length: ${text.length}, Summary length: ${summary.length}`);
        return `[AI-Generated Summary of ${contentType}]\n${summary}`;
    } catch (e) {
        console.error(`Failed to summarize ${contentType}. Falling back to truncation.`, e);
        const truncatedText = text.substring(0, charLimit);
        return `${truncatedText}\n\n...[CONTENT TRUNCATED DUE TO EXCESSIVE LENGTH]...`;
    }
};


export const analyzeProjectFiles = async (salesforceMd: string, emailContent: string, images: File[], modelChoice: string): Promise<SynthesizedProjectData> => {
  const MAX_EMAIL_CHARS = 800000; // ~200k tokens
  const MAX_MD_CHARS = 200000; // ~50k tokens

  const processedSalesforceContent = await summarizeTextIfNeeded(salesforceMd, 'Salesforce Data', MAX_MD_CHARS);
  const processedEmailContent = await summarizeTextIfNeeded(emailContent, 'Email Content', MAX_EMAIL_CHARS);

  const contextBlob = `
## Salesforce Data ##
${processedSalesforceContent}

## Email Conversation ##
${processedEmailContent}
  `;

  let prompt = MASTER_PROMPT_TEMPLATE.replace('{{{context_blob}}}', contextBlob);
  const modelToUse = 'gemini-2.5-flash';

  try {
    const imageParts = await Promise.all(images.map(fileToGenerativePart));
    
    if (images.length > 0) {
        const imageFileNames = images.map(f => f.name).join(', ');
        prompt += `\n\n The following image files have been provided for analysis: ${imageFileNames}`;
    }

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: { parts: [{text: prompt}, ...imageParts] },
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
     if (!data.image_reports || !Array.isArray(data.image_reports)) {
        data.image_reports = [];
    }

    return data;
  } catch (error) {
    console.error("Error analyzing project files with Gemini:", error);
    throw new Error("Failed to synthesize project data. Please check the console for details.");
  }
};