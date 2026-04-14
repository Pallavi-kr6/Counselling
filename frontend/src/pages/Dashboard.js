import React from 'react';
import { useAuth } from '../context/AuthContext';
import StudentDashboard from './StudentDashboard';
import CounsellorDashboard from './CounsellorDashboard';

const Dashboard = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading dashboard...</div>;

  if (!user) return <div className="loading">Please login...</div>;

  // Route to appropriate dashboard based on user type
  if (user.userType === 'counsellor') {
    return <CounsellorDashboard />;
  }

  return <StudentDashboard />;
};

export default Dashboard;
