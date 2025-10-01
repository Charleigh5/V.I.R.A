import { ProjectDetails, TaskStatus, TaskPriority } from '../types';

interface ActionItemTemplate {
  subject: string;
  description: string;
  status: string;
  priority: string;
  assigned_to_name: string;
  task_types: string;
  hours_remaining: number;
  dueDateOffset: number; // Days from creation date
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  projectDetails: Omit<ProjectDetails, 'project_name'>;
  actionItems: ActionItemTemplate[];
}

export const projectTemplates: ProjectTemplate[] = [
  {
    id: 'qbr-template',
    name: 'Quarterly Business Review (QBR)',
    description: 'A standard template for preparing and conducting a Quarterly Business Review with a key client.',
    projectDetails: {
      opportunity_number: 'N/A',
      account_name: 'Key Account',
      opp_revenue: 0,
    },
    actionItems: [
      {
        subject: 'Prepare QBR Deck',
        description: 'Compile performance metrics, key achievements, and strategic plan for the next quarter.',
        status: TaskStatus.Open,
        priority: TaskPriority.High,
        assigned_to_name: 'Account Manager',
        task_types: 'Preparation',
        hours_remaining: 16,
        dueDateOffset: 14, // T+14 days
      },
      {
        subject: 'Schedule QBR Meeting',
        description: 'Coordinate with the client to find a suitable time for the QBR presentation.',
        status: TaskStatus.Open,
        priority: TaskPriority.Normal,
        assigned_to_name: 'Project Coordinator',
        task_types: 'Coordination',
        hours_remaining: 2,
        dueDateOffset: 7, // T+7 days
      },
      {
        subject: 'Review Internal Action Items',
        description: 'Review and update all internal action items related to this account before the QBR.',
        status: TaskStatus.Open,
        priority: TaskPriority.Normal,
        assigned_to_name: 'Team Lead',
        task_types: 'Review',
        hours_remaining: 4,
        dueDateOffset: 10, // T+10 days
      },
    ],
  },
  {
    id: 'poc-kickoff-template',
    name: 'Proof of Concept (PoC) Kickoff',
    description: 'Use this template to structure the kickoff for a new Proof of Concept project.',
    projectDetails: {
      opportunity_number: 'N/A',
      account_name: 'Prospective Client',
      opp_revenue: 0,
    },
    actionItems: [
      {
        subject: 'Define PoC Success Criteria',
        description: 'Work with the client to clearly define the success criteria for the PoC.',
        status: TaskStatus.Open,
        priority: TaskPriority.High,
        assigned_to_name: 'Solutions Engineer',
        task_types: 'Planning',
        hours_remaining: 8,
        dueDateOffset: 3, // T+3 days
      },
      {
        subject: 'Provision PoC Environment',
        description: 'Set up the necessary technical environment and accounts for the PoC.',
        status: TaskStatus.Open,
        priority: TaskPriority.High,
        assigned_to_name: 'IT Support',
        task_types: 'Technical',
        hours_remaining: 12,
        dueDateOffset: 5, // T+5 days
      },
      {
        subject: 'Schedule Kickoff Meeting',
        description: 'Schedule the official PoC kickoff meeting with all stakeholders.',
        status: TaskStatus.Open,
        priority: TaskPriority.Normal,
        assigned_to_name: 'Project Manager',
        task_types: 'Coordination',
        hours_remaining: 2,
        dueDateOffset: 2, // T+2 days
      },
      {
        subject: 'Draft Statement of Work (SOW)',
        description: 'Prepare the initial draft of the SOW for the PoC.',
        status: TaskStatus.Open,
        priority: TaskPriority.Normal,
        assigned_to_name: 'Account Manager',
        task_types: 'Documentation',
        hours_remaining: 6,
        dueDateOffset: 7, // T+7 days
      },
    ],
  },
];
