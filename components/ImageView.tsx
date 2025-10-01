import React, { useState, useRef } from 'react';
import { ProjectImage, ImportedImageDetails, BoundingBox, AnalyzedDetail } from '../types';
import Modal from './ui/Modal';

interface ImageViewProps {
  images: ProjectImage[];
}

const CorrectedIcon: React.FC<{ originalText: string; confidence?: number }> = ({ originalText, confidence }) => (
    <div className="relative inline-block ml-1 group">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary-blue" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-neutral-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
            Original: "{originalText}"
            {typeof confidence === 'number' && <span className="block mt-1 pt-1 border-t border-neutral-600">Confidence: {(confidence * 100).toFixed(0)}%</span>}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-neutral-800"></div>
        </div>
    </div>
);

const ConfidenceIndicator: React.FC<{ score?: number }> = ({ score }) => {
    if (typeof score !== 'number') return null;

    const getColor = () => {
        if (score > 0.9) return 'bg-accent-green';
        if (score > 0.7) return 'bg-accent-yellow';
        return 'bg-accent-red';
    };

    return (
        <div className="relative group flex items-center">
            <div className={`w-2.5 h-2.5 rounded-full ${getColor()}`} />
            <div className="absolute left-full ml-2 w-max p-1.5 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Confidence: {(score * 100).toFixed(0)}%
            </div>
        </div>
    );
};


const ImageView: React.FC<ImageViewProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [highlightedBox, setHighlightedBox] = useState<BoundingBox | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const renderDetails = (details: ImportedImageDetails) => {
    const detailCategories: {
        'Extracted Text': AnalyzedDetail[] | undefined;
        'Detected Objects': AnalyzedDetail[] | undefined;
        'Part Numbers': string[] | undefined;
        'People': string[] | undefined;
    } = {
        'Extracted Text': details.extractedText,
        'Detected Objects': details.detectedObjects,
        'Part Numbers': details.partNumbers,
        'People': details.people,
    };

    const entries = Object.entries(detailCategories).filter(
      ([, values]) => values && values.length > 0
    );

    if (entries.length === 0) {
        return <p className="text-sm text-neutral-500 mt-1">No specific details were selected for import.</p>;
    }

    return (
        <div className="space-y-3">
            {entries.map(([category, values]) => (
                <div key={category}>
                    <h5 className="font-semibold text-xs text-neutral-500 uppercase tracking-wider">{category}</h5>
                    <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600 mt-1 bg-neutral-100 p-3 rounded-md">
                        {values!.map((detail, i) => {
                            if (typeof detail === 'string') {
                                return <li key={i}>{detail}</li>;
                            }
                            const displayText = detail.correctedText ?? detail.text;
                            return (
                                <li 
                                    key={i}
                                    onMouseEnter={() => setHighlightedBox(detail.boundingBox)}
                                    onMouseLeave={() => setHighlightedBox(null)}
                                    className="cursor-pointer hover:bg-blue-100 rounded p-1 -m-1 flex items-center gap-2"
                                >
                                    <ConfidenceIndicator score={detail.confidence} />
                                    <span>{displayText}</span>
                                    {detail.correctedText && <CorrectedIcon originalText={detail.text} confidence={detail.confidence} />}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
    setHighlightedBox(null);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Image Library & Reports</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.map((image) => (
          <div
            key={image.fileName}
            className="group relative cursor-pointer aspect-w-1 aspect-h-1"
            onClick={() => setSelectedImage(image)}
          >
            <img
              src={image.base64Data}
              alt={image.fileName}
              className="w-full h-full object-cover rounded-lg shadow-md group-hover:shadow-xl group-hover:opacity-80 transition-all"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                <p className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs p-2 text-center">{image.fileName}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedImage && (
        <Modal isOpen={!!selectedImage} onClose={handleCloseModal} title="Image Details & Report">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/2 relative" ref={imageContainerRef}>
                    <img src={selectedImage.base64Data} alt={selectedImage.fileName} className="rounded-lg w-full object-contain max-h-96" />
                    {highlightedBox && imageContainerRef.current && (
                      <div
                        className="absolute border-2 border-primary-blue bg-primary-blue bg-opacity-30 rounded-sm pointer-events-none transition-all duration-150"
                        style={{
                          left: `${highlightedBox.x1 * imageContainerRef.current.offsetWidth}px`,
                          top: `${highlightedBox.y1 * imageContainerRef.current.offsetHeight}px`,
                          width: `${(highlightedBox.x2 - highlightedBox.x1) * imageContainerRef.current.offsetWidth}px`,
                          height: `${(highlightedBox.y2 - highlightedBox.y1) * imageContainerRef.current.offsetHeight}px`,
                        }}
                      />
                    )}
                </div>
                <div className="md:w-1/2 space-y-4 max-h-96 overflow-y-auto pr-2">
                    <h3 className="font-bold text-lg text-neutral-800">{selectedImage.fileName}</h3>
                    <div>
                        <h4 className="font-semibold text-neutral-700">AI Summary</h4>
                        <p className="text-sm text-neutral-600 bg-neutral-100 p-3 rounded-md mt-1">{selectedImage.report.summary}</p>
                    </div>
                     <div>
                        <h4 className="font-semibold text-neutral-700 mb-2">Imported Details</h4>
                        {renderDetails(selectedImage.report.importedDetails)}
                    </div>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default ImageView;