import React, { useState, useMemo, useEffect } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import { RawImageAnalysis, ProjectImage, ImportedImageDetails, AnalyzedDetail } from '../types';

const EditIcon: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-neutral-500 hover:text-primary-blue cursor-pointer" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
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
            <div className={`w-3 h-3 rounded-full ${getColor()}`} />
            <div className="absolute left-full ml-2 w-max p-1.5 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Confidence: {(score * 100).toFixed(0)}%
            </div>
        </div>
    );
};

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
    editedTexts: Record<string, string>;
    onTextEdit: (key: string, newText: string) => void;
}> = ({ result, selections, onSelectionChange, editedTexts, onTextEdit }) => {
    
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const handleEditStart = (key: string, currentText: string) => {
        setEditingKey(key);
        setEditText(editedTexts[key] ?? currentText);
    };

    const handleEditSave = () => {
        if (editingKey) {
            onTextEdit(editingKey, editText);
        }
        setEditingKey(null);
        setEditText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEditSave();
        } else if (e.key === 'Escape') {
            setEditingKey(null);
            setEditText('');
        }
    };

    const renderTextCheckboxes = (items: AnalyzedDetail[], type: string) => {
        return items.map((item, index) => {
            const key = `${result.fileName}-${type}-${index}`;
            const isEditing = editingKey === key;
            const correctedText = editedTexts[key];
            const displayText = correctedText ?? item.text;

            return (
                 <div key={key} className="flex items-center gap-2">
                    <Checkbox
                        label=""
                        checked={selections[key] || false}
                        onChange={(e) => onSelectionChange(key, e.target.checked)}
                    />
                    <ConfidenceIndicator score={item.confidence} />
                    {isEditing ? (
                        <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onBlur={handleEditSave}
                            onKeyDown={handleKeyDown}
                            className="text-sm border-primary-blue border rounded px-1 py-0.5 flex-grow"
                            autoFocus
                        />
                    ) : (
                        <span className="text-sm text-neutral-700 flex-grow" onDoubleClick={() => handleEditStart(key, item.text)}>
                            {displayText}
                            {correctedText && <span className="text-primary-blue ml-1" title={`Original: "${item.text}"`}>*</span>}
                        </span>
                    )}
                    {!isEditing && <EditIcon onClick={() => handleEditStart(key, item.text)} />}
                </div>
            );
        });
    };

    const renderObjectCheckboxes = (items: AnalyzedDetail[], type: string) => {
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
            <img src={result.base64Data} alt={result.fileName} className="w-48 h-48 object-contain rounded border bg-neutral-100 flex-shrink-0" />
            <div className="flex-1 space-y-3 overflow-y-auto max-h-48 pr-2">
                <p className="text-sm text-neutral-600"><strong>Summary:</strong> {result.summary}</p>
                {result.extractedText.length > 0 && <div><h4 className="font-semibold text-sm">Extracted Text <span className="font-normal text-xs text-neutral-500">(double-click text to edit)</span></h4><div className="space-y-1 mt-1">{renderTextCheckboxes(result.extractedText, 'text')}</div></div>}
                {result.detectedObjects.length > 0 && <div><h4 className="font-semibold text-sm">Detected Objects</h4>{renderObjectCheckboxes(result.detectedObjects, 'object')}</div>}
                {result.partNumbers.length > 0 && <div><h4 className="font-semibold text-sm">Part Numbers</h4>{renderStringCheckboxes(result.partNumbers, 'part')}</div>}
                {result.people.length > 0 && <div><h4 className="font-semibold text-sm">People</h4>{renderStringCheckboxes(result.people, 'people')}</div>}
            </div>
        </div>
    );
};


const ImageReviewModal: React.FC<ImageReviewModalProps> = ({ isOpen, onClose, analysisResults, onConfirm }) => {
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  
  // When modal is opened/closed or results change, reset local state
  useEffect(() => {
    if (isOpen) {
        setSelections({});
        setEditedTexts({});
    }
  }, [isOpen, analysisResults]);

  const handleSelectionChange = (key: string, value: boolean) => {
    setSelections(prev => ({ ...prev, [key]: value }));
  };
  
  const handleTextEdit = (key: string, newText: string) => {
      setEditedTexts(prev => ({...prev, [key]: newText }));
  };

  const handleBatchAction = (type: 'text' | 'object' | 'all', shouldSelect: boolean) => {
    const newSelections = { ...selections };
    analysisResults.forEach(result => {
        const processItems = (items: any[], itemType: string) => {
            items.forEach((_, index) => {
                const key = `${result.fileName}-${itemType}-${index}`;
                newSelections[key] = shouldSelect;
            });
        };
        
        if (type === 'text' || type === 'all') processItems(result.extractedText, 'text');
        if (type === 'object' || type === 'all') processItems(result.detectedObjects, 'object');
        if (type === 'all') {
             processItems(result.partNumbers, 'part');
             processItems(result.people, 'people');
        }
    });
    setSelections(newSelections);
  };


  const handleConfirm = () => {
    const finalImages: ProjectImage[] = analysisResults.map(result => {
        const importedDetails: ImportedImageDetails = {};

        const processDetailSelections = (items: AnalyzedDetail[], type: string, keyName: 'extractedText' | 'detectedObjects') => {
            const selectedItems = items
                .map((item, index) => {
                    const key = `${result.fileName}-${type}-${index}`;
                    if (!selections[key]) return null;
                    
                    // Create a new item to avoid mutating the original analysis data
                    const newItem = { ...item };
                    if (editedTexts[key]) {
                        newItem.correctedText = editedTexts[key];
                    }
                    return newItem;
                })
                .filter((item): item is AnalyzedDetail => item !== null);

            if (selectedItems.length > 0) {
                 importedDetails[keyName] = selectedItems;
            }
        };

        const processStringSelections = (items: string[], type: string, keyName: 'partNumbers' | 'people') => {
             const selectedItems = items.filter((_, index) => selections[`${result.fileName}-${type}-${index}`]);
            if (selectedItems.length > 0) {
                importedDetails[keyName] = selectedItems;
            }
        };

        processDetailSelections(result.extractedText, 'text', 'extractedText');
        processDetailSelections(result.detectedObjects, 'object', 'detectedObjects');
        processStringSelections(result.partNumbers, 'part', 'partNumbers');
        processStringSelections(result.people, 'people', 'people');
        
        return {
            fileName: result.fileName,
            base64Data: result.base64Data,
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
        
        <div className="p-2 bg-neutral-100 rounded-md border sticky top-0 z-10">
            <div className="flex flex-wrap gap-2 items-center">
                 <span className="text-sm font-semibold text-neutral-700 mr-2">Batch Actions:</span>
                <Button variant="tertiary" className="text-xs" onClick={() => handleBatchAction('text', true)}>Select All Text</Button>
                <Button variant="tertiary" className="text-xs" onClick={() => handleBatchAction('object', true)}>Select All Objects</Button>
                <div className="border-l h-5 mx-1"></div>
                <Button variant="secondary" className="text-xs" onClick={() => handleBatchAction('all', true)}>Select All</Button>
                <Button variant="secondary" className="text-xs" onClick={() => handleBatchAction('all', false)}>Deselect All</Button>
            </div>
        </div>

        {analysisResults.map(result => (
          <ImageAnalysisCard 
            key={result.fileName}
            result={result}
            selections={selections}
            onSelectionChange={handleSelectionChange}
            editedTexts={editedTexts}
            onTextEdit={handleTextEdit}
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