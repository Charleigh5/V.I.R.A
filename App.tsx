import React, { useState, useCallback } from 'react';
import { Project, ProjectImage, RawImageAnalysis, SynthesizedProjectData } from './types';
import Dashboard from './components/Dashboard';
import CreateProjectModal from './components/CreateProjectModal';
import ProjectWorkspace from './components/ProjectWorkspace';
import ImageReviewModal from './components/ImageReviewModal';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    textData: Omit<SynthesizedProjectData, 'image_reports'>,
    imageData: RawImageAnalysis[],
    projectName: string,
    sourceFiles: { salesforceFileNames: string[], emailFileNames:string[] },
    autoGenerateName: boolean;
  } | null>(null);

  const handleAnalysisComplete = useCallback((
    synthesizedData: SynthesizedProjectData,
    imageFiles: File[],
    projectName: string,
    sourceFiles: { salesforceFileNames: string[], emailFileNames: string[] },
    autoGenerateName: boolean
  ) => {
    const { image_reports, ...textData } = synthesizedData;
    
    const rawImageAnalyses = image_reports?.map((report, index) => ({
        ...report,
        base64Data: URL.createObjectURL(imageFiles.find(f => f.name === report.fileName) || imageFiles[index])
    })) || [];

    setAnalysisResult({ textData, imageData: rawImageAnalyses, projectName, sourceFiles, autoGenerateName });
    setCreateModalOpen(false);
    setReviewModalOpen(true);
  }, []);

  const handleProjectCreate = useCallback((finalImages: ProjectImage[]) => {
    if (!analysisResult) return;

    const finalProjectName = analysisResult.autoGenerateName
        ? analysisResult.textData.project_details.project_name
        : analysisResult.projectName;

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: finalProjectName,
      opportunityNumber: analysisResult.textData.project_details.opportunity_number,
      status: 'READY' as any,
      data: analysisResult.textData,
      images: finalImages,
      createdAt: new Date().toISOString(),
      sourceFiles: analysisResult.sourceFiles,
    };

    setProjects(prevProjects => [...prevProjects, newProject]);
    setReviewModalOpen(false);
    setAnalysisResult(null);
    setSelectedProjectId(newProject.id);
  }, [analysisResult]);


  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setSelectedProjectId(null);
  }, []);
  
  const handleCloseReviewModal = () => {
    setReviewModalOpen(false);
    setAnalysisResult(null);
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="bg-neutral-100 min-h-screen font-sans text-neutral-800">
      {selectedProject ? (
        <ProjectWorkspace project={selectedProject} onBack={handleBackToDashboard} />
      ) : (
        <Dashboard
          projects={projects}
          onSelectProject={handleSelectProject}
          onOpenCreateModal={() => setCreateModalOpen(true)}
        />
      )}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onAnalysisComplete={handleAnalysisComplete}
      />
      {analysisResult && (
         <ImageReviewModal
            isOpen={isReviewModalOpen}
            onClose={handleCloseReviewModal}
            analysisResults={analysisResult.imageData}
            onConfirm={handleProjectCreate}
         />
      )}
    </div>
  );
};

export default App;