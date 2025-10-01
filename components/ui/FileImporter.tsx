import React, { useState, useRef, useEffect } from 'react';

// Icons for different states/file types
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
);
const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary-blue" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
);
const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary-blue" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
);


interface FileImporterProps {
  title: string;
  description: string;
  acceptedFileTypes: string;
  onFilesSelected: (files: File[]) => void;
  files: File[];
  onFileRemove: (fileName: string) => void;
  isMultiple?: boolean;
  className?: string;
  iconType?: 'file' | 'image';
}

const FileImporter: React.FC<FileImporterProps> = ({
  title,
  description,
  acceptedFileTypes,
  onFilesSelected,
  files,
  onFileRemove,
  isMultiple = false,
  className = '',
  iconType = 'file'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const importerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = importerRef.current;
    if (!element) return;

    const handlePaste = (event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length > 0) {
            event.preventDefault();
            onFilesSelected(isMultiple ? imageFiles : [imageFiles[0]]);
        }
    };
    
    element.addEventListener('paste', handlePaste);
    return () => {
        element.removeEventListener('paste', handlePaste);
    };
  }, [isMultiple, onFilesSelected]);


  const handleDragEvent = (e: React.DragEvent<HTMLDivElement>, type: 'enter' | 'leave' | 'over') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'enter' || type === 'over') {
      setIsDragging(true);
    } else if (type === 'leave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvent(e, 'leave');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
     // Reset the input value to allow re-uploading the same file
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div ref={importerRef} className={`flex flex-col rounded-lg border-2 border-dashed bg-neutral-100 p-6 text-center transition-all duration-200 ${isDragging ? 'border-primary-blue bg-blue-50' : 'border-neutral-300'} ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptedFileTypes}
        multiple={isMultiple}
        onChange={handleFileChange}
        className="hidden"
      />
      {files.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-full cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => handleDragEvent(e, 'enter')}
          onDragLeave={(e) => handleDragEvent(e, 'leave')}
          onDragOver={(e) => handleDragEvent(e, 'over')}
          onDrop={handleDrop}
        >
          <UploadIcon />
          <h3 className="mt-2 text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{description}</p>
          <p className="mt-1 text-xs text-neutral-500">
            or{' '}
            <span className="font-semibold text-primary-blue">paste from clipboard</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col justify-between h-full">
            <div>
                <h3 className="text-sm font-semibold text-neutral-900 text-left mb-2">{title}</h3>
                <div className="space-y-2">
                    {files.map(file => (
                        <div key={file.name} className="flex items-center justify-between text-left bg-white p-2 rounded-md border border-neutral-200">
                             <div className="flex items-center min-w-0">
                                {iconType === 'file' ? <FileIcon/> : <ImageIcon />}
                                <div className="ml-3 min-w-0">
                                    <p className="text-sm font-medium text-neutral-800 truncate" title={file.name}>{file.name}</p>
                                    <p className="text-xs text-neutral-500">{formatBytes(file.size)}</p>
                                </div>
                             </div>
                            <button onClick={() => onFileRemove(file.name)} className="ml-4 text-neutral-400 hover:text-accent-red flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            {isMultiple && (
                <button
                    onClick={() => inputRef.current?.click()}
                    className="mt-4 text-sm font-medium text-primary-blue hover:text-blue-700"
                >
                    + Add more files
                </button>
            )}
        </div>
      )}
    </div>
  );
};

export default FileImporter;