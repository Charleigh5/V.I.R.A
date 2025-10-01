
import React from 'react';
import { Project, ProjectStatus } from '../types';
import Card from './ui/Card';
import Badge from './ui/Badge';

interface ProjectCardProps {
  project: Project;
  onSelect: (projectId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect }) => {
  const getStatusBadgeColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.READY: return 'green';
      case ProjectStatus.PROCESSING: return 'yellow';
      case ProjectStatus.ERROR: return 'red';
      default: return 'gray';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelect(project.id)}>
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-bold text-neutral-900">{project.name}</h3>
        <Badge color={getStatusBadgeColor(project.status)}>{project.status}</Badge>
      </div>
      <p className="text-sm text-neutral-500 mt-1">Opp. #{project.opportunityNumber}</p>
    </Card>
  );
};

export default ProjectCard;
