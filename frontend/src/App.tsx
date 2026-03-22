import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import { useProjects } from './hooks/useProject';

function ProjectsPage() {
  const { projects, loading, refresh } = useProjects();
  return <ProjectList projects={projects} loading={loading} onRefresh={refresh} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
