import React, { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { ConversationNode, ActionItem } from '../types';

interface ConversationNodeDetailModalProps {
  node: ConversationNode;
  onClose: () => void;
  allActionItems: ActionItem[];
  onCreateActionItem: (initialData: Partial<ActionItem>) => void;
  onLinkActionItem: (actionItemId: string, nodeId: number) => void;
}

const formatDate = (isoString: string) => {
    try {
        return new Date(isoString).toLocaleString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch {
        return "Invalid Date";
    }
};

const ConversationNodeDetailModal: React.FC<ConversationNodeDetailModalProps> = ({ node, onClose, allActionItems, onCreateActionItem, onLinkActionItem }) => {
  const [selectedActionItemId, setSelectedActionItemId] = useState('');
        
  const linkableActionItems = allActionItems.filter(item => !item.sourceConversationNodeId);

  const handleCreate = () => {
      onCreateActionItem({
          subject: `Follow-up on: "${node.summary.substring(0, 40)}..."`,
          description: `Based on conversation point from ${node.speaker_name} at ${formatDate(node.timestamp)}:\n\n"${node.summary}"`,
          sourceConversationNodeId: node.node_id,
      });
      onClose();
  };

  const handleLink = () => {
      if (!selectedActionItemId) return;
      onLinkActionItem(selectedActionItemId, node.node_id);
      onClose();
  };
  
  return (
    <Modal isOpen={!!node} onClose={onClose} title="Conversation Detail">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Speaker</h3>
          <p className="text-lg font-semibold text-neutral-800">{node.speaker_name}</p>
          <p className="text-sm text-neutral-600">{node.speaker_email}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Timestamp</h3>
          <p className="text-neutral-700">{formatDate(node.timestamp)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Summary</h3>
          <p className="text-neutral-700 bg-neutral-100 p-3 rounded-md">{node.summary}</p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t">
        <h3 className="text-sm font-medium text-neutral-500 mb-2">Link to Existing Action Item</h3>
        {linkableActionItems.length > 0 ? (
            <div className="flex items-center gap-2">
                <select
                    value={selectedActionItemId}
                    onChange={(e) => setSelectedActionItemId(e.target.value)}
                    className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue sm:text-sm bg-white"
                    aria-label="Select a task to link"
                >
                    <option value="">Select a task to link...</option>
                    {linkableActionItems.map(item => (
                        <option key={item.id} value={item.id}>{item.subject}</option>
                    ))}
                </select>
                <Button variant="secondary" onClick={handleLink} disabled={!selectedActionItemId}>
                    Link
                </Button>
            </div>
        ) : (
            <p className="text-sm text-neutral-500 italic">All existing action items are already linked.</p>
        )}
      </div>

      <div className="mt-6 pt-4 border-t flex justify-between items-center">
        <Button variant="primary" onClick={handleCreate}>
          Create New Action Item
        </Button>
        <Button variant="tertiary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default ConversationNodeDetailModal;