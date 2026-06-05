import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiStar, FiMessageCircle, FiHeart, FiTrendingUp } from 'react-icons/fi';
import api from '../utils/api';
import './StudentEchoes.css';

const StudentEchoes = () => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ averageRating: null, totalReviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await api.get('/platform-reviews');
        setReviews(res.data.reviews || []);
        setStats({
          averageRating: res.data.averageRating,
          totalReviews: res.data.totalReviews || 0,
        });
      } catch (err) {
        console.error('Failed to load student echoes:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  if (loading) {
    return (
      <div className="student-echoes-page">
        <div className="container echoes-loading">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
            Gathering whispers…
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-echoes-page">
      <div className="container">
        <motion.header
          className="echoes-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="echoes-hero-icon">
            <FiHeart />
          </div>
          <h1>Student Echoes</h1>
          <p>Whispers from students about their MindSpace journey — your compass for care.</p>

          <div className="echoes-stats">
            <div className="echo-stat-card">
              <FiTrendingUp />
              <div>
                <strong>{stats.averageRating ?? '—'}</strong>
                <span>Avg. rating</span>
              </div>
            </div>
            <div className="echo-stat-card">
              <FiMessageCircle />
              <div>
                <strong>{stats.totalReviews}</strong>
                <span>Total echoes</span>
              </div>
            </div>
          </div>
        </motion.header>

        {reviews.length === 0 ? (
          <motion.div
            className="echoes-empty glass-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="empty-emoji">🌱</span>
            <h3>No echoes yet</h3>
            <p>When students share their experience, their voices will ripple here.</p>
          </motion.div>
        ) : (
          <div className="echoes-grid">
            {reviews.map((review, i) => (
              <motion.article
                key={review.id}
                className="echo-card glass-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="echo-card-top">
                  <div className="echo-stars">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <FiStar
                        key={s}
                        className={review.rating >= s ? 'filled' : ''}
                      />
                    ))}
                  </div>
                  <time>
                    {new Date(review.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                </div>

                {review.suggestion && (
                  <blockquote className="echo-suggestion">
                    "{review.suggestion}"
                  </blockquote>
                )}

                <footer className="echo-meta">
                  <span className="echo-student">
                    {review.profile?.name || 'A MindSpace student'}
                  </span>
                  {review.profile?.department && (
                    <span className="echo-dept">{review.profile.department}</span>
                  )}
                </footer>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentEchoes;
