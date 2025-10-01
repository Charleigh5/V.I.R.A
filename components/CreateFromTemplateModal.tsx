import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import RadioGroup from './ui/RadioGroup';
import { ProjectTemplate } from '../services/templates';

interface CreateFromTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (template: ProjectTemplate, projectName: string) => void;
  templates: ProjectTemplate[];
}

const CreateFromTemplateModal: React.FC<CreateFromTemplateModalProps> = ({ isOpen, onClose, onCreate, templates }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
      setSelectedTemplateId(templates.length > 0 ? templates[0].id : '');
      setProjectName('');
    }
  }, [isOpen, templates]);

  const handleCreate = () => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate || !projectName.trim()) {
      return;
    }
    onCreate(selectedTemplate, projectName.trim());
  };
  
  const radioOptions = templates.map(t => ({
      value: t.id,
      label: t.name,
      description: t.description,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Project from Template">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Select a Template
          </label>
          <RadioGroup
            options={radioOptions}
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
          />
        </div>
        <div>
           <label htmlFor="project-name" className="block text-sm font-medium text-neutral-700">
            Project Name
          </label>
          <input
            type="text"
            id="project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter a name for the new project"
            className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-4 mt-8 pt-4 border-t">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={!selectedTemplateId || !projectName.trim()}
        >
          Create Project
        </Button>
      </div>
    </Modal>
  );
};

export default CreateFromTemplateModal;
