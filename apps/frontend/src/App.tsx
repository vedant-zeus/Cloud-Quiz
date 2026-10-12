import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { QuizListPage } from './pages/quizzes/QuizListPage';
import { CreateQuizPage } from './pages/quizzes/CreateQuizPage';
import { QuizEditorPage } from './pages/quizzes/QuizEditorPage';
import { QuizPreviewPage } from './pages/quizzes/QuizPreviewPage';
import { HostSessionPage } from './pages/host/HostSessionPage';
import { HostAnalyticsPage } from './pages/host/HostAnalyticsPage';
import { CompetitionHistoryPage } from './pages/host/CompetitionHistoryPage';
import { JoinPage } from './pages/participant/JoinPage';
import { PlayPage } from './pages/participant/PlayPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Participant Gameplay Routes */}
          <Route path="/join" element={<JoinPage />} />
          <Route path="/play/:roomCode" element={<PlayPage />} />

          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Host Dashboard Routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/quizzes" element={<QuizListPage />} />
            <Route path="/quizzes/new" element={<CreateQuizPage />} />
            <Route path="/quizzes/:id/edit" element={<QuizEditorPage />} />
            <Route path="/quizzes/:id/preview" element={<QuizPreviewPage />} />
            <Route path="/host/session/:roomCode" element={<HostSessionPage />} />
            <Route path="/host/session/:roomCode/analytics" element={<HostAnalyticsPage />} />
            <Route path="/history" element={<CompetitionHistoryPage />} />
            <Route path="/history/:sessionId" element={<HostAnalyticsPage />} />
          </Route>

          {/* Fallback 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
