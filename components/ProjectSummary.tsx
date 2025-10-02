import React, { useMemo } from 'react';
import { Project, ActionItem, TaskStatus } from '../types';
import Card from './ui/Card';
import DonutChart from './ui/DonutChart';

interface ProjectSummaryProps {
  project: Project;
  actionItems: ActionItem[];
}

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.Open]: '#9E9E9E', // neutral-500
  [TaskStatus.InProcess]: '#F5A623', // accent-yellow
  [TaskStatus.TODO]: '#F5A623',
  [TaskStatus.IN_PROGRESS]: '#4A90E2', // primary-blue
  [TaskStatus.DONE]: '#7ED321', // accent-green
  [TaskStatus.BLOCKED]: '#D0021B', // accent-red
};

const ProjectSummary: React.FC<ProjectSummaryProps> = ({ project, actionItems }) => {
  const { project_details } = project.data!;

  const chartData = useMemo(() => {
    const statusCounts = actionItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<TaskStatus, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      label: status,
      value: count,
      color: statusColors[status as TaskStatus] || '#E0E0E0',
    }));
  }, [actionItems]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-500">Account</p>
          <h2 className="text-2xl font-bold text-neutral-900 truncate" title={project_details.account_name}>
            {project_details.account_name}
          </h2>
        </div>
        <div className="w-px bg-neutral-200 self-stretch hidden md:block"></div>
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-500">Opportunity Revenue</p>
          <p className="text-2xl font-bold text-accent-green">
            {formatCurrency(project_details.opp_revenue)}
          </p>
        </div>
        <div className="w-px bg-neutral-200 self-stretch hidden md:block"></div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24">
            <DonutChart data={chartData} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Action Items</p>
            <p className="text-2xl font-bold text-neutral-900">{actionItems.length}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProjectSummary;
