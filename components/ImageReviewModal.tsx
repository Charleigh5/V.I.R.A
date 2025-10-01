import React, { useState, useMemo } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import { RawImageAnalysis, ProjectImage, ImportedImageDetails, AnalyzedDetail } from '../types';

interface ImageReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResults: RawImageAnalysis[];
  onConfirm: (finalImages: ProjectImage[]) => void;
}

const ImageAnalysisCard: React.FC<{
    result: RawImageAnalysis;
    selections: Record<string, boolean>;
    onSelectionChange: (key: string, value: boolean) => void;
}> = ({ result, selections, onSelectionChange }) => {
    
    const renderDetailCheckboxes = (items: AnalyzedDetail[], type: string) => {
        return items.map((item, index) => {
            const key = `${result.fileName}-${type}-${index}`;
            return (
                <Checkbox
                    key={key}
                    label={item.text}
                    checked={selections[key] || false}
                    onChange={(e) => onSelectionChange(key, e.target.checked)}
                />
            );
        });
    };

    const renderStringCheckboxes = (items: string[], type: string) => {
        return items.map((item, index) => {
            const key = `${result.fileName}-${type}-${index}`;
            return (
                <Checkbox
                    key={key}
                    label={item}
                    checked={selections[key] || false}
                    onChange={(e) => onSelectionChange(key, e.target.checked)}
                />
            );
        });
    };

    return (
        <div className="border border-neutral-200 rounded-lg p-4 flex gap-4">
            <img src={result.base64Data} alt={result.fileName} className="w-48 h-48 object-contain rounded border bg-neutral-100" />
            <div className="flex-1 space-y-3 overflow-y-auto max-h-48 pr-2">
                <p className="text-sm text-neutral-600"><strong>Summary:</strong> {result.summary}</p>
                {result.extractedText.length > 0 && <div><h4 className="font-semibold text-sm">Extracted Text</h4>{renderDetailCheckboxes(result.extractedText, 'text')}</div>}
                {result.detectedObjects.length > 0 && <div><h4 className="font-semibold text-sm">Detected Objects</h4>{renderDetailCheckboxes(result.detectedObjects, 'object')}</div>}
                {result.partNumbers.length > 0 && <div><h4 className="font-semibold text-sm">Part Numbers</h4>{renderStringCheckboxes(result.partNumbers, 'part')}</div>}
                {result.people.length > 0 && <div><h4 className="font-semibold text-sm">People</h4>{renderStringCheckboxes(result.people, 'people')}</div>}
            </div>
        </div>
    );
};


const ImageReviewModal: React.FC<ImageReviewModalProps> = ({ isOpen, onClose, analysisResults, onConfirm }) => {
  const [selections, setSelections] = useState<Record<string, boolean>>({});

  const handleSelectionChange = (key: string, value: boolean) => {
    setSelections(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    const finalImages: ProjectImage[] = analysisResults.map(result => {
        const importedDetails: ImportedImageDetails = {};

        const processDetailSelections = (items: AnalyzedDetail[], type: string, keyName: keyof ImportedImageDetails) => {
            const selectedItems = items.filter((_, index) => selections[`${result.fileName}-${type}-${index}`]);
            if (selectedItems.length > 0) {
                 (importedDetails[keyName] as AnalyzedDetail[] | undefined) = selectedItems;
            }
        };

        const processStringSelections = (items: string[], type: string, keyName: keyof ImportedImageDetails) => {
             const selectedItems = items.filter((_, index) => selections[`${result.fileName}-${type}-${index}`]);
            if (selectedItems.length > 0) {
                (importedDetails[keyName] as string[] | undefined) = selectedItems;
            }
        };

        processDetailSelections(result.extractedText, 'text', 'extractedText');
        processDetailSelections(result.detectedObjects, 'object', 'detectedObjects');
        processStringSelections(result.partNumbers, 'part', 'partNumbers');
        processStringSelections(result.people, 'people', 'people');
        
        return {
            fileName: result.fileName,
            base64Data: result.base64Data, // This is an object URL, handle appropriately if you need to re-upload
            report: {
                summary: result.summary,
                importedDetails: importedDetails,
            }
        };
    });

    onConfirm(finalImages);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Image Analysis">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
        <p className="text-sm text-neutral-600">The AI has analyzed the images. Select the key elements you want to import into the project report.</p>
        {analysisResults.map(result => (
          <ImageAnalysisCard 
            key={result.fileName}
            result={result}
            selections={selections}
            onSelectionChange={handleSelectionChange}
          />
        ))}
      </div>
      <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" onClick={handleConfirm}>Create Project</Button>
      </div>
    </Modal>
  );
};

export default ImageReviewModal;