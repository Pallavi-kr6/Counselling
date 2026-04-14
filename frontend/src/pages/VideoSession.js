import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiVideo, FiX, FiShield, FiExternalLink, FiInfo, FiActivity } from 'react-icons/fi';
import api from '../utils/api';
import './VideoSession.css';

const VideoSession = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [meetingData, setMeetingData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMeetingData = useCallback(async () => {
    try {
      const resp = await api.get(`/zoom/meeting/${appointmentId}`);
      setMeetingData(resp.data);
    } catch (err) {
      console.error(err);
      navigate('/appointments');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, navigate]);

  useEffect(() => {
    fetchMeetingData();
  }, [fetchMeetingData]);

  if (loading) return <div className="loading-screen immersive">
    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
      Synchronizing secure connection...
    </motion.div>
  </div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="video-session-immersive">
      <div className="immersive-container">
        <header className="immersive-header glass-card">
          <div className="branding">
            <FiShield className="secure-icon" />
            <span>Secure Clinical Space</span>
          </div>
          <button className="btn-leave" onClick={() => navigate('/appointments')}>
            <FiX /> End Session
          </button>
        </header>

        <main className="immersive-content">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="video-viewport glass-card">
            <div className="viewport-overlay">
              <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4 }} className="viewport-icon">
                <FiVideo />
              </motion.div>
              <h2>Virtual Sanctuary Ready</h2>
              <p>Your counsellor is waiting for you in the secure Zoom bridge.</p>
              
              <div className="meeting-auth-pill glass-morphism">
                <span>Meeting ID: {meetingData?.meeting?.meeting_number}</span>
                <span className="divider">|</span>
                <span>Passcode: {meetingData?.meeting?.meeting_password}</span>
              </div>

              <a href={meetingData?.meeting?.join_url} target="_blank" rel="noopener noreferrer" className="btn-join-immersive">
                Join Secure Session <FiExternalLink />
              </a>
            </div>
            <div className="viewport-bg-animation" />
          </motion.div>

          <aside className="immersive-sidebar">
            <div className="sidebar-card glass-card">
              <h3><FiInfo /> Pro-Tips</h3>
              <ul>
                <li>Ensure you're in a quiet, private space.</li>
                <li>Check your camera and microphone levels.</li>
                <li>Stay hydrated and take a deep breath.</li>
              </ul>
            </div>
            <div className="sidebar-card glass-card">
              <h3><FiActivity /> Connection</h3>
              <div className="status-row">
                <div className="pulse-dot" />
                <span>Encrypted Tunnel Active</span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </motion.div>
  );
};

export default VideoSession;