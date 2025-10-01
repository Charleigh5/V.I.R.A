import React, { useState, useCallback } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { analyzeProjectFiles } from '../services/geminiService';
import { SynthesizedProjectData } from '../types';
import { resizeAndCompressImage } from '../utils/imageUtils';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (
    data: SynthesizedProjectData,
    imageFiles: File[],
    projectName: string,
    sourceFiles: { salesforceFileNames: string[], emailFileNames: string[] }
  ) => void;
}

const fileReader = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const parseAndFormatCsv = (csvText: string): string => {
    // A more robust CSV parser that handles quoted newlines, escaped quotes, and mismatched column counts.
    const parseCsv = (text: string): { data: { [key: string]: string }[], error?: string } => {
        const lines = [];
        let currentLine = '';
        let inQuotes = false;
        
        // Normalize line endings to prevent issues with \r\n vs \n
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Split text into lines, respecting quotes. This is crucial for handling newlines within fields.
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                // Handle escaped quotes ("") by peeking ahead
                if (inQuotes && text[i + 1] === '"') {
                    currentLine += '"';
                    i++; // Skip the next quote character
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
        lines.push(currentLine); // Add the final line

        // The existing column parser is quite good, so we'll reuse it for each line.
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
        if (nonEmptyRows.length < 2) {
            return { data: [], error: "Invalid CSV: File must contain a header row and at least one data row." };
        }

        const headers = parseCsvRow(nonEmptyRows[0]).map(h => h.replace(/^"|"$/g, '').trim());
        const dataRows = nonEmptyRows.slice(1);
        const jsonData = [];

        for (let i = 0; i < dataRows.length; i++) {
            const rowValues = parseCsvRow(dataRows[i]);
            if (rowValues.length !== headers.length) {
                // Provide a specific error message if a row's column count doesn't match the header.
                return { data: [], error: `CSV Parse Error: Row ${i + 2} has ${rowValues.length} columns, but the header has ${headers.length}. Please check for issues like unquoted commas in your data.` };
            }
            const entry: { [key: string]: string } = {};
            headers.forEach((header, index) => {
                entry[header] = rowValues[index]?.replace(/^"|"$/g, '').trim() || '';
            });
            jsonData.push(entry);
        }

        return { data: jsonData };
    };

    const result = parseCsv(csvText);
    
    // If the parser returns an error, throw it so it can be caught and displayed to the user.
    if (result.error) {
        throw new Error(result.error);
    }

    const emailData = result.data;

    // Additional validation for expected email columns
    const requiredColumns = ['from', 'to', 'subject', 'body', 'timestamp'];
    if (emailData.length > 0) {
        const firstRowHeaders = Object.keys(emailData[0]);
        if (!requiredColumns.every(col => firstRowHeaders.includes(col))) {
             throw new Error("Invalid CSV format: The CSV must contain at least the following columns: 'from', 'to', 'subject', 'body', 'timestamp'.");
        }
    }
    
    // Format the parsed data into a string for the AI
    let formattedText = "--- Email Conversation from CSV ---\nThis email thread was parsed from a CSV file. The AI should verify any mentioned attachments against the Salesforce data.\n\n";
    emailData.forEach(email => {
        if (Object.values(email).some(v => v && v.trim() !== '')) {
            formattedText += `From: ${email.from || 'N/A'}\nTo: ${email.to || 'N/A'}\nDate: ${email.timestamp || 'N/A'}\nSubject: ${email.subject || 'N/A'}\n`;
            if (email.attachments && email.attachments.trim()) {
                formattedText += `Attachments: ${email.attachments}\n`;
            }
            formattedText += `\n${email.body || ''}\n---\n`;
        }
    });

    return formattedText;
};

const FileInput: React.FC<{
    label: string;
    files: File[];
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    accept: string;
    id: string;
}> = ({ label, files, onChange, accept, id }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700">{label}</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-neutral-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-neutral-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div className="flex text-sm text-neutral-600"><label htmlFor={id} className="relative cursor-pointer bg-white rounded-md font-medium text-primary-blue hover:text-blue-600"><span>Upload files</span><input id={id} name={id} type="file" className="sr-only" onChange={onChange} accept={accept} multiple /></label><p className="pl-1">or drag and drop</p></div>
                <div className="text-xs text-neutral-500 mt-2">
                    {files.length > 0 ? (
                        <ul className="text-left">{files.map(f => <li key={f.name} className="truncate">{f.name}</li>)}</ul>
                    ) : `Up to 10MB each`}
                </div>
            </div>
        </div>
    </div>
);


const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onAnalysisComplete }) => {
  const [projectName, setProjectName] = useState('');
  const [salesforceFiles, setSalesforceFiles] = useState<File[]>([]);
  const [emailFiles, setEmailFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ message: string; percentage: number } | null>(null);

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File[]>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setter(Array.from(e.target.files));
  };
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
     if (!projectName.trim()) {
        setError("Please enter a project name.");
        return;
    }
    const mdFile = salesforceFiles.find(f => f.name.endsWith('.md'));
    const textEmailFile = emailFiles.find(f => /\.(txt|eml|csv)$/i.test(f.name));

    if (!mdFile || !textEmailFile) {
      setError("Please provide one .md file for Salesforce and one .txt, .eml, or .csv file for the email thread.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setProgress({ message: 'Starting process...', percentage: 0 });

    try {
      const salesforceContent = await fileReader(mdFile);
      let emailContent = await fileReader(textEmailFile);
      if (textEmailFile.name.endsWith('.csv')) {
          emailContent = parseAndFormatCsv(emailContent);
      }
      
      const allImages = [
          ...salesforceFiles.filter(f => f.type.startsWith('image/')),
          ...emailFiles.filter(f => f.type.startsWith('image/'))
      ];

      const processedImages: File[] = [];
      const totalImages = allImages.length;
      // Allocate first 50% of progress to image processing
      for (let i = 0; i < totalImages; i++) {
        const imageFile = allImages[i];
        const percentage = ((i + 1) / totalImages) * 50;
        setProgress({ message: `Resizing image ${i + 1} of ${totalImages}...`, percentage });
        const processedImage = await resizeAndCompressImage(imageFile);
        processedImages.push(processedImage);
      }

      setProgress({ message: 'Condensing large text files...', percentage: 65 });
      const synthesizedData: SynthesizedProjectData = await analyzeProjectFiles(salesforceContent, emailContent, processedImages);
      
      setProgress({ message: 'Finalizing analysis...', percentage: 90 });
      const sourceFiles = {
          salesforceFileNames: salesforceFiles.map(f => f.name),
          emailFileNames: emailFiles.map(f => f.name),
      };

      onAnalysisComplete(synthesizedData, processedImages, projectName, sourceFiles);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [projectName, salesforceFiles, emailFiles, onAnalysisComplete]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-100 border border-accent-red text-accent-red px-4 py-3 rounded relative" role="alert">{error}</div>}
        
        <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-neutral-700">Project Name</label>
            <input
                type="text"
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm"
                placeholder="e.g., Q3 Marketing Campaign Analysis"
                required
            />
        </div>

        <FileInput 
          label="Salesforce Files (.md + images)"
          files={salesforceFiles}
          onChange={handleFileChange(setSalesforceFiles)}
          accept=".md,text/markdown,image/png,image/jpeg,image/webp"
          id="salesforce-files-input"
        />

        <FileInput 
          label="Email Thread Files (.txt, .eml, .csv + images)"
          files={emailFiles}
          onChange={handleFileChange(setEmailFiles)}
          accept=".txt,.eml,text/plain,.csv,image/png,image/jpeg,image/webp"
          id="email-files-input"
        />
        
        {isLoading && progress && (
            <div className="w-full">
                <p className="text-sm text-center text-neutral-600 mb-2">{progress.message}</p>
                <div className="w-full bg-neutral-200 rounded-full h-2.5">
                    <div 
                        className="bg-primary-blue h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                        style={{ width: `${progress.percentage}%` }}
                    ></div>
                </div>
            </div>
        )}

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" variant="primary" isLoading={isLoading} disabled={salesforceFiles.length === 0 || emailFiles.length === 0 || !projectName.trim()}>
            {isLoading ? 'Processing...' : 'Analyze Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateProjectModal;