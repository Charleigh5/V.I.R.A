import React from 'react';

// Individual SVG icon components with `currentColor` for flexible styling
const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
);

const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
);

const PdfIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm2 4a1 1 0 100 2h4a1 1 0 100-2H6zm0 4a1 1 0 100 2h2a1 1 0 100-2H6zm10-4a1 1 0 00-1-1h-2a1 1 0 100 2h2a1 1 0 001-1z" clipRule="evenodd" /></svg>
);

const SpreadsheetIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 2v2h12V5H4zm0 4v2h4v-2H4zm6 0v2h6v-2h-6zm-6 4v2h4v-2H4zm6 0v2h6v-2h-6z" /></svg>
);

const MarkdownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm11.293 2.293a1 1 0 00-1.414 0L9 9.586V7a1 1 0 10-2 0v5a1 1 0 001 1h5a1 1 0 100-2H9.586l2.707-2.707a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
);

const EmailIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
);


interface FileTypeIconProps {
  fileName: string;
  className?: string;
}

const FileTypeIcon: React.FC<FileTypeIconProps> = ({ fileName, className }) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (/\.(jpg|jpeg|png|tiff|gif|bmp|svg|webp)$/i.test(`.${extension}`)) {
    return <ImageIcon className={className} />;
  }

  switch (extension) {
    case 'md':
      return <MarkdownIcon className={className} />;
    case 'pdf':
      return <PdfIcon className={className} />;
    case 'csv':
    case 'xls':
    case 'xlsx':
      return <SpreadsheetIcon className={className} />;
    case 'eml':
      return <EmailIcon className={className} />;
    case 'doc':
    case 'docx':
    case 'txt':
    case 'json':
    case 'html':
    case 'ppt':
        return <DocumentIcon className={className} />;
    default:
      return <DocumentIcon className={className} />;
  }
};

export default FileTypeIcon;