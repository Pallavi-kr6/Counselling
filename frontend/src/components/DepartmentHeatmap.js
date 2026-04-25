import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShield, FiRefreshCw, FiInfo, FiAlertTriangle, FiActivity } from 'react-icons/fi';
import api from '../utils/api';

// ─── Colour thresholds ─────────────────────────────────────────────────────────
// Combines avg_mood (1–10 scale) and alert_count to derive a traffic-light status.
// avg_mood >= 6.5 with no alerts   → healthy (green)
// avg_mood 4–6.4  OR  alerts 1–2   → watch   (amber)
// avg_mood < 4    OR  alerts >= 3  → concern (red)
// no data at all                   → empty   (slate)
function getCellStatus(avgMood, alertCount, entryCount) {
  if (entryCount === 0 && alertCount === 0) return 'empty';
  if ((avgMood !== null && avgMood < 4) || alertCount >= 3) return 'concern';
  if ((avgMood !== null && avgMood < 6.5) || alertCount >= 1) return 'watch';
  return 'healthy';
}

const STATUS_CONFIG = {
  empty:   {
    bg:      'rgba(255,255,255,0.03)',
    border:  'rgba(255,255,255,0.07)',
    glow:    'transparent',
    dot:     '#64748b',
    label:   'No data',
    text:    '#64748b',
  },
  healthy: {
    bg:      'rgba(34,197,94,0.15)',
    border:  'rgba(34,197,94,0.35)',
    glow:    'rgba(34,197,94,0.25)',
    dot:     '#22c55e',
    label:   'Healthy',
    text:    '#4ade80',
  },
  watch:   {
    bg:      'rgba(251,191,36,0.15)',
    border:  'rgba(251,191,36,0.40)',
    glow:    'rgba(251,191,36,0.22)',
    dot:     '#fbbf24',
    label:   'Watch',
    text:    '#fcd34d',
  },
  concern: {
    bg:      'rgba(239,68,68,0.18)',
    border:  'rgba(239,68,68,0.48)',
    glow:    'rgba(239,68,68,0.28)',
    dot:     '#ef4444',
    label:   'Concern',
    text:    '#f87171',
  },
};

// ─── Floating tooltip ──────────────────────────────────────────────────────────
function CellTooltip({ cell, visible, above }) {
  if (!visible || !cell) return null;
  const status = getCellStatus(cell.avgMood, cell.alertCount, cell.entryCount);
  const cfg    = STATUS_CONFIG[status];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="tooltip"
          initial={{ opacity: 0, y: above ? 6 : -6, scale: 0.92 }}
          animate={{ opacity: 1, y: 0,              scale: 1      }}
          exit={{    opacity: 0, y: above ? 6 : -6, scale: 0.92   }}
          transition={{ duration: 0.15 }}
          style={{
            position:        'absolute',
            zIndex:          200,
            bottom:          above ? 'calc(100% + 10px)' : undefined,
            top:             above ? undefined             : 'calc(100% + 10px)',
            left:            '50%',
            transform:       'translateX(-50%)',
            minWidth:        200,
            padding:         '12px 16px',
            backgroundColor: 'rgba(8,15,30,0.97)',
            border:          `1px solid ${cfg.border}`,
            borderRadius:    12,
            color:           '#e2e8f0',
            fontSize:        12,
            pointerEvents:   'none',
            backdropFilter:  'blur(20px)',
            boxShadow:       `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.border}`,
            whiteSpace:      'nowrap',
          }}
        >
          {/* Header */}
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc', marginBottom: 8 }}>
            {cell.department}
            <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>
              · {cell.monthLabel}
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Row icon="🧠" label="Avg Mood">
              {cell.avgMood !== null
                ? <strong style={{ color: cfg.text }}>{cell.avgMood.toFixed(1)}/10</strong>
                : <span style={{ color: '#64748b' }}>—</span>}
            </Row>
            <Row icon="🚨" label="Crisis Alerts">
              <strong style={{ color: cell.alertCount > 0 ? '#ef4444' : '#22c55e' }}>
                {cell.alertCount}
              </strong>
            </Row>
            <Row icon="📝" label="Check-ins">
              <strong>{cell.entryCount}</strong>
            </Row>
          </div>

          {/* Status badge */}
          <div style={{
            marginTop:    8,
            paddingTop:   8,
            borderTop:    '1px solid rgba(255,255,255,0.08)',
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            color:        cfg.dot,
            fontWeight:   600,
            fontSize:     11,
            letterSpacing:'0.03em',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: cfg.dot, display: 'inline-block',
              boxShadow: `0 0 6px ${cfg.dot}`,
            }} />
            {cfg.label.toUpperCase()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#94a3b8' }}>{icon} {label}</span>
      {children}
    </div>
  );
}

// ─── Single heat cell ──────────────────────────────────────────────────────────
function HeatCell({ cell, monthIdx, rowIdx, totalRows }) {
  const [hovered, setHovered] = useState(false);
  const status  = getCellStatus(cell.avgMood, cell.alertCount, cell.entryCount);
  const cfg     = STATUS_CONFIG[status];
  // Render tooltip above the fold for rows near the bottom half
  const tooltipAbove = rowIdx > Math.floor(totalRows / 2);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay:    rowIdx * 0.06 + monthIdx * 0.025,
          duration: 0.28,
          ease:     [0.34, 1.56, 0.64, 1],   // spring-like bounce
        }}
        style={{
          width:           76,
          height:          48,
          borderRadius:    10,
          backgroundColor: cfg.bg,
          border:          `1.5px solid ${hovered ? cfg.dot : cfg.border}`,
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
          cursor:          'default',
          position:        'relative',
          overflow:        'hidden',
          transition:      'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
          boxShadow:       hovered ? `0 0 20px ${cfg.glow}, inset 0 0 12px ${cfg.glow}` : 'none',
          transform:       hovered ? 'scale(1.1) translateY(-2px)' : 'scale(1) translateY(0)',
        }}
      >
        {/* Mood score */}
        {status !== 'empty' && (
          <span style={{
            fontSize:    13,
            fontWeight:  700,
            color:       cfg.text,
            lineHeight:  1,
            letterSpacing: '-0.02em',
          }}>
            {cell.avgMood !== null ? cell.avgMood.toFixed(1) : '—'}
          </span>
        )}

        {/* Empty placeholder */}
        {status === 'empty' && (
          <span style={{ fontSize: 16, opacity: 0.2 }}>·</span>
        )}

        {/* Crisis alert badge */}
        {cell.alertCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: rowIdx * 0.06 + monthIdx * 0.025 + 0.2, type: 'spring' }}
            style={{
              position:        'absolute',
              top:             4,
              right:           4,
              minWidth:        16,
              height:          16,
              borderRadius:    8,
              backgroundColor: '#ef4444',
              color:           '#fff',
              fontSize:        9,
              fontWeight:      800,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              padding:         '0 3px',
              boxShadow:       '0 0 8px rgba(239,68,68,0.7)',
            }}
          >
            {cell.alertCount}
          </motion.span>
        )}
      </motion.div>

      <CellTooltip cell={cell} visible={hovered} above={tooltipAbove} />
    </div>
  );
}

// ─── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonGrid({ rows = 4, cols = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 130, height: 20, borderRadius: 6,
            background: 'rgba(255,255,255,0.06)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} style={{
              width: 76, height: 48, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              animation: `pulse 1.5s ease-in-out ${(r + c) * 0.08}s infinite`,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Legend pill ───────────────────────────────────────────────────────────────
function LegendPill({ status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             6,
      padding:         '5px 12px',
      borderRadius:    20,
      backgroundColor: cfg.bg,
      border:          `1px solid ${cfg.border}`,
      fontSize:        12,
      fontWeight:      600,
      color:           cfg.text,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: cfg.dot,
        boxShadow:       `0 0 6px ${cfg.dot}`,
      }} />
      {cfg.label}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
const DepartmentHeatmap = () => {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [months,   setMonths]   = useState(6);
  const [showInfo, setShowInfo] = useState(false);

  const fetchData = useCallback(async (m) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/admin/department-heatmap?months=${m}`);
      setData(res.data);
    } catch (err) {
      console.error('Heatmap fetch error:', err);
      setError(err.response?.data?.error || 'Could not load department heatmap data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(months); }, [fetchData, months]);

  // Build lookup: { dept: { monthKey: cell } }
  const cellLookup = {};
  (data?.cells || []).forEach(c => {
    if (!cellLookup[c.department]) cellLookup[c.department] = {};
    cellLookup[c.department][c.monthKey] = c;
  });

  // Summary stats
  const concernDepts = data
    ? [...new Set(data.cells.filter(c =>
        getCellStatus(c.avgMood, c.alertCount, c.entryCount) === 'concern'
      ).map(c => c.department))]
    : [];

  return (
    <div style={{
      background:   'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding:      '2rem',
      backdropFilter: 'blur(16px)',
      overflow:     'hidden',
      position:     'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position:         'absolute', top: -60, right: -60,
        width:            200, height: 200, borderRadius: '50%',
        background:       'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents:    'none',
      }} />

      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{
        display:      'flex',
        alignItems:   'flex-start',
        justifyContent:'space-between',
        marginBottom: '1.5rem',
        flexWrap:     'wrap',
        gap:          '1rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              padding:         8,
              background:      'rgba(99,102,241,0.15)',
              borderRadius:    10,
              color:           '#818cf8',
              display:         'flex',
            }}>
              <FiActivity size={18} />
            </div>
            <h2 style={{
              margin:      0,
              fontSize:    '1.2rem',
              fontWeight:  700,
              color:       '#f1f5f9',
              letterSpacing: '-0.01em',
            }}>
              Department Wellness Heatmap
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Avg mood score &amp; crisis alert count — aggregated by department &amp; month
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Privacy badge */}
          <div style={{
            display:         'flex',
            alignItems:      'center',
            gap:             6,
            padding:         '6px 12px',
            borderRadius:    20,
            backgroundColor: 'rgba(34,197,94,0.1)',
            border:          '1px solid rgba(34,197,94,0.25)',
            fontSize:        11,
            fontWeight:      600,
            color:           '#4ade80',
            letterSpacing:   '0.03em',
          }}>
            <FiShield size={12} />
            ANONYMISED
          </div>

          {/* Month range selector */}
          <select
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
            style={{
              background:   'rgba(255,255,255,0.06)',
              border:       '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color:        '#94a3b8',
              padding:      '5px 10px',
              fontSize:     12,
              cursor:       'pointer',
              outline:      'none',
            }}
          >
            {[3, 6, 9, 12].map(m => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => fetchData(months)}
            disabled={loading}
            style={{
              display:         'flex',
              alignItems:      'center',
              gap:             5,
              padding:         '5px 12px',
              borderRadius:    8,
              border:          '1px solid rgba(255,255,255,0.1)',
              background:      'rgba(255,255,255,0.05)',
              color:           '#94a3b8',
              fontSize:        12,
              cursor:          loading ? 'not-allowed' : 'pointer',
              opacity:         loading ? 0.5 : 1,
              transition:      'all 0.2s',
            }}
          >
            <FiRefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Alert banner for departments of concern ─────────── */}
      {!loading && concernDepts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             10,
            padding:         '10px 16px',
            borderRadius:    10,
            backgroundColor: 'rgba(239,68,68,0.1)',
            border:          '1px solid rgba(239,68,68,0.3)',
            marginBottom:    '1.5rem',
            fontSize:        13,
            color:           '#fca5a5',
          }}
        >
          <FiAlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>
            <strong style={{ color: '#ef4444' }}>{concernDepts.length} department{concernDepts.length > 1 ? 's' : ''}</strong>
            {' '}flagged for concern this period: {concernDepts.join(', ')}
          </span>
        </motion.div>
      )}

      {/* ── Body ────────────────────────────────────────────── */}
      {loading && <SkeletonGrid rows={4} cols={months} />}

      {error && !loading && (
        <div style={{
          textAlign: 'center', padding: '3rem',
          color: '#ef4444', fontSize: 14,
        }}>
          <FiAlertTriangle size={28} style={{ marginBottom: 8 }} />
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.departments.length === 0 ? (
            <div style={{
              textAlign:  'center',
              padding:    '3rem',
              color:      '#64748b',
              fontSize:   14,
            }}>
              No department data found. Ensure students have a <strong>department</strong> field
              in their profile and have submitted mood check-ins.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: '8px 8px', width: '100%' }}>
                <thead>
                  <tr>
                    {/* dept label column */}
                    <th style={{
                      textAlign:  'left',
                      fontSize:   11,
                      fontWeight: 600,
                      color:      '#475569',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      paddingBottom: 4,
                      minWidth:   130,
                    }}>
                      Department
                    </th>
                    {data.months.map(m => (
                      <th key={m.key} style={{
                        textAlign:  'center',
                        fontSize:   11,
                        fontWeight: 600,
                        color:      '#475569',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        paddingBottom: 4,
                        width:      76,
                      }}>
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map((dept, rowIdx) => (
                    <motion.tr
                      key={dept}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: rowIdx * 0.07, duration: 0.3 }}
                    >
                      {/* Department label */}
                      <td style={{ paddingRight: 8 }}>
                        <div style={{
                          fontSize:     13,
                          fontWeight:   600,
                          color:        '#cbd5e1',
                          maxWidth:     130,
                          overflow:     'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace:   'nowrap',
                        }}
                          title={dept}
                        >
                          {dept}
                        </div>
                      </td>

                      {/* Heat cells */}
                      {data.months.map((m, monthIdx) => {
                        const cell = cellLookup[dept]?.[m.key] || {
                          department: dept,
                          monthKey:   m.key,
                          monthLabel: m.label,
                          avgMood:    null,
                          alertCount: 0,
                          entryCount: 0,
                        };
                        return (
                          <td key={m.key} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <HeatCell
                              cell={cell}
                              monthIdx={monthIdx}
                              rowIdx={rowIdx}
                              totalRows={data.departments.length}
                            />
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Legend ────────────────────────────────────── */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            gap:            10,
            marginTop:      '1.5rem',
            paddingTop:     '1rem',
            borderTop:      '1px solid rgba(255,255,255,0.07)',
            flexWrap:       'wrap',
          }}>
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Legend
            </span>
            {['healthy', 'watch', 'concern', 'empty'].map(s => (
              <LegendPill key={s} status={s} />
            ))}
            <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>
              · Number badge = crisis alerts · Score = avg mood (1–10)
            </span>
          </div>

          {/* ── Privacy footer ────────────────────────────── */}
          <div style={{
            display:       'flex',
            alignItems:    'center',
            gap:           6,
            marginTop:     '1rem',
            fontSize:      11,
            color:         '#334155',
            letterSpacing: '0.02em',
          }}>
            <FiShield size={11} />
            {data.dataPrivacy}
          </div>
        </>
      )}

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes pulse {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1;   }
        }
        @keyframes spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DepartmentHeatmap;
