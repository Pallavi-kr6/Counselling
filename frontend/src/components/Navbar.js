import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUser,
  FiCalendar,
  FiHeart,
  FiBook,
  FiPhone,
  FiLogOut,
  FiMenu,
  FiX,
  FiUsers,
  FiMessageCircle,
  FiSun,
  FiMoon,
  FiSettings
} from 'react-icons/fi';
import PersonalizationPanel from './PersonalizationPanel';
import './Navbar.css';

const Navbar = () => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [personalizationOpen, setPersonalizationOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const baseNavItems = [
    ...(user ? [{ path: '/dashboard', icon: FiSettings, label: 'Dashboard' }] : []),
    { path: '/profile', icon: FiUser, label: t('nav.profile') },
    { path: '/appointments', icon: FiCalendar, label: t('nav.appointments') }
  ];

  const studentNavItems = [
    { path: '/mood', icon: FiHeart, label: t('nav.mood') },
    { path: '/resources', icon: FiBook, label: t('nav.resources') },
    { path: '/emergency', icon: FiPhone, label: t('nav.emergency') },
    { path: '/ai-counselling', icon: FiMessageCircle, label: t('nav.aiCounselling') }
  ];

  const counsellorNavItems = [
    { path: '/sessions-summary', icon: FiUsers, label: 'Student Details' },
    { path: '/resources', icon: FiBook, label: t('nav.resources') }
  ];

  let navItems = baseNavItems;
  if (user?.userType === 'student') {
    navItems = [...baseNavItems, ...studentNavItems];
  } else if (user?.userType === 'counsellor') {
    navItems = [...baseNavItems, ...counsellorNavItems];
  }

  return (
    <nav className="navbar glass-morphism">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 10 }}
            className="brand-logo-container"
          >
            <FiHeart className="brand-icon" />
          </motion.div>
          <span className="brand-text">{t('app.name')}</span>
        </Link>

        <div className="navbar-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <motion.div
                  whileHover={{ y: -2 }}
                  className="nav-link-content"
                >
                  <Icon />
                  <span className="nav-link-text">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-underline"
                      className="nav-underline"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}

          <div className="divider" />

          <motion.button
            whileTap={{ scale: 0.9 }}
            className="nav-icon-btn"
            onClick={() => setPersonalizationOpen(true)}
            title="Personalize Experience"
          >
            <FiSettings />
          </motion.button>

          <button className="nav-link logout-btn" onClick={handleLogout}>
            <FiLogOut />
            <span className="nav-link-text">{t('nav.logout')}</span>
          </button>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      <PersonalizationPanel 
        isOpen={personalizationOpen} 
        onClose={() => setPersonalizationOpen(false)} 
      />

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mobile-menu glass-card"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="mobile-actions">
              <button onClick={toggleTheme} className="mobile-nav-link">
                {theme === 'light' ? <FiMoon /> : <FiSun />}
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              </button>
              <button className="mobile-nav-link logout-btn" onClick={handleLogout}>
                <FiLogOut />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
