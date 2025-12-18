import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

import { Header } from './components/Header';
import { Footer } from './components/Footer';
import HomePage from './pages/HomePage';
import CreateQuizPage from './pages/CreateQuizPage';
import JoinQuizPage from './pages/JoinQuizPage';
import LobbyPage from './pages/LobbyPage';
import PlayerLobby from './pages/PlayerLobby';
import QuizHostPage from './pages/QuizHostPage';
import QuizPlayerPage from './pages/QuizPlayerPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PerformanceReportPage from './pages/PerformanceReportPage';

const App = () => {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col relative">
        <div className="background-shapes"></div>
        <Header />
        <main className="flex-grow flex flex-col relative">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateQuizPage />} />
            <Route path="/join" element={<JoinQuizPage />} />
            <Route path="/join/:quizId" element={<JoinQuizPage />} />
            <Route path="/lobby/:quizId" element={<LobbyPage />} />
            <Route path="/player-lobby/:quizId" element={<PlayerLobby />} />
            <Route path="/quiz/host/:quizId" element={<QuizHostPage />} />
            <Route path="/quiz/player/:quizId/:playerId" element={<QuizPlayerPage />} />
            <Route path="/leaderboard/:quizId" element={<LeaderboardPage />} />
            <Route path="/report/:quizId" element={<PerformanceReportPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </HashRouter>
  );
};

export default App;