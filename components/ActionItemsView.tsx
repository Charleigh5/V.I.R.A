import React, { useState, useEffect, useMemo } from 'react';
import { ActionItem, TaskStatus, TaskPriority } from '../types';
import Badge from './ui/Badge';
import Button from './ui/Button';
import EditActionItemModal from './EditActionItemModal';

interface ActionItemsViewProps {
  actionItems: ActionItem[];
}

const getPriorityClass = (priority: TaskPriority) => {
  switch (priority) {
    case TaskPriority.High: return 'border-l-accent-red';
    case TaskPriority.Normal: return 'border-l-accent-yellow';
    case TaskPriority.Low: return 'border-l-accent-green';
    default: return 'border-l-neutral-300';
  }
};

const getStatusBadgeColor = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.DONE: return 'green';
        case TaskStatus.IN_PROGRESS:
        case TaskStatus.InProcess:
        case TaskStatus.TODO:
             return 'yellow';
        case TaskStatus.BLOCKED: return 'red';
        default: return 'gray';
    }
}

const formatDate = (dateString: string): string => {
  if (!dateString) {
    return 'No date';
  }
  try {
    // Appending 'T00:00:00' treats the date string as being in the local timezone,
    // which prevents the date from being off by one day due to UTC conversion.
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error("Invalid date string:", dateString, error);
    return dateString; // Fallback to the original string if it's invalid
  }
};


const ActionItemCard: React.FC<{ item: ActionItem; onEdit: (item: ActionItem) => void; }> = ({ item, onEdit }) => {
  const [isCompleted, setIsCompleted] = useState(item.status === TaskStatus.DONE);

  useEffect(() => {
    setIsCompleted(item.status === TaskStatus.DONE);
  }, [item.status]);

  const handleToggle = () => {
    setIsCompleted(!isCompleted);
    // Here you would typically also update the state in the parent component/backend
  };

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${getPriorityClass(item.priority)} transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-start">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={handleToggle}
          className="h-5 w-5 rounded border-gray-300 text-primary-blue focus:ring-primary-blue mt-1 cursor-pointer"
        />
        <div className="ml-4 flex-1">
          <div className="flex justify-between items-start">
            <div>
                <p className={`font-semibold text-neutral-800 ${isCompleted ? 'line-through' : ''}`}>{item.subject}</p>
                <p className="text-sm text-neutral-600 mt-1">{item.description}</p>
            </div>
            <Button variant="tertiary" className="px-2 py-1 text-xs -mr-2 flex-shrink-0" onClick={() => onEdit(item)}>
              Edit
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-neutral-500">
            <Badge color={getStatusBadgeColor(item.status)}>{item.status}</Badge>
            <Badge color="gray">{item.priority} Priority</Badge>
            <span className="inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Due: {formatDate(item.due_date)}
            </span>
            <span>Assigned: {item.assigned_to_name}</span>
            <span>Type: {item.task_types}</span>
            {item.hours_remaining !== undefined && <span>{item.hours_remaining} hrs left</span>}
          </div>
        </div>
      </div>
    </div>
  );
};


const ActionItemsView: React.FC<ActionItemsViewProps> = ({ actionItems }) => {
  const [items, setItems] = useState<ActionItem[]>(actionItems);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  useEffect(() => {
    setItems(actionItems);
  }, [actionItems]);

  const handleEditClick = (item: ActionItem) => {
    setEditingItem(item);
  };

  const handleCloseModal = () => {
    setEditingItem(null);
  };

  const handleSaveChanges = (updatedItem: ActionItem) => {
    setItems(currentItems => currentItems.map(i => (i.id === updatedItem.id ? updatedItem : i)));
    setEditingItem(null);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      const priorityMatch = priorityFilter === 'all' || item.priority === priorityFilter;
      const assigneeMatch = assigneeFilter.trim() === '' || item.assigned_to_name.toLowerCase().includes(assigneeFilter.toLowerCase().trim());
      return statusMatch && priorityMatch && assigneeMatch;
    });
  }, [items, statusFilter, priorityFilter, assigneeFilter]);

  const handleClearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('');
  };

  return (
    <div className="p-6">
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-neutral-700">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm"
            >
              <option value="all">All Statuses</option>
              {Object.values(TaskStatus).map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="priority-filter" className="block text-sm font-medium text-neutral-700">Priority</label>
            <select
              id="priority-filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm"
            >
              <option value="all">All Priorities</option>
              {Object.values(TaskPriority).map(priority => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="assignee-filter" className="block text-sm font-medium text-neutral-700">Assignee</label>
            <input
              type="text"
              id="assignee-filter"
              placeholder="Filter by name..."
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm"
            />
          </div>
          
          <Button variant="secondary" onClick={handleClearFilters}>
            Clear Filters
          </Button>

        </div>
      </div>
      
      <div className="space-y-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <ActionItemCard key={item.id} item={item} onEdit={handleEditClick} />
          ))
        ) : (
          <div className="text-center py-10 bg-white rounded-lg shadow-sm">
            <p className="text-neutral-500">No action items match the current filters.</p>
          </div>
        )}
      </div>
      {editingItem && (
        <EditActionItemModal
          isOpen={!!editingItem}
          onClose={handleCloseModal}
          onSave={handleSaveChanges}
          item={editingItem}
        />
      )}
    </div>
  );
};

export default ActionItemsView;