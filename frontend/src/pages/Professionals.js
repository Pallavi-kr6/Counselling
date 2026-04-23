import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiStar, FiClock, FiMapPin } from 'react-icons/fi';
import './Professionals.css';

const allProfessionals = [
  { 
    id: 1, 
    name: 'Dr. Sarah Smith', 
    role: 'Clinical Psychologist', 
    image: '/landing/prof1.png',
    specialty: 'Anxiety & Stress',
    rating: 4.9,
    experience: '12+ Years',
    location: 'Building A, Room 302'
  },
  { 
    id: 2, 
    name: 'Dr. Michael Chen', 
    role: 'Counselling Specialist', 
    image: '/landing/prof2.png',
    specialty: 'Academic Performance',
    rating: 4.8,
    experience: '8 Years',
    location: 'Student Hub, Floor 2'
  },
  { 
    id: 3, 
    name: 'Ms. Emily Rodriguez', 
    role: 'Wellness Coach', 
    image: '/landing/prof3.png',
    specialty: 'Mindfulness & Growth',
    rating: 4.9,
    experience: '10 Years',
    location: 'Wellness Wing, Room 12'
  },
  { 
    id: 4, 
    name: 'Dr. David Wilson', 
    role: 'Mental Health Advocate', 
    image: '/landing/prof2.png',
    specialty: 'Crisis Intervention',
    rating: 4.7,
    experience: '15 Years',
    location: 'Building B, Room 405'
  }
];

const Professionals = () => {
  const navigate = useNavigate();

  return (
    <div className="professionals-page">
      <div className="container">
        <header className="prof-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            <FiArrowLeft /> Back to Home
          </button>
          <h1>Our Professionals</h1>
          <p>Highly qualified experts ready to support your mental wellbeing.</p>
        </header>

        <div className="prof-list-grid">
          {allProfessionals.map((prof, index) => (
            <motion.div 
              key={prof.id}
              className="prof-list-card glass-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="prof-list-image">
                <img src={prof.image} alt={prof.name} />
              </div>
              <div className="prof-list-content">
                <div className="prof-list-meta">
                  <span className="badge">{prof.specialty}</span>
                  <span className="rating"><FiStar /> {prof.rating}</span>
                </div>
                <h3>{prof.name}</h3>
                <p className="role">{prof.role}</p>
                
                <div className="prof-details-row">
                  <span><FiClock /> {prof.experience}</span>
                  <span><FiMapPin /> {prof.location}</span>
                </div>

                <div className="prof-list-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/login')}
                  >
                    Book Session
                  </button>
                  <button 
                    className="btn btn-ghost"
                    onClick={() => navigate(`/professional/${prof.id}`)}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Professionals;
