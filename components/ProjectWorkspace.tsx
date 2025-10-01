import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import ActionItemsView from './ActionItemsView';
import ConversationMapView from './ConversationMapView';
import ImageView from './ImageView';

interface ProjectWorkspaceProps {
  project: Project;
  onBack: () => void;
}

type View = 'actions' | 'map' | 'images';

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ project, onBack }) => {
  const [activeView, setActiveView] = useState<View>('actions');
  const [searchQuery, setSearchQuery] = useState('');

  if (!project.data) {
    return (
      <div className="p-8 text-center">
        <p className="text-neutral-600">No data available for this project.</p>
        <button onClick={onBack} className="mt-4 text-primary-blue hover:underline">
          &larr; Back to Dashboard
        </button>
      </div>
    );
  }

  const { project_details, action_items, conversation_nodes, conversation_summary } = project.data;

  const filteredConversationNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversation_nodes;
    }
    return conversation_nodes.filter(node =>
      node.speaker_name.toLowerCase().includes(query) ||
      node.speaker_email.toLowerCase().includes(query) ||
      node.summary.toLowerCase().includes(query)
    );
  }, [searchQuery, conversation_nodes]);

  const NavItem: React.FC<{ view: View; label: string; disabled?: boolean }> = ({ view, label, disabled }) => (
    <button
      onClick={() => !disabled && setActiveView(view)}
      disabled={disabled}
      className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        activeView === view
          ? 'bg-primary-blue text-white'
          : 'text-neutral-700 hover:bg-neutral-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-neutral-100">
      <aside className="w-64 bg-white p-4 flex flex-col border-r border-neutral-200">
        <button onClick={onBack} className="mb-4 text-sm text-primary-blue hover:underline text-left">
          &larr; All Projects
        </button>
        <h2 className="text-lg font-bold text-neutral-900 truncate" title={project_details.project_name}>
          {project_details.project_name}
        </h2>
        <p className="text-xs text-neutral-500 mb-6">Opp. #{project_details.opportunity_number}</p>
        <nav className="space-y-2">
          <NavItem view="actions" label="Action Items" />
          <NavItem view="map" label="Conversation Map" />
          <NavItem view="images" label="Images & Reports" disabled={!project.images || project.images.length === 0} />
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {activeView === 'actions' && <ActionItemsView actionItems={action_items} />}
        {activeView === 'map' && (
          <div>
            <div className="p-6 pb-4">
               {conversation_summary && (
                <div className="bg-blue-50 border border-primary-blue/30 text-neutral-800 p-4 rounded-lg mb-6 shadow-sm">
                  <h4 className="font-bold text-sm text-primary-blue mb-1">Conversation Summary</h4>
                  <p className="text-sm leading-relaxed">{conversation_summary}</p>
                </div>
              )}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search conversations by name, email, or summary..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-blue focus:border-primary-blue"
                />
              </div>
            </div>
            <ConversationMapView nodes={filteredConversationNodes} />
          </div>
        )}
        {activeView === 'images' && project.images && <ImageView images={project.images} />}
      </main>
    </div>
  );
};

export default ProjectWorkspace;