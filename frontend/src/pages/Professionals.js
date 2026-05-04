import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiStar, FiClock, FiMapPin } from 'react-icons/fi';
import './Professionals.css';

const allProfessionals = [
  {
    id: 1,
    name: 'Dr. V.M Gayathri',
    role: 'Associate Professor',
    image: '/counsellors/gayathri.png',
    specialty: 'Networking & Comm (NWC)',
    experience: '15+ Years',
    location: 'S617, UB',
    profileUrl: 'https://www.srmist.edu.in/faculty/mrs-v-m-gayathri/'
  },
  {
    id: 2,
    name: 'Dr. A.Helen Victoria',
    role: 'Associate Professor',
    image: '/counsellors/helen.png',
    specialty: 'Networking & Comm (NWC)',
    experience: '12+ Years',
    location: 'S617, UB',
    profileUrl: 'https://www.srmist.edu.in/faculty/ms-a-helen-victoria/'
  },
  {
    id: 3,
    name: 'Dr. P.Supraja',
    role: 'Associate Professor',
    image: '/counsellors/supraja.png',
    specialty: 'Value Education Cell',
    experience: '10+ Years',
    location: 'VEC, Main Block',
    profileUrl: 'https://www.srmist.edu.in/faculty/dr-p-supraja/'
  },
  {
    id: 4,
    name: 'Dr. A Arun',
    role: 'Associate Professor',
    image: '/counsellors/arun.png',
    specialty: 'Networking & Comm (NWC)',
    experience: '14 Years',
    location: 'S617, UB',
    profileUrl: 'https://www.srmist.edu.in/faculty/dr-arun-a/'
  },
  {
    id: 5,
    name: 'Dr. M.Vaishnavi Moorthy',
    role: 'Associate Professor',
    image: '/counsellors/vaishnavi.png',
    specialty: 'Networking & Comm (NWC)',
    experience: '9 Years',
    location: 'S617, UB',
    profileUrl: 'https://www.srmist.edu.in/faculty/vaishnavi-moorthy/'
  },
  {
    id: 6,
    name: 'Dr. Lakshmi Narayanan K',
    role: 'Associate Professor',
    image: '/counsellors/lakshmi.png',
    specialty: 'Networking & Comm (NWC)',
    experience: '11 Years',
    location: 'S617, UB',
    profileUrl: 'https://www.srmist.edu.in/faculty/dr-lakshmi-narayanan-k/'
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
                    onClick={() => {
                      if (prof.profileUrl) {
                        window.location.href = prof.profileUrl;
                      } else {
                        navigate(`/professional/${prof.id}`);
                      }
                    }}
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
