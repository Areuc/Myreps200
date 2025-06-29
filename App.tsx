
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ExercisesPage from './pages/ExercisesPage';
import RoutinesPage from './pages/RoutinesPage';
import WorkoutPage from './pages/WorkoutPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import ProgressPage from './pages/ProgressPage';
import { useAuth } from './hooks/useAuth';
import { APP_NAME } from './constants';
import ToastContainer from './components/ToastContainer';

const App: React.FC = () => {
  const { user, session, loading } = useAuth(); // user is the Profile object, session is Supabase session

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-[#18181b]"><p className="text-[#06b6d4]">Cargando aplicación...</p></div>;
  }

  // Use session to determine if user is authenticated, and user (Profile) for user-specific data
  const isAuthenticated = !!session && !!user;

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-[#18181b]">
        {isAuthenticated && <Navbar />}
        <main className="flex-grow container mx-auto px-2 sm:px-4 py-4 md:py-8">
          <Routes>
            <Route path="/auth" element={!isAuthenticated ? <AuthPage /> : <Navigate to="/" />} />
            
            <Route path="/" element={isAuthenticated ? <HomePage /> : <Navigate to="/auth" />} />
            <Route path="/exercises" element={isAuthenticated ? <ExercisesPage /> : <Navigate to="/auth" />} />
            <Route path="/routines" element={isAuthenticated ? <RoutinesPage /> : <Navigate to="/auth" />} />
            <Route path="/progress" element={isAuthenticated ? <ProgressPage /> : <Navigate to="/auth" />} />
            <Route path="/workout/:workoutId" element={isAuthenticated ? <WorkoutPage /> : <Navigate to="/auth" />} /> {/* Changed :routineId to :workoutId */}
            <Route path="/workout" element={isAuthenticated ? <WorkoutPage /> : <Navigate to="/auth" />} /> {/* For custom workouts (ad-hoc logging) */}
            <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/auth" />} />
            
            <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/auth"} />} />
          </Routes>
        </main>
        {isAuthenticated && (
          <footer className="bg-zinc-950 text-zinc-400 text-center p-4 border-t border-zinc-800">
            <p>&copy; ${new Date().getFullYear()} {APP_NAME}. Todos los derechos reservados.</p>
          </footer>
        )}
      </div>
      <ToastContainer />
    </HashRouter>
  );
};

export default App;
