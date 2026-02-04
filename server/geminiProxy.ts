/**
 * Gemini proxy middleware for handling server-side @google/genai requests.
 * This keeps API keys on the server while providing a minimal JSON endpoint.
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "http";

type GeminiSchemaKey = "salesforce" | "email" | "image";

type GeminiFilePayload = {
  name: string;
  type: string;
  isText: boolean;
  data: string;
};

type GeminiProxyRequest =
  | {
      type: "analyze";
      prompt: string;
      schema: GeminiSchemaKey;
      file: GeminiFilePayload;
    }
  | {
      type: "chat";
      systemInstruction: string;
      contents: string;
    };

type GeminiErrorPayload = {
  error: {
    message: string;
    isRetryable: boolean;
  };
};

const MAX_BODY_SIZE = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 200000;
const API_CALL_CHAR_LIMIT = 950000;

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
      description: "A score from 0.0 to 1.0 indicating the model's confidence in the OCR accuracy.",
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
      required: ["project_name", "opportunity_number", "account_name", "opp_revenue"],
    },
  },
  required: ["project_details"],
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
        required: [
          "subject",
          "description",
          "status",
          "priority",
          "due_date",
          "assigned_to_name",
          "task_types",
          "hours_remaining",
        ],
      },
    },
    conversation_summary: {
      type: Type.STRING,
      description:
        "A concise summary of the entire email conversation thread, highlighting key decisions, outcomes, and unanswered questions.",
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
        required: ["node_id", "speaker_name", "speaker_email", "timestamp", "summary"],
      },
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
        required: ["file_name", "file_type", "file_size_mb", "upload_date"],
      },
    },
    mentioned_attachments: {
      type: Type.ARRAY,
      description: "A list of file attachments explicitly mentioned by name in the email conversation.",
      items: {
        type: Type.OBJECT,
        properties: {
          file_name: {
            type: Type.STRING,
            description: "The full name of the mentioned file, including its extension.",
          },
          context: {
            type: Type.STRING,
            description:
              "A brief description of the context in which the file was mentioned (e.g., who mentioned it and in relation to what).",
          },
        },
        required: ["file_name", "context"],
      },
    },
  },
  required: ["action_items", "conversation_summary", "conversation_nodes", "attachments", "mentioned_attachments"],
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
  required: ["fileName", "summary", "extractedText", "detectedObjects", "partNumbers", "people"],
};

const schemaMap: Record<GeminiSchemaKey, Record<string, unknown>> = {
  salesforce: salesforceSchema,
  email: emailSchema,
  image: imageReportSchema,
};

const readRequestBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Payload too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const sendError = (res: ServerResponse, status: number, message: string, isRetryable: boolean) => {
  const payload: GeminiErrorPayload = {
    error: {
      message,
      isRetryable,
    },
  };
  sendJson(res, status, payload);
};

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
};

const summarizeSingleChunk = async (ai: GoogleGenAI, promptText: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptText,
    config: { temperature: 0.1 },
  });
  return response.text;
};

const summarizeTextIfNeeded = async (
  ai: GoogleGenAI,
  text: string,
  contentType: string,
  charLimit: number
): Promise<string> => {
  if (text.length <= charLimit) {
    return text;
  }

  console.warn(`${contentType} content is too long (${text.length} chars). Summarizing...`);

  try {
    let summary: string;
    if (text.length <= API_CALL_CHAR_LIMIT) {
      const prompt = `Please summarize the following ${contentType} document, retaining all critical information such as names, dates, financial figures, action items, and key decisions. The summary needs to be comprehensive yet concise as it will be used by another AI for analysis. Here is the document:\n\n---\n\n${text}`;
      summary = await summarizeSingleChunk(ai, prompt);
    } else {
      console.warn(`${contentType} is extremely long (${text.length} chars). Using chunked summarization.`);

      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += API_CALL_CHAR_LIMIT) {
        chunks.push(text.substring(i, i + API_CALL_CHAR_LIMIT));
      }
      console.log(`Split content into ${chunks.length} chunks.`);

      const chunkSummaries = await Promise.all(
        chunks.map((chunk, index) => {
          const prompt = `This is part ${index + 1} of ${chunks.length} of a larger ${contentType} document. Please summarize the following text, retaining all critical information such as names, dates, financial figures, action items, and key decisions. The summary needs to be comprehensive yet concise. Here is the text chunk:\n\n---\n\n${chunk}`;
          return summarizeSingleChunk(ai, prompt);
        })
      );

      const combinedSummaries = chunkSummaries.join("\n\n---\n\n");
      console.log(`Combined intermediate summaries. Total length: ${combinedSummaries.length} chars.`);

      if (combinedSummaries.length > API_CALL_CHAR_LIMIT) {
        console.warn(
          "Combined summaries are still too long for a final summarization pass. Using combined summaries directly, which may affect quality."
        );
        summary = combinedSummaries;
      } else {
        const finalSummaryPrompt = `The following are separate summaries from a very long ${contentType} document. Please synthesize them into a single, cohesive final summary, retaining all critical details like names, dates, and action items.\n\n---\n\n${combinedSummaries}`;
        summary = await summarizeSingleChunk(ai, finalSummaryPrompt);
      }
    }

    console.log(`Successfully summarized ${contentType}. Original length: ${text.length}, Summary length: ${summary.length}`);
    return `[AI-Generated Summary of ${contentType}]\n${summary}`;
  } catch (error) {
    console.error(`Failed to summarize ${contentType}. Falling back to truncation.`, error);
    const truncatedText = text.substring(0, charLimit);
    return `${truncatedText}\n\n...[CONTENT TRUNCATED DUE TO EXCESSIVE LENGTH & SUMMARIZATION ERROR]...`;
  }
};

const makeApiCall = async (
  ai: GoogleGenAI,
  file: GeminiFilePayload,
  prompt: string,
  schema: Record<string, unknown>
) => {
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  let finalPrompt = prompt;

  if (file.isText) {
    const processedContent = await summarizeTextIfNeeded(ai, file.data, `File (${file.name})`, MAX_TEXT_CHARS);
    finalPrompt += `\n\n## File Content: ${file.name} ##\n${processedContent}\n`;
  } else {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.type,
      },
    });
    finalPrompt += `\n\n## File: ${file.name} ##\nThe data is provided in the attached file. Please analyze its content based on the instructions.`;
  }

  parts.unshift({ text: finalPrompt });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.2,
    },
  });

  const jsonText = response.text.trim();
  const cleanedJson = jsonText.replace(/^```json\s*|```$/g, "");
  return JSON.parse(cleanedJson);
};

export const createGeminiProxyMiddleware = () => {
  return async (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
    if (!req.url || !req.url.startsWith("/api/gemini")) {
      next();
      return;
    }

    if (req.method !== "POST") {
      sendError(res, 405, "Method not allowed.", false);
      return;
    }

    let payload: GeminiProxyRequest;
    try {
      const body = await readRequestBody(req);
      payload = JSON.parse(body) as GeminiProxyRequest;
    } catch (error) {
      sendError(res, 400, "Invalid JSON payload.", false);
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = getClient();
    } catch (error) {
      sendError(res, 500, "Server is missing GEMINI_API_KEY configuration.", false);
      return;
    }

    try {
      if (payload.type === "analyze") {
        if (!payload.file || !payload.prompt || !payload.schema) {
          sendError(res, 400, "Missing required analyze payload fields.", false);
          return;
        }

        const schema = schemaMap[payload.schema];
        if (!schema) {
          sendError(res, 400, "Unsupported schema requested.", false);
          return;
        }

        const data = await makeApiCall(ai, payload.file, payload.prompt, schema);
        sendJson(res, 200, { data });
        return;
      }

      if (payload.type === "chat") {
        if (!payload.systemInstruction || !payload.contents) {
          sendError(res, 400, "Missing required chat payload fields.", false);
          return;
        }

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: payload.contents,
          config: {
            systemInstruction: payload.systemInstruction,
            temperature: 0.2,
          },
        });

        sendJson(res, 200, { text: response.text });
        return;
      }

      sendError(res, 400, "Unsupported request type.", false);
    } catch (error) {
      console.error("Gemini proxy error:", error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const isRetryable =
        message.includes("internal") ||
        message.includes("server") ||
        message.includes("500") ||
        message.includes("network");
      sendError(
        res,
        500,
        "The AI service failed to process the request. Please try again.",
        isRetryable
      );
    }
  };
};
