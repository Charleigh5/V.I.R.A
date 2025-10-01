import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { ConversationNode } from '../types';

interface ConversationNodeDetailModalProps {
  node: ConversationNode;
  onClose: () => void;
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

const ConversationNodeDetailModal: React.FC<ConversationNodeDetailModalProps> = ({ node, onClose }) => {
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
      <div className="mt-6 pt-4 border-t flex justify-between items-center">
        <Button variant="secondary" onClick={() => {}} disabled>
          Link to Action Item
        </Button>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default ConversationNodeDetailModal;
