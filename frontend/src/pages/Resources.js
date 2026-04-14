import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBook, FiVideo, FiHeadphones, FiSearch, FiExternalLink, FiWind, FiHeart, FiStar, FiCoffee, FiMoon, FiShield, FiTool } from 'react-icons/fi';
import './Resources.css';

const SAMPLE_RESOURCES = [
  { id: 1, title: '5-minute breathing reset', type: 'article', category: 'stress', description: 'Take a quick moment to center yourself and lower your heart rate gently.', url: '#' },
  { id: 2, title: 'How to manage academic stress', type: 'article', category: 'focus', description: 'Practical, gentle steps to handle your workload without overwhelming yourself.', url: '#' },
  { id: 3, title: 'Overthinking at night – simple techniques', type: 'article', category: 'sleep', description: 'Soothe your racing thoughts and prepare your mind for restful sleep.', url: '#' },
  { id: 4, title: 'Burnout in students: signs & solutions', type: 'article', category: 'self-care', description: 'Recognize the signs of burnout and learn how to be kind to yourself as you recover.', url: '#' },
  { id: 5, title: 'Guided breathing (2 min)', type: 'video', category: 'anxiety', description: 'Follow along with this gentle visual guide to slow your breathing.', url: '#' },
  { id: 6, title: 'Calm your anxiety instantly', type: 'video', category: 'anxiety', description: 'A grounding exercise to help you find your footing when anxiety spikes.', url: '#' },
  { id: 7, title: 'Focus music / study ambient', type: 'audio', category: 'focus', description: 'Gentle, non-distracting background sounds to help you concentrate.', url: '#' },
  { id: 8, title: 'Daily reflection journal', type: 'toolkit', category: 'self-care', description: 'Printable prompts to help you untangle your daily thoughts.', url: '#' },
  { id: 9, title: 'Mood tracking prompts', type: 'toolkit', category: 'self-care', description: 'Templates to gently observe your emotional landscape over time.', url: '#' },
  { id: 10, title: 'Study planning template', type: 'toolkit', category: 'focus', description: 'Organize your academic tasks in a way that feels manageable.', url: '#' },
  { id: 11, title: 'Counsellor Contact', type: 'support', category: 'campus', description: 'Direct contact details for your university counselling center.', url: '/book-appointment' },
  { id: 12, title: 'Helpline Numbers', type: 'support', category: 'campus', description: 'National and local 24/7 mental health crisis lines.', url: '/emergency' },
  { id: 13, title: 'Emergency Support Options', type: 'support', category: 'campus', description: 'Immediate safety resources for when you need help right away.', url: '/emergency' }
];

