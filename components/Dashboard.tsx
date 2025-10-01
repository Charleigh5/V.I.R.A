
import React from 'react';
import { Project } from '../types';
import ProjectCard from './ProjectCard';
import Button from './ui/Button';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onOpenCreateModal: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, onOpenCreateModal }) => {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">Project Dashboard</h1>
        <Button onClick={onOpenCreateModal}>+ New Project</Button>
      </div>
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onSelect={onSelectProject} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-lg shadow-md">
          <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-neutral-900">No projects</h3>
          <p className="mt-1 text-sm text-neutral-500">Get started by creating a new project.</p>
          <div className="mt-6">
            <Button onClick={onOpenCreateModal}>
              + New Project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
