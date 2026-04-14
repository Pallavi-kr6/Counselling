import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Appointments from './pages/Appointments';
import BookAppointmentDayOrder from './pages/BookAppointmentDayOrder';
import MoodTracking from './pages/MoodTracking';
import AICounselling from './pages/AICounselling';
import Resources from './pages/Resources';
import Emergency from './pages/Emergency';
import VideoSession from './pages/VideoSession';
import Breathe from './pages/Breathe';
import Feedback from './pages/Feedback';
import ProgressReports from './pages/ProgressReports';
import CounsellorSessions from './pages/CounsellorSessions';
import CounsellorStudentDetail from './pages/CounsellorStudentDetail';
import AdminInsights from './pages/AdminInsights';
import PHQ9Form from './pages/PHQ9Form';
import Navbar from './components/Navbar';
import './App.css';

const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? children : <Navigate to="/login" />;
}

// ... duplicate route helpers removed for brevity in this view_file context, assuming they are kept

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Navbar />
              <PageWrapper><Dashboard /></PageWrapper>
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Navbar />
              <PageWrapper><Profile /></PageWrapper>
            </PrivateRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <PrivateRoute>
              <Navbar />
              <PageWrapper><Appointments /></PageWrapper>
            </PrivateRoute>
          }
        />
        <Route
          path="/book-appointment"
          element={
            <StudentOnlyRoute>
              <Navbar />
              <PageWrapper><BookAppointmentDayOrder /></PageWrapper>
            </StudentOnlyRoute>
          }
        />
        <Route
          path="/mood"
          element={
            <StudentOnlyRoute>
              <Navbar />
              <PageWrapper><MoodTracking /></PageWrapper>
            </StudentOnlyRoute>
          }
        />
        <Route
          path="/resources"
          element={
            <StudentOnlyRoute>
              <Navbar />
              <PageWrapper><Resources /></PageWrapper>
            </StudentOnlyRoute>
          }
        />
        <Route
          path="/breathe"
          element={
            <StudentOnlyRoute>
              <Navbar />
              <PageWrapper><Breathe /></PageWrapper>
            </StudentOnlyRoute>
          }
        />
        <Route
          path="/ai-counselling"
          element={
            <PrivateRoute>
              <Navbar />
              <PageWrapper><AICounselling /></PageWrapper>
            </PrivateRoute>
          }
        />
        <Route
          path="/emergency"
          element={
            <StudentOnlyRoute>
              <Navbar />
              <PageWrapper><Emergency /></PageWrapper>
            </StudentOnlyRoute>
          }
        />
        <Route
          path="/phq9/:appointmentId"
          element={
            <StudentOnlyRoute>
              <Navbar />
              <PageWrapper><PHQ9Form /></PageWrapper>
            </StudentOnlyRoute>
          }
        />
        <Route
          path="/session/:appointmentId"
          element={
            <PrivateRoute>
              <VideoSession />
            </PrivateRoute>
          }
        />
        <Route
          path="/feedback/:appointmentId"
          element={
            <PrivateRoute>
              <Navbar />
              <PageWrapper><Feedback /></PageWrapper>
            </PrivateRoute>
          }
        />
        <Route
          path="/progress-reports"
          element={
            <CounsellorOnlyRoute>
              <Navbar />
              <PageWrapper><ProgressReports /></PageWrapper>
            </CounsellorOnlyRoute>
          }
        />
        <Route
          path="/sessions-summary"
          element={
            <CounsellorOnlyRoute>
              <Navbar />
              <PageWrapper><CounsellorSessions /></PageWrapper>
            </CounsellorOnlyRoute>
          }
        />
        <Route
          path="/counsellor/student/:studentId"
          element={
            <CounsellorOnlyRoute>
              <Navbar />
              <PageWrapper><CounsellorStudentDetail /></PageWrapper>
            </CounsellorOnlyRoute>
          }
        />
        <Route
          path="/admin/insights"
          element={
            <AdminOnlyRoute>
              <Navbar />
              <PageWrapper><AdminInsights /></PageWrapper>
            </AdminOnlyRoute>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

// Keeping the helper components accessible
function StudentOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.userType !== 'student') return <Navigate to="/" />;
  return children;
}

function CounsellorOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.userType !== 'counsellor') return <Navigate to="/" />;
  return children;
}

function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.userType !== 'admin') return <Navigate to="/" />;
  return children;
}

function GlobalFooter() {
  const location = useLocation();
  const hideOnPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
  
  if (hideOnPaths.includes(location.pathname) || location.pathname.startsWith('/session/')) {
    return null;
  }

  return (
    <footer style={{
      textAlign: 'center',
      padding: '2rem',
      marginTop: 'auto',
      background: 'transparent',
      color: 'var(--text-secondary)',
      fontSize: '0.9rem',
      borderTop: '1px solid rgba(46, 186, 168, 0.1)',
      lineHeight: '1.6'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', margin: '0 0 0.5rem 0' }}>
          Built with care by Panshul Arora, Pallavi Kumari and Vani Agarwal.  💙
        </p>
        <p style={{ margin: 0, opacity: 0.8 }}>
          We welcome your feedback and suggestions.
        </p>
      </div>
    </footer>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="App" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <AnimatedRoutes />
          </div>
          <GlobalFooter />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
