import React from 'react';
import { Project, ProjectStatus, TaskStatus } from '../types';
import Card from './ui/Card';
import Badge from './ui/Badge';

interface ProjectCardProps {
  project: Project;
  onSelect: (projectId: string) => void;
}

const formatDate = (isoString: string) => {
    try {
        return new Date(isoString).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return "Invalid Date";
    }
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect }) => {
  const getStatusBadgeColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.READY: return 'green';
      case ProjectStatus.PROCESSING: return 'yellow';
      case ProjectStatus.ERROR: return 'red';
      default: return 'gray';
    }
  };

  const description = project.data?.conversation_summary || 'No description available.';
  const taskCount = project.data?.action_items?.length || 0;
  const openTaskCount = project.data?.action_items?.filter(item => item.status !== TaskStatus.DONE).length || 0;

  return (
    <div className="relative group">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col" onClick={() => onSelect(project.id)}>
          <div className="flex-grow">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-neutral-900 pr-2">{project.name}</h3>
              <Badge color={getStatusBadgeColor(project.status)}>{project.status}</Badge>
            </div>
            <p className="text-sm text-neutral-500 mt-1">Opp. #{project.opportunityNumber}</p>
            {taskCount > 0 && (
                <div className="mt-3 flex items-center text-sm text-neutral-600">
                     <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${openTaskCount === 0 ? 'text-accent-green' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{openTaskCount} / {taskCount} Tasks Open</span>
                </div>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-4 pt-2 border-t border-neutral-100">{formatDate(project.createdAt)}</p>
        </Card>
        <div 
            className="absolute left-0 top-full mt-2 w-72 p-4 bg-neutral-800 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-opacity duration-200 z-10 pointer-events-none"
        >
            <h4 className="font-bold border-b border-neutral-600 pb-1 mb-2">Project Details</h4>
            <p className="mb-2">
                <strong>Description:</strong> {description.length > 150 ? `${description.substring(0, 150)}...` : description}
            </p>
            <p><strong>Opportunity #:</strong> {project.opportunityNumber}</p>
            <p><strong>Action Items:</strong> {taskCount}</p>
            <div className="mt-2 pt-2 border-t border-neutral-600">
                <p className="font-semibold">Sources:</p>
                <ul className="list-disc list-inside text-xs">
                    {project.sourceFiles.salesforceFileNames.map(name => <li key={name} className="truncate" title={name}>Salesforce: {name}</li>)}
                    {project.sourceFiles.emailFileNames.map(name => <li key={name} className="truncate" title={name}>Email: {name}</li>)}
                </ul>
            </div>
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-neutral-800"></div>
        </div>
    </div>
  );
};

export default ProjectCard;
