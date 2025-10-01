import React, { useState, useEffect, useMemo } from 'react';
import { ActionItem, TaskStatus, TaskPriority, ConversationNode } from '../types';
import Badge from './ui/Badge';
import Button from './ui/Button';
import EditActionItemModal from './EditActionItemModal';

interface ActionItemsViewProps {
  actionItems: ActionItem[];
  onUpdateActionItem: (item: ActionItem) => void;
  conversationNodes: ConversationNode[];
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
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error("Invalid date string:", dateString, error);
    return dateString;
  }
};


const ActionItemCard: React.FC<{ item: ActionItem; onEdit: (item: ActionItem) => void; sourceNode?: ConversationNode; }> = ({ item, onEdit, sourceNode }) => {
  const [isCompleted, setIsCompleted] = useState(item.status === TaskStatus.DONE);

  useEffect(() => {
    setIsCompleted(item.status === TaskStatus.DONE);
  }, [item.status]);

  const handleToggle = () => {
    setIsCompleted(!isCompleted);
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
            <div className="pr-4">
                <p className={`font-semibold text-neutral-800 ${isCompleted ? 'line-through' : ''}`}>{item.subject}</p>
                <p className="text-sm text-neutral-600 mt-1">{item.description}</p>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
                {sourceNode && (
                    <div className="relative group text-primary-blue cursor-help">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                           <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                           <p className="font-bold border-b border-neutral-600 pb-1 mb-1">Source Conversation:</p>
                           <p className="italic">"{sourceNode.summary}"</p>
                           <p className="text-right text-neutral-400 mt-1">- {sourceNode.speaker_name}</p>
                           <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-neutral-800"></div>
                       </div>
                    </div>
                )}
                <Button variant="tertiary" className="px-2 py-1 text-xs" onClick={() => onEdit(item)}>
                  Edit
                </Button>
            </div>
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


const ActionItemsView: React.FC<ActionItemsViewProps> = ({ actionItems, onUpdateActionItem, conversationNodes }) => {
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const handleEditClick = (item: ActionItem) => {
    setEditingItem(item);
  };

  const handleCloseModal = () => {
    setEditingItem(null);
  };

  const handleSaveChanges = (updatedItem: ActionItem) => {
    onUpdateActionItem(updatedItem);
    setEditingItem(null);
  };

  const conversationNodeMap = useMemo(() => 
    new Map(conversationNodes.map(node => [node.node_id, node])), 
    [conversationNodes]
  );

  const filteredItems = useMemo(() => {
    return actionItems.filter(item => {
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      const priorityMatch = priorityFilter === 'all' || item.priority === priorityFilter;
      const assigneeMatch = assigneeFilter.trim() === '' || item.assigned_to_name.toLowerCase().includes(assigneeFilter.toLowerCase().trim());
      return statusMatch && priorityMatch && assigneeMatch;
    });
  }, [actionItems, statusFilter, priorityFilter, assigneeFilter]);

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
            <ActionItemCard 
              key={item.id} 
              item={item} 
              onEdit={handleEditClick} 
              sourceNode={item.sourceConversationNodeId ? conversationNodeMap.get(item.sourceConversationNodeId) : undefined}
            />
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
