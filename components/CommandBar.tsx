import React, { useState, useCallback, useRef, useMemo } from 'react';
import Button from './ui/Button';
import {
  MAX_MD_FILES,
  MAX_EMAIL_FILES,
  MAX_IMAGE_FILES,
  MAX_TEXT_FILE_SIZE_MB,
  MAX_IMAGE_FILE_SIZE_MB,
  MAX_TEXT_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_CSV_FILE_SIZE_MB,
  MAX_CSV_FILE_SIZE_BYTES,
  isMdFile,
  isEmailFile,
  isImageFile
} from '../utils/validation';

interface CommandBarProps {
  onSubmit: (text: string, files: File[]) => void;
  isProcessing: boolean;
}

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 flex-shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PendingIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 flex-shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="9" />
    </svg>
);

const CommandBar: React.FC<CommandBarProps> = ({ onSubmit, isProcessing }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSalesforceFile = useMemo(() => files.some(isMdFile), [files]);
  const hasEmailFile = useMemo(() => files.some(isEmailFile), [files]);
  const hasImageFiles = useMemo(() => files.some(isImageFile), [files]);


  const handleSubmit = () => {
    if (isProcessing || (!text.trim() && files.length === 0)) return;
    onSubmit(text, files);
    setText('');
    setFiles([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const validateAndAddFiles = (newFiles: File[]) => {
    setUploadError(null);
    const errors: string[] = [];

    // Create a combined list to check future state against limits
    const prospectiveFiles = [...files, ...newFiles];

    // Check counts
    if (prospectiveFiles.filter(isMdFile).length > MAX_MD_FILES) {
        errors.push(`• You can only upload ${MAX_MD_FILES} Salesforce (.md) file.`);
    }
    if (prospectiveFiles.filter(isEmailFile).length > MAX_EMAIL_FILES) {
        errors.push(`• You can only upload ${MAX_EMAIL_FILES} email thread file.`);
    }
    if (prospectiveFiles.filter(isImageFile).length > MAX_IMAGE_FILES) {
        errors.push(`• You can upload a maximum of ${MAX_IMAGE_FILES} images.`);
    }

    // Check individual new files for size, type, and duplication
    for (const file of newFiles) {
        if (files.some(f => f.name === file.name)) {
            // This check can be skipped if we allow replacing, but for now, we prevent duplicates
            continue; // Don't add an error for a file that's already there from a previous batch
        }
        if (isMdFile(file) || isEmailFile(file)) {
            const isCsv = file.name.toLowerCase().endsWith('.csv');
            const limit = isCsv ? MAX_CSV_FILE_SIZE_BYTES : MAX_TEXT_FILE_SIZE_BYTES;
            const limitMb = isCsv ? MAX_CSV_FILE_SIZE_MB : MAX_TEXT_FILE_SIZE_MB;
            if (file.size > limit) {
                errors.push(`• File "${file.name}" is too large (max ${limitMb}MB).`);
            }
        } else if (isImageFile(file)) {
            if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
                errors.push(`• Image "${file.name}" is too large (max ${MAX_IMAGE_FILE_SIZE_MB}MB).`);
            }
        } else {
            errors.push(`• Unsupported file type: "${file.name}".`);
        }
    }

    if (errors.length > 0) {
        setUploadError(errors.join('\n'));
        setTimeout(() => setUploadError(null), 7000); // Error is visible for 7 seconds
        return; // Do not add any files if any file in the batch is invalid
    }
    
    // Add only unique new files
    const uniqueNewFiles = newFiles.filter(nf => !files.some(ef => ef.name === nf.name));
    setFiles(prev => [...prev, ...uniqueNewFiles]);
  };
  
  const handleFileChange = (selectedFiles: FileList | null) => {
      if (selectedFiles) {
          validateAndAddFiles(Array.from(selectedFiles));
      }
  };

  const onDragEvent = (e: React.DragEvent<HTMLDivElement>, type: 'enter' | 'leave' | 'over') => {
      e.preventDefault();
      e.stopPropagation();
      if (type === 'enter' || type === 'over') {
        if (uploadError) setUploadError(null);
        setIsDragging(true);
      }
      else if (type === 'leave') setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
      onDragEvent(e, 'leave');
      validateAndAddFiles(Array.from(e.dataTransfer.files));
  };
  
  const removeFile = (fileName: string) => {
      setFiles(files.filter(f => f.name !== fileName));
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-10">
      <div 
        className={`relative border-2 ${isDragging ? 'border-primary-blue' : 'border-transparent'} rounded-lg transition-all`}
        onDragEnter={(e) => onDragEvent(e, 'enter')}
      >
        {isDragging && (
           <div className="absolute inset-0 bg-blue-50 bg-opacity-95 flex items-center justify-center rounded-lg pointer-events-none z-20">
             <div className="text-center p-6 bg-white/60 rounded-lg shadow-lg backdrop-blur-sm">
                 <h3 className="text-lg font-bold text-primary-blue">Upload Project Files</h3>
                 <p className="text-sm text-neutral-600 mt-1">Drop required files to get started.</p>
                 <ul className="mt-4 space-y-2 text-left text-sm font-medium">
                     <li className={`flex items-center transition-colors ${hasSalesforceFile ? 'text-accent-green' : 'text-neutral-500'}`}>
                         {hasSalesforceFile ? <CheckIcon /> : <PendingIcon />}
                         Salesforce Data (.md)
                     </li>
                     <li className={`flex items-center transition-colors ${hasEmailFile ? 'text-accent-green' : 'text-neutral-500'}`}>
                         {hasEmailFile ? <CheckIcon /> : <PendingIcon />}
                         Email Thread (.txt, .eml, .csv)
                     </li>
                     <li className={`flex items-center transition-colors ${hasImageFiles ? 'text-accent-green' : 'text-neutral-500'}`}>
                         {hasImageFiles ? <CheckIcon /> : <PendingIcon />}
                         Images (Optional)
                     </li>
                 </ul>
             </div>
           </div>
        )}
        <div 
            className="bg-neutral-100 p-2 rounded-lg"
            onDragOver={(e) => onDragEvent(e, 'over')}
            onDragLeave={(e) => onDragEvent(e, 'leave')}
            onDrop={onDrop}
        >
            <div className="flex gap-2 mb-2">
                <Button variant="secondary" className="text-xs px-2 py-1">Enhance assignee lookup</Button>
                <Button variant="secondary" className="text-xs px-2 py-1">Filter action items</Button>
                <Button variant="secondary" className="text-xs px-2 py-1">Add task type filter</Button>
                <div className="flex-grow"></div>
                <Button variant="secondary" className="text-xs px-2 py-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8v0a8 8 0 018 8v0a8 8 0 01-8 8v0a8 8 0 01-8-8v0z" /></svg>
                    Restore checkpoint
                </Button>
            </div>
            
            {(files.length > 0 || uploadError) && (
                <div className="p-2 border-t border-neutral-200">
                    {files.length > 0 && 
                        <div className="flex flex-wrap gap-2">
                            {files.map(file => (
                                <div key={file.name} className="bg-blue-100 text-primary-blue text-xs font-medium px-2 py-1 rounded-full flex items-center">
                                    <span>{file.name}</span>
                                    <button onClick={() => removeFile(file.name)} className="ml-2 text-primary-blue hover:text-blue-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    }
                     {uploadError && (
                        <div className="mt-2 text-xs text-accent-red whitespace-pre-wrap bg-red-50 p-2 rounded-md">
                            {uploadError}
                        </div>
                    )}
                </div>
            )}

            <div className="relative flex items-center">
                <button className="p-2 text-neutral-500 hover:text-primary-blue" aria-label="Use Microphone">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Make changes, add new features, ask for anything..."
                    className="flex-grow bg-transparent focus:outline-none resize-none text-sm p-2"
                    rows={1}
                    disabled={isProcessing}
                />
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files)}
                    // Added accept attribute for better user experience
                    accept=".md,.txt,.eml,.csv,image/*"
                />
                 <button onClick={() => fileInputRef.current?.click()} className="p-2 text-neutral-500 hover:text-primary-blue" aria-label="Attach files">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <button onClick={handleSubmit} disabled={isProcessing || (!text.trim() && files.length === 0)} className="p-2 text-neutral-500 hover:text-primary-blue disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Send message">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                </button>
            </div>
        </div>
      </div>
    </footer>
  );
};

export default CommandBar;