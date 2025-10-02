
import React, { useState, useMemo } from 'react';
import { Project, ActionItem } from '../types';
import ActionItemsView from './ActionItemsView';
import ConversationMapView from './ConversationMapView';
import ImageView from './ImageView';
import CreateActionItemModal from './CreateActionItemModal';
import SalesforceDataView from './SalesforceDataView';
import EmailTranscriptView from './EmailTranscriptView';
import CollapsibleSection from './ui/CollapsibleSection';
import ProjectSummary from './ProjectSummary';
import ProjectChat from './ProjectChat';

interface ProjectWorkspaceProps {
  project: Project;
  onBack: () => void;
}

type View = 'sources' | 'actions' | 'map' | 'images';

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ project, onBack }) => {
  const [activeView, setActiveView] = useState<View>('sources');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Centralized state for action items
  const [actionItems, setActionItems] = useState<ActionItem[]>(project.data?.action_items || []);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // State for create modal
  const [createModalState, setCreateModalState] = useState<{ isOpen: boolean; initialData: Partial<ActionItem> }>({ isOpen: false, initialData: {} });

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

  // Handlers for Action Items
  const handleOpenCreateActionItemModal = (initialData: Partial<ActionItem> = {}) => {
    setCreateModalState({ isOpen: true, initialData });
  };

  const handleCloseCreateActionItemModal = () => {
    setCreateModalState({ isOpen: false, initialData: {} });
  };

  const handleCreateActionItem = (newItemData: Omit<ActionItem, 'id'>) => {
    const newActionItem: ActionItem = {
      ...newItemData,
      id: `task-${Date.now()}-${Math.random()}`,
    };
    setActionItems(prev => [...prev, newActionItem]);
    handleCloseCreateActionItemModal();
    setActiveView('actions');
  };
  
  const handleUpdateActionItem = (updatedItem: ActionItem) => {
      setActionItems(currentItems => currentItems.map(i => (i.id === updatedItem.id ? updatedItem : i)));
  };

  const handleLinkActionItem = (actionItemId: string, nodeId: number) => {
    const itemToUpdate = actionItems.find(item => item.id === actionItemId);
    if (itemToUpdate) {
        handleUpdateActionItem({ ...itemToUpdate, sourceConversationNodeId: nodeId });
    }
  };

  const { project_details, conversation_nodes, conversation_summary } = project.data;

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
    <>
      <div className="flex h-screen bg-neutral-100">
        <aside className="w-64 bg-white p-4 flex flex-col border-r border-neutral-200">
          <div>
            <button onClick={onBack} className="mb-4 text-sm text-primary-blue hover:underline text-left">
              &larr; All Projects
            </button>
            <h2 className="text-lg font-bold text-neutral-900 truncate" title={project_details.project_name}>
              {project_details.project_name}
            </h2>
            <p className="text-xs text-neutral-500 mb-6">Opp. #{project_details.opportunity_number}</p>
            <nav className="space-y-2">
              <NavItem view="sources" label="Data Sources" />
              <NavItem view="actions" label="Action Items" />
              <NavItem view="map" label="Conversation Map" />
              <NavItem view="images" label="Images & Reports" disabled={!project.images || project.images.length === 0} />
            </nav>
          </div>
          <div className="mt-auto pt-4 border-t border-neutral-200">
             <button
                onClick={() => setIsChatOpen(true)}
                className="w-full inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold bg-neutral-800 text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-700 transition-colors"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.938V19a1 1 0 11-2 0v-4.062a4.5 4.5 0 112 0z" clipRule="evenodd" />
                    <path d="M10 4.5a.5.5 0 01.5.5v2.5a.5.5 0 01-1 0V5a.5.5 0 01.5-.5z" />
                 </svg>
                AI Assistant
              </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 bg-neutral-100/80 backdrop-blur-sm z-10 p-6 pb-2">
            <ProjectSummary project={project} actionItems={actionItems} />
          </div>

           {activeView === 'sources' && (
            <div className="p-6 pt-4 h-full flex flex-col gap-6">
              {project.rawEmailContent || project.rawSalesforceContent ? (
                <>
                  {project.rawEmailContent && (
                     <CollapsibleSection title="Source (Email)" defaultOpen className="flex-[3] flex flex-col min-h-0">
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                          <EmailTranscriptView rawContent={project.rawEmailContent} />
                          <div className="flex flex-col min-h-0">
                            <h3 className="text-lg font-semibold text-neutral-700 mb-2 flex-shrink-0">Conversation Flow Chart</h3>
                            <div className="flex-1 bg-white rounded-lg shadow-md overflow-hidden relative">
                              <ConversationMapView nodes={conversation_nodes} allActionItems={actionItems} onCreateActionItem={handleOpenCreateActionItemModal} onLinkActionItem={handleLinkActionItem} />
                            </div>
                          </div>
                        </div>
                     </CollapsibleSection>
                  )}
                  {project.rawSalesforceContent && (
                    <CollapsibleSection title="Source (Salesforce)" defaultOpen className="flex-[2] flex flex-col min-h-0">
                      <SalesforceDataView markdownContent={project.rawSalesforceContent} />
                    </CollapsibleSection>
                  )}
                </>
              ) : (
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center p-10 bg-white rounded-lg shadow-sm">
                        <p className="text-neutral-500">No raw source file data is available for this project.</p>
                    </div>
                </div>
              )}
            </div>
          )}
          {activeView === 'actions' && (
            <ActionItemsView 
              actionItems={actionItems}
              onUpdateActionItem={handleUpdateActionItem}
              conversationNodes={conversation_nodes}
              onCreateActionItem={handleOpenCreateActionItemModal}
            />
          )}
          {activeView === 'map' && (
            <div className="h-full flex flex-col">
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
              <div className="flex-grow min-h-0">
                <ConversationMapView 
                  nodes={filteredConversationNodes}
                  allActionItems={actionItems}
                  onCreateActionItem={handleOpenCreateActionItemModal}
                  onLinkActionItem={handleLinkActionItem}
                />
              </div>
            </div>
          )}
          {activeView === 'images' && project.images && <ImageView images={project.images} />}
        </main>
      </div>

      <ProjectChat 
        project={project}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      <CreateActionItemModal
        isOpen={createModalState.isOpen}
        onClose={handleCloseCreateActionItemModal}
        onSave={handleCreateActionItem}
        initialData={createModalState.initialData}
      />
    </>
  );
};

export default ProjectWorkspace;
