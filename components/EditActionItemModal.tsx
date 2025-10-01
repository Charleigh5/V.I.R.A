import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { ActionItem, TaskStatus, TaskPriority } from '../types';

interface EditActionItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ActionItem) => void;
  item: ActionItem;
}

const EditActionItemModal: React.FC<EditActionItemModalProps> = ({ isOpen, onClose, onSave, item }) => {
  const [formData, setFormData] = useState<ActionItem>(item);

  useEffect(() => {
    // Format date for the input[type=date] which expects 'YYYY-MM-DD'
    try {
        const date = new Date(item.due_date);
        const formattedDate = date.toISOString().split('T')[0];
        setFormData({...item, due_date: formattedDate});
    } catch (e) {
        // If date is invalid, just use the original value
        setFormData(item);
    }
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : Number(value) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Action Item">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-neutral-700">Subject</label>
          <input type="text" name="subject" id="subject" value={formData.subject} onChange={handleChange} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm" />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-neutral-700">Description</label>
          <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-neutral-700">Status</label>
            <select name="status" id="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm">
              {Object.values(TaskStatus).map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-neutral-700">Priority</label>
            <select name="priority" id="priority" value={formData.priority} onChange={handleChange} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm">
              {Object.values(TaskPriority).map(priority => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="due_date" className="block text-sm font-medium text-neutral-700">Due Date</label>
            <input type="date" name="due_date" id="due_date" value={formData.due_date} onChange={handleChange} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm" />
          </div>
          <div>
            <label htmlFor="assigned_to_name" className="block text-sm font-medium text-neutral-700">Assigned To</label>
            <input type="text" name="assigned_to_name" id="assigned_to_name" value={formData.assigned_to_name} onChange={handleChange} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="task_types" className="block text-sm font-medium text-neutral-700">Task Type</label>
            <input type="text" name="task_types" id="task_types" value={formData.task_types} onChange={handleChange} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm" />
          </div>
          <div>
            <label htmlFor="hours_remaining" className="block text-sm font-medium text-neutral-700">Hours Remaining</label>
            <input type="number" name="hours_remaining" id="hours_remaining" value={formData.hours_remaining ?? ''} onChange={handleNumberChange} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm" />
          </div>
        </div>
        <div className="flex justify-end space-x-4 pt-4 mt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditActionItemModal;