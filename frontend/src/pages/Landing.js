import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCalendar, FiUsers, FiHeart, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import './Landing.css';

const professionals = [
  { 
    id: 1, 
    name: 'Dr. V.M Gayathri', 
    role: 'Associate Professor', 
    image: '/counsellors/gayathri.png',
    specialty: 'Networking & Comm (NWC)'
  },
  { 
    id: 2, 
    name: 'Dr. A.Helen Victoria', 
    role: 'Associate Professor', 
    image: '/counsellors/helen.png',
    specialty: 'Networking & Comm (NWC)'
  },
  { 
    id: 3, 
    name: 'Dr. P.Supraja', 
    role: 'Associate Professor', 
    image: '/counsellors/supraja.png',
    specialty: 'Value Education Cell'
  },
  { 
    id: 4, 
    name: 'Dr. A Arun', 
    role: 'Associate Professor', 
    image: '/counsellors/arun.png',
    specialty: 'Networking & Comm (NWC)'
  },
  { 
    id: 5, 
    name: 'Dr. M.Vaishnavi Moorthy', 
    role: 'Associate Professor', 
    image: '/counsellors/vaishnavi.png',
    specialty: 'Networking & Comm (NWC)'
  },
  { 
    id: 6, 
    name: 'Dr. Lakshmi Narayanan K', 
    role: 'Associate Professor', 
    image: '/counsellors/lakshmi.png',
    specialty: 'Networking & Comm (NWC)'
  }
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="hero-badge">Your Mental Wellbeing Matters</span>
            <h1>Find Peace & Clarity <br/><span>In Your Journey</span></h1>
            <p>Professional, confidential, and compassionate counselling support tailored for your college life. We're here to listen, support, and grow with you.</p>
            
            <div className="hero-actions">
              <button 
                className="btn btn-primary btn-large"
                onClick={() => navigate('/login')}
              >
                <FiCalendar /> Book Appointment
              </button>
              <button 
                className="btn btn-ghost btn-large"
                onClick={() => navigate('/professionals')}
              >
                <FiUsers /> Explore Professionals
              </button>
            </div>
            
            <div className="hero-stats">
              <div className="stat-item">
                <FiCheckCircle className="stat-icon" />
                <span>100% Confidential</span>
              </div>
              <div className="stat-item">
                <FiCheckCircle className="stat-icon" />
                <span>Verified Experts</span>
              </div>
            </div>
          </motion.div>
        </div>
        
        <motion.div 
          className="hero-image-container"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="hero-image-wrapper">
            <img src="/landing/hero.png" alt="Counselling Support" className="hero-main-img" />
            <div className="floating-card support-card">
              <FiHeart className="icon" />
              <div>
                <h4>Supportive Care</h4>
                <p>24/7 Assistance</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Professionals Section */}
      <section className="professionals-section">
        <div className="section-header">
          <span className="section-subtitle">Expert Guidance</span>
          <h2>Meet Our Professionals</h2>
          <p>Connect with our dedicated team of experts committed to your mental health.</p>
        </div>

        <div className="professionals-grid">
          {professionals.map((prof, index) => (
            <motion.div 
              key={prof.id}
              className="prof-card glass-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="prof-image-wrap">
                <img src={prof.image} alt={prof.name} />
                <div className="prof-specialty">{prof.specialty}</div>
              </div>
              <div className="prof-info">
                <h3>{prof.name}</h3>
                <p className="prof-role">{prof.role}</p>
                <button 
                  className="btn btn-outline"
                  onClick={() => navigate(`/professional/${prof.id}`)}
                >
                  View Profile <FiArrowRight />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="section-footer">
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/professionals')}
          >
            Explore All Professionals <FiArrowRight />
          </button>
        </div>
      </section>

      {/* Features/Why Us */}
      <section className="why-us-section">
        <div className="feature-grid">
          <div className="feature-item">
            <div className="feature-icon"><FiHeart /></div>
            <h3>Compassionate Care</h3>
            <p>Our approach is rooted in empathy and understanding your unique needs.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><FiUsers /></div>
            <h3>Expert Team</h3>
            <p>Access highly qualified professionals with diverse specializations.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><FiCalendar /></div>
            <h3>Easy Booking</h3>
            <p>Seamlessly schedule sessions that fit your busy academic life.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