const Resources = () => {
  const [resources, setResources] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchResources = useCallback(async () => {
    try {
      const response = await api.get('/resources');
      // If no resources in DB, use our sample content per requirement
      setResources(response.data.resources?.length > 0 ? response.data.resources : SAMPLE_RESOURCES);
    } catch (error) {
      console.error('Error fetching resources:', error);
      // Fallback to sample
      setResources(SAMPLE_RESOURCES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const categories = [
    { id: 'all', label: 'Everything', icon: FiHeart },
    { id: 'stress', label: 'Stress Relief', icon: FiWind },
    { id: 'anxiety', label: 'Anxiety Support', icon: FiCoffee },
    { id: 'focus', label: 'Focus & Productivity', icon: FiStar },
    { id: 'sleep', label: 'Sleep & Rest', icon: FiMoon },
    { id: 'self-care', label: 'Self-care', icon: FiHeart },
    { id: 'campus', label: 'Campus Support', icon: FiShield }
  ];

  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      const resCat = (res.category || '').toLowerCase();
      const matchFilter = filter === 'all' || resCat.includes(filter);
      const matchSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (res.description && res.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchFilter && matchSearch;
    });
  }, [resources, filter, searchQuery]);

  const getTypeStyle = (type, category) => {
    const t = (type || '').toLowerCase();
    const c = (category || '').toLowerCase();
    
    if (t === 'video') return { icon: <FiVideo />, grad: 'linear-gradient(135deg, #a78bfa, #c084fc)' };
    if (t === 'podcast' || t === 'audio') return { icon: <FiHeadphones />, grad: 'linear-gradient(135deg, #fbbf24, #f59e0b)' };
    if (t === 'toolkit') return { icon: <FiTool />, grad: 'linear-gradient(135deg, #94a3b8, #cbd5e1)' };
    
    if (c.includes('stress')) return { icon: <FiWind />, grad: 'linear-gradient(135deg, #2ebaa8, #34d399)' };
    if (c.includes('anxiety')) return { icon: <FiCoffee />, grad: 'linear-gradient(135deg, #f472b6, #fb7185)' };
    if (c.includes('sleep')) return { icon: <FiMoon />, grad: 'linear-gradient(135deg, #60a5fa, #818cf8)' };
    if (c.includes('campus')) return { icon: <FiShield />, grad: 'linear-gradient(135deg, #38bdf8, #818cf8)' };
    
    return { icon: <FiBook />, grad: 'linear-gradient(135deg, #f472b6, #fb7185)' };
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } }
  };

  if (loading) return (
    <div className="flex-center" style={{ height: '80vh' }}>
      <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--primary)' }}>
        <FiBook size={32} />
        <span>Gently opening the library...</span>
      </motion.div>
    </div>
  );

  return (
    <div className="resources-page" style={{ paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <header className="page-header" style={{ textAlign: 'center', margin: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ padding: '1rem', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', marginBottom: '1.5rem' }}>
            <FiBook size={32} />
          </motion.div>
          <motion.h1 style={{ fontSize: '2.5rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Quiet Explorations</motion.h1>
          <motion.p className="subtitle" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '500px' }}>
            A curated collection of gentle tools, stories, and practices to help you navigate whatever you're feeling.
          </motion.p>
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} style={{ marginTop: '2.5rem', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.8)', padding: '1rem 1.5rem', borderRadius: '100px', border: '1px solid rgba(46, 186, 168, 0.2)', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <FiSearch style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginRight: '1rem' }} />
              <input 
                type="text" 
                placeholder="What do you need support with today?" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '1.05rem', color: 'var(--text-primary)', fontFamily: 'inherit' }}
              />
            </div>
          </motion.div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          {categories.map((cat) => {
            const Icon = cat.icon || FiBook;
            return (
              <button
                key={cat.id}
                style={{
                  padding: '0.8rem 1.5rem',
                  borderRadius: '100px',
                  border: filter === cat.id ? '2px solid var(--primary)' : '1px solid rgba(46, 186, 168, 0.15)',
                  background: filter === cat.id ? 'var(--primary-light)' : 'rgba(255,255,255,0.6)',
                  color: filter === cat.id ? 'var(--primary-dark)' : 'var(--text-secondary)',
                  fontWeight: filter === cat.id ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onClick={() => setFilter(cat.id)}
              >
                <Icon size={16} /> {cat.label}
              </button>
            )
          })}
        </div>

        <div className="resources-container">
          <AnimatePresence mode="wait">
            {filteredResources.length > 0 ? (
              <motion.div 
                key={filter + searchQuery}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}
              >
                {filteredResources.map((resource) => {
                  const styleInfo = getTypeStyle(resource.type, resource.category);
                  const displayType = resource.category === 'campus' ? 'Campus Link' : (resource.type || 'Reading');
                  return (
                    <motion.div key={resource.id} variants={itemVariants} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0', overflow: 'hidden', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.8)' }}>
                      <div style={{ height: '140px', background: styleInfo.grad, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }} />
                        <div style={{ position: 'relative', zIndex: 1, padding: '1rem', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                          {React.cloneElement(styleInfo.icon, { size: 36 })}
                        </div>
                      </div>
                      
                      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600', color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>
                            {displayType}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                          {resource.title}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', flex: 1 }}>
                          {resource.description || 'A supportive resource for your journey.'}
                        </p>
                        
                        {resource.url && (
                          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.8rem', borderRadius: '100px', background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontWeight: '600', transition: 'all 0.3s ease' }}
                              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(46, 186, 168, 0.4)'; }}
                              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              {resource.type === 'video' ? 'Watch gently' : resource.type === 'podcast' || resource.type === 'audio' ? 'Listen closely' : resource.type === 'toolkit' ? 'Open Toolkit' : 'Explore'} <FiExternalLink />
                            </a>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.4)', borderRadius: '2rem', border: '1px dashed rgba(46, 186, 168, 0.2)', maxWidth: '600px', margin: '0 auto' }}
              >
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--secondary)' }}>
                  <FiWind size={32} />
                </div>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>We’re still gathering helpful resources for you 💙</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                  In the meantime, take a deep breath. Try stepping away from the screen for a short breathing exercise.
                </p>
                <button 
                  style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.75rem 2rem', borderRadius: '100px', cursor: 'pointer', fontWeight: '600' }}
                  onClick={() => { setFilter('all'); setSearchQuery(''); }}
                >
                  View all resources
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Resources;
