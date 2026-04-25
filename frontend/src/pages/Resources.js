import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { 
  FiBook, FiVideo, FiHeadphones, FiSearch, FiExternalLink, 
  FiWind, FiHeart, FiStar, FiCoffee, FiMoon, FiShield, 
  FiTool, FiPlus, FiX, FiFile, FiTrash2, FiUsers, FiGrid, 
  FiActivity, FiFileText, FiZap 
} from 'react-icons/fi';

import './Resources.css';

// ── Canonical categories (matching DB ENUM) ────────────────────────────────
const CATEGORIES = [
  { id: 'all',           label: 'All Resources',  icon: FiGrid,     accent: '#6366f1' },
  { id: 'stress',        label: 'Stress',          icon: FiWind,     accent: '#22c55e' },
  { id: 'anxiety',       label: 'Anxiety',         icon: FiHeart,    accent: '#f59e0b' },
  { id: 'relationships', label: 'Relationships',   icon: FiUsers,    accent: '#f472b6' },
  { id: 'academic',      label: 'Academic',        icon: FiActivity, accent: '#38bdf8' },
];

const TYPE_CONFIG = {
  article:  { icon: FiFileText, label: 'Article',  grad: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  video:    { icon: FiVideo,    label: 'Video',    grad: 'linear-gradient(135deg, #ef4444, #f97316)' },
  exercise: { icon: FiZap,      label: 'Exercise', grad: 'linear-gradient(135deg, #22c55e, #10b981)' },
};

const CATEGORY_CONFIG = {
  stress:        { grad: 'linear-gradient(135deg, #22c55e, #34d399)', accent: '#22c55e' },
  anxiety:       { grad: 'linear-gradient(135deg, #f59e0b, #fbbf24)', accent: '#f59e0b' },
  relationships: { grad: 'linear-gradient(135deg, #f472b6, #fb7185)', accent: '#f472b6' },
  academic:      { grad: 'linear-gradient(135deg, #38bdf8, #818cf8)', accent: '#38bdf8' },
};

// ── Local seed — shown while DB data loads or on error ────────────────────
const SEED_RESOURCES = [
  { id: 's1', title: 'Box Breathing Exercise (4-4-4-4)', category: 'stress',        type: 'exercise', description: 'A structured breath technique used to immediately calm the nervous system under pressure.', content_url: 'https://www.healthline.com/health/box-breathing' },
  { id: 's2', title: '5-Minute Stress Relief Breathing', category: 'stress',        type: 'video',    description: 'Follow this gentle visual guide to lower cortisol and activate your parasympathetic system.', content_url: 'https://www.youtube.com/watch?v=nmFUDkj1Aq0' },
  { id: 's3', title: 'Managing Academic Stress',          category: 'stress',        type: 'article',  description: 'Evidence-based, practical steps to handle workload pressure without overwhelming yourself.', content_url: 'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/relaxation-downloads/managing-academic-stress' },
  { id: 's4', title: '5-4-3-2-1 Grounding Technique',    category: 'anxiety',       type: 'article',  description: 'Anchor yourself to the present using your five senses — instant relief for spiralling thoughts.', content_url: 'https://www.urmc.rochester.edu/behavioral-health-partners/bhp-blog/april-2018/5-4-3-2-1-coping-technique-for-anxiety.aspx' },
  { id: 's5', title: 'Guided Anxiety Relief Breathing',   category: 'anxiety',       type: 'video',    description: 'A calming, 2-minute visual guide perfectly paced to quiet an anxious mind.', content_url: 'https://www.youtube.com/watch?v=aNXKjGFUlMs' },
  { id: 's6', title: 'Progressive Muscle Relaxation',     category: 'anxiety',       type: 'exercise', description: 'Systematically tense and release muscle groups to release anxiety stored in your body.', content_url: 'https://www.anxietycanada.com/articles/how-to-do-progressive-muscle-relaxation/' },
  { id: 's7', title: 'Navigating Loneliness at University', category: 'relationships', type: 'article',  description: 'A research-backed guide to building genuine connection and easing the quiet ache of loneliness.', content_url: 'https://www.psychologytoday.com/us/blog/romantically-attached/202301/how-to-cope-with-loneliness-in-college' },
  { id: 's8', title: 'Setting Healthy Boundaries',        category: 'relationships', type: 'article',  description: 'Express needs, say no without guilt, and build relationships that actually feel safe.', content_url: 'https://www.betterhelp.com/advice/relations/setting-healthy-boundaries/' },
  { id: 's9', title: 'Expressive Writing for Connection', category: 'relationships', type: 'exercise', description: 'Use structured journaling prompts to process relationship hurt, loneliness, or conflict.', content_url: 'https://ggia.berkeley.edu/practice/expressive_writing' },
  { id: 's10', title: 'Evidence-Based Study Techniques', category: 'academic',      type: 'article',  description: 'Why retrieval practice and spaced repetition outperform any other study method.', content_url: 'https://learningscientists.org/six-strategies-for-effective-learning' },
  { id: 's11', title: 'The Pomodoro Technique',           category: 'academic',      type: 'video',    description: 'Work in 25-minute sprints with built-in breaks to sustain focus without burning out.', content_url: 'https://www.youtube.com/watch?v=mNBmG24djoY' },
  { id: 's12', title: 'Weekly Study Planner Exercise',    category: 'academic',      type: 'exercise', description: 'A structured time-blocking exercise to turn overwhelming to-do lists into a manageable plan.', content_url: 'https://www.notion.so/templates/student-dashboard' },
];

// ── Card component ──────────────────────────────────────────────────────────
function ResourceCard({ resource, variants }) {
  const typeCfg    = TYPE_CONFIG[resource.type]  || TYPE_CONFIG.article;
  const catCfg     = CATEGORY_CONFIG[resource.category] || { grad: 'linear-gradient(135deg, #6366f1, #8b5cf6)', accent: '#6366f1' };
  const TypeIcon   = typeCfg.icon;
  const link       = resource.content_url || resource.url || '#';
  const isInternal = link.startsWith('/');

  const handleOpen = () => {
    if (!isInternal) {
      api.post(`/resources/${resource.id}/view`).catch(() => {});
    }
  };

  return (
    <motion.div
      variants={variants}
      style={{
        display:       'flex',
        flexDirection: 'column',
        borderRadius:  '1.5rem',
        overflow:      'hidden',
        background:    'rgba(255,255,255,0.55)',
        backdropFilter:'blur(12px)',
        border:        '1px solid rgba(255,255,255,0.7)',
        boxShadow:     '0 4px 24px rgba(0,0,0,0.06)',
        transition:    'transform 0.25s ease, box-shadow 0.25s ease',
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
    >
      {/* Colour bar */}
      <div style={{
        height:     6,
        background: catCfg.grad,
        flexShrink: 0,
      }} />

      {/* Type icon header */}
      <div style={{
        height:         120,
        background:     typeCfg.grad,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        position:       'relative',
        overflow:       'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }} />
        <div style={{
          position:        'relative', zIndex: 1,
          padding:         '1rem', borderRadius: '50%',
          background:      'rgba(255,255,255,0.2)',
          color:           '#fff',
          boxShadow:       '0 8px 32px rgba(0,0,0,0.12)',
          display:         'flex',
        }}>
          <TypeIcon size={34} />
        </div>
        {/* Type badge */}
        <div style={{
          position:        'absolute', top: 12, right: 12,
          background:      'rgba(255,255,255,0.25)',
          backdropFilter:  'blur(8px)',
          border:          '1px solid rgba(255,255,255,0.4)',
          color:           '#fff',
          fontSize:        11, fontWeight: 700,
          letterSpacing:   '0.06em',
          textTransform:   'uppercase',
          padding:         '3px 10px', borderRadius: 20,
        }}>
          {typeCfg.label}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1.4rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Category chip */}
        <span style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            4,
          fontSize:       11, fontWeight: 700,
          letterSpacing:  '0.05em', textTransform: 'uppercase',
          color:          catCfg.accent,
          background:     `${catCfg.accent}18`,
          border:         `1px solid ${catCfg.accent}40`,
          padding:        '3px 10px', borderRadius: 20,
          marginBottom:   '0.75rem',
          width:          'fit-content',
        }}>
          {resource.category}
        </span>

        <h3 style={{
          fontSize:     '1.1rem', fontWeight: 700,
          color:        'var(--text-primary)',
          marginBottom: '0.6rem', lineHeight: 1.4,
          margin:       '0 0 0.6rem',
        }}>
          {resource.title}
        </h3>

        <p style={{
          color:       'var(--text-secondary)',
          fontSize:    '0.9rem', lineHeight: 1.6,
          flex:        1, margin: '0 0 1.25rem',
        }}>
          {resource.description || 'A supportive resource for your mental health journey.'}
        </p>

        {link !== '#' && (
          <a
            href={link}
            target={isInternal ? '_self' : '_blank'}
            rel="noopener noreferrer"
            onClick={handleOpen}
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             '0.5rem',
              padding:         '0.75rem',
              borderRadius:    '100px',
              background:      catCfg.accent,
              color:           '#fff',
              textDecoration:  'none',
              fontWeight:      600,
              fontSize:        '0.9rem',
              transition:      'all 0.2s ease',
              boxShadow:       `0 4px 14px ${catCfg.accent}44`,
            }}
            onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e  => { e.currentTarget.style.filter = 'brightness(1)';   e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {resource.type === 'video' ? 'Watch' : resource.type === 'exercise' ? 'Try it' : 'Read'}
            <FiExternalLink size={13} />
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
const Resources = () => {
  const { user } = useAuth();
  const [resources,    setResources]    = useState([]);
  const [filter,       setFilter]       = useState('all');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'article',
    category: 'stress',
    url: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const handleAddResource = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalUrl = formData.url;
      if (selectedFile) {
        const timestamp = Date.now();
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${timestamp}-${cleanName}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('resources')
          .upload(filePath, selectedFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('resources').getPublicUrl(filePath);
        if (!data?.publicUrl) throw new Error('Failed to generate public URL');
        finalUrl = data.publicUrl;
      }

      await api.post('/resources', { ...formData, url: finalUrl });
      setShowAddModal(false);
      setFormData({ title: '', description: '', type: 'article', category: 'stress', url: '' });
      setSelectedFile(null);
      fetchResources();
    } catch (error) {
      console.error('Error adding resource:', error);
      alert(error.message || 'Failed to add resource');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteResource = async (id) => {
    if (!window.confirm('Are you sure you want to remove this resource?')) return;
    try {
      await api.delete(`/resources/${id}`);
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      alert(error.response?.data?.error || 'Failed to delete resource');
    }
  };


  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/resources');
      const dbResources = response.data.resources || [];
      setResources(dbResources.length > 0 ? dbResources : SEED_RESOURCES);
    } catch (error) {
      console.error('Error fetching resources:', error);
      setResources(SEED_RESOURCES);

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const filtered = useMemo(() => {
    return resources.filter(res => {
      const matchCat    = filter     === 'all' || res.category === filter;
      const matchType   = typeFilter === 'all' || res.type     === typeFilter;
      const q           = searchQuery.toLowerCase();
      const matchSearch = !q || res.title.toLowerCase().includes(q) 
        || (res.description && res.description.toLowerCase().includes(q));
      return matchCat && matchType && matchSearch;
    });
  }, [resources, filter, typeFilter, searchQuery]);

  const counts = useMemo(() => {
    const c = { all: resources.length };
    CATEGORIES.slice(1).forEach(cat => {
      c[cat.id] = resources.filter(r => r.category === cat.id).length;
    });
    return c;
  }, [resources]);


  const containerVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden:  { y: 20, opacity: 0 },
    visible: { y: 0,  opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: 1200, padding: '0 1.5rem' }}>

        {/* ── Hero ──────────────────────────────────────────── */}
        <header style={{ textAlign: 'center', padding: '3rem 0 2.5rem' }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            style={{
              display:        'inline-flex',
              padding:        '1rem',
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
              color:          '#6366f1',
              marginBottom:   '1.25rem',
            }}
          >
            <FiBook size={36} />
          </motion.div>

          <motion.h1
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}
          >
            Resource Library
          </motion.h1>
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            transition={{ delay: 0.15 }}
            style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 2rem' }}
          >
            Curated articles, videos, and exercises for stress, anxiety, relationships, and academic wellbeing.
          </motion.p>

          {user?.userType === 'counsellor' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              style={{
                marginTop: '1.5rem',
                padding: '0.8rem 2rem',
                borderRadius: '100px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '1.5rem auto 0',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}
            >
              <FiPlus /> Add New Resource
            </motion.button>
          )}

          {/* Search bar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '0.75rem',
              background:   'rgba(255,255,255,0.8)',
              backdropFilter:'blur(12px)',
              padding:      '0.85rem 1.5rem',
              borderRadius: '100px',
              border:       '1.5px solid rgba(99,102,241,0.2)',
              boxShadow:    '0 4px 20px rgba(0,0,0,0.05)',
              maxWidth:     580,
              margin:       '2.5rem auto 0',
            }}
          >
            <FiSearch style={{ color: 'var(--text-secondary)', flexShrink: 0 }} size={18} />
            <input
              type="text"
              placeholder="Search resources — e.g. 'exam stress', 'breathing'…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                border: 'none', background: 'transparent',
                outline: 'none', flex: 1,
                fontSize: '1rem', color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
              >
                ✕
              </button>
            )}

          </motion.div>
        </header>

        {/* ── Category filters ───────────────────────────────── */}
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          flexWrap:       'wrap',
          gap:            '0.75rem',
          marginBottom:   '1.5rem',
        }}>
          {CATEGORIES.map(cat => {
            const Icon    = cat.icon;
            const active  = filter === cat.id;
            const count   = counts[cat.id] || 0;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(cat.id)}
                style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         6,
                  padding:     '0.65rem 1.25rem',
                  borderRadius:'100px',
                  border:      active ? `2px solid ${cat.accent}` : '1.5px solid rgba(0,0,0,0.08)',
                  background:  active ? `${cat.accent}18` : 'rgba(255,255,255,0.7)',
                  color:       active ? cat.accent        : 'var(--text-secondary)',
                  fontWeight:  active ? 700               : 500,
                  fontSize:    '0.9rem',
                  cursor:      'pointer',
                  transition:  'all 0.2s ease',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Icon size={15} />
                {cat.label}
                <span style={{
                  fontSize:   11, fontWeight: 600,
                  background: active ? cat.accent : 'rgba(0,0,0,0.08)',
                  color:      active ? '#fff'     : 'var(--text-secondary)',
                  padding:    '1px 7px', borderRadius: 20,
                }}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* ── Type filter pills ──────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all',      label: 'All Types' },
            { id: 'article',  label: '📄 Articles'  },
            { id: 'video',    label: '🎬 Videos'    },
            { id: 'exercise', label: '⚡ Exercises'  },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              style={{
                padding:     '0.4rem 1rem',
                borderRadius:'100px',
                border:      typeFilter === t.id ? '1.5px solid #6366f1' : '1.5px solid rgba(0,0,0,0.07)',
                background:  typeFilter === t.id ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.6)',
                color:       typeFilter === t.id ? '#6366f1' : 'var(--text-secondary)',
                fontWeight:  typeFilter === t.id ? 700        : 500,
                fontSize:    '0.85rem', cursor: 'pointer',
                transition:  'all 0.18s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Grid ──────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                height: 320, borderRadius: '1.5rem',
                background:  'rgba(255,255,255,0.5)',
                animation:   `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
              }} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {filtered.length > 0 ? (
              <motion.div
                key={filter + typeFilter + searchQuery}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}
              >
                {filtered.map(r => (
                  <div key={r.id} style={{ position: 'relative' }}>
                    <ResourceCard resource={r} variants={itemVariants} />
                    {user?.userType === 'counsellor' && typeof r.id === 'string' && (
                      <motion.button
                        whileHover={{ scale: 1.1, color: '#ef4444' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteResource(r.id)}
                        style={{
                          position: 'absolute', top: 18, right: 55,
                          background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255,255,255,0.4)', color: '#fff',
                          borderRadius: '50%', width: 28, height: 28,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', zIndex: 10
                        }}
                        title="Delete Resource"
                      >
                        <FiTrash2 size={14} />
                      </motion.button>
                    )}
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  textAlign:   'center',
                  padding:     '4rem 2rem',
                  background:  'rgba(255,255,255,0.5)',
                  borderRadius:'2rem',
                  border:      '1.5px dashed rgba(99,102,241,0.25)',
                  maxWidth:    600, margin: '0 auto',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No resources match that search</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Try a different search term or browse all categories.
                </p>
                <button
                  onClick={() => { setFilter('all'); setTypeFilter('all'); setSearchQuery(''); }}
                  style={{
                    background: '#6366f1', color: '#fff', border: 'none',
                    padding: '0.75rem 2rem', borderRadius: '100px',
                    fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
                  }}
                >
                  View all resources
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card"
              style={{ width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative', background: '#fff', borderRadius: '1.5rem' }}
            >
              <button
                onClick={() => setShowAddModal(false)}
                style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <FiX size={24} />
              </button>

              <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Add New Resource</h2>

              <form onSubmit={handleAddResource} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Resource title"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', minHeight: '100px', resize: 'vertical' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }}
                  >
                    <option value="stress">Stress Relief</option>
                    <option value="anxiety">Anxiety Support</option>
                    <option value="relationships">Relationships</option>
                    <option value="academic">Academic Wellbeing</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }}
                  >
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="exercise">Exercise</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    URL or Link (Optional if uploading)
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload File (Optional)</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px dashed #6366f1', background: 'rgba(255,255,255,0.3)' }}
                    accept=".doc,.docx,.pdf,.ppt,.pptx,.txt"
                  />
                  {selectedFile && (
                    <p style={{ fontSize: '0.8rem', color: '#6366f1', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FiFile /> {selectedFile.name} selected
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    marginTop: '0.5rem',
                    padding: '1rem',
                    borderRadius: '100px',
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    fontWeight: '700',
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? 'Adding...' : 'Add Resource'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }
      `}</style>

    </div>
  );
};

export default Resources;
