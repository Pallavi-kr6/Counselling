import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFileText, FiDownload, FiPlus, FiChevronLeft, FiTrash2, FiCheckCircle, FiCalendar, FiUser, FiBarChart2 } from 'react-icons/fi';
import api from '../utils/api';
import './ProgressReports.css';

const ProgressReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);

  useEffect(() => {
    fetchReports();
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReports = async () => {
    try {
      const response = await api.get('/appointments/progress-reports');
      setReports(response.data.reports || []);
    } catch (err) { console.error(err); }
  };

  const fetchStudents = async () => {
    try {
      const resp = await api.get('/appointments/counsellor/' + user.id);
      const unique = [];
      const map = new Map();
      (resp.data.appointments || []).forEach(apt => {
        if (apt.student && !map.has(apt.student.user_id)) {
          map.set(apt.student.user_id, apt.student);
          unique.push(apt.student);
        }
      });
      setStudents(unique);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleCreateReport = async () => {
    if (!selectedStudent || !selectedWeek) return;
    const weekStart = new Date(selectedWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    try {
      const existing = await api.get(`/appointments/progress-reports/${selectedStudent}/${weekStartStr}`);
      if (existing.data.report) {
        setCurrentReport(existing.data.report);
      } else {
        const student = students.find(s => s.user_id === selectedStudent);
        setCurrentReport({
          student_id: selectedStudent,
          week_start: weekStartStr,
          week_end: weekEndStr,
          student_name: student?.name || 'Student',
          register_number: '',
          department_year: `${student?.department || ''} / ${student?.year || ''}`,
          counsellor_name: user.name || 'Counsellor',
          academic_performance: [],
          previous_goals_review: [],
          issues_challenges: [],
          other_issues: '',
          counseling_support: {
            academic_guidance: '',
            study_strategy: '',
            motivational_support: '',
            peer_study: '',
            parent_communication: ''
          },
          next_week_plan: [],
          counsellor_remarks: '',
          student_commitment: false,
          student_signature: '',
          student_signature_date: new Date().toISOString().split('T')[0],
          counsellor_signature: user.name || '',
          counsellor_signature_date: new Date().toISOString().split('T')[0]
        });
      }
      setShowForm(true);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-screen">Preparing your reports...</div>;

  return (
    <div className="progress-reports">
      <div className="container">
        <header className="page-header-modern">
          <h1>Student Progress Insights</h1>
          <p>Track academic growth and emotional well-being over time.</p>
        </header>

        {!showForm ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="reports-dashboard">
            <div className="create-report-hero glass-card">
              <div className="hero-content">
                <h2>Generate Weekly Insight</h2>
                <p>Select a student and week to document progress.</p>
              </div>
              <div className="hero-form">
                <select className="glass-select" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                  <option value="">Choose Student</option>
                  {students.map(s => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                </select>
                <input type="date" className="glass-input" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} />
                <button className="btn btn-primary btn-icon-only" onClick={handleCreateReport} disabled={!selectedStudent || !selectedWeek}>
                  <FiPlus />
                </button>
              </div>
            </div>

            <div className="reports-section">
              <div className="section-header">
                <h2><FiFileText /> Recent Reports</h2>
              </div>
              <div className="reports-grid-modern">
                <AnimatePresence>
                  {reports.length > 0 ? (
                    reports.map(report => (
                      <motion.div key={report.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="report-card-premium glass-morphism">
                        <div className="report-badge"><FiUser /></div>
                        <div className="report-main-info">
                          <h3>{report.student_name}</h3>
                          <span className="week-label"><FiCalendar /> {report.week_start}</span>
                        </div>
                        <div className="report-actions-mini">
                          <button className="btn-icon" onClick={() => { setCurrentReport(report); setShowForm(true); }}><FiFileText /></button>
                          <button className="btn-icon primary" onClick={async () => {
                            try {
                              const response = await api.get(`/appointments/progress-reports/${report.id}/pdf`, { responseType: 'blob' });
                              const url = window.URL.createObjectURL(new Blob([response.data]));
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', `progress-report-${report.student_name}-${report.week_start}.pdf`);
                              document.body.appendChild(link);
                              link.click();
                            } catch (err) { console.error('PDF Download failed', err); }
                          }}><FiDownload /></button>
                        </div>
                      </motion.div>
                    ))
                  ) : <div className="empty-reports">No reports recorded yet.</div>}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : (
          <ProgressReportForm 
            report={currentReport}
            onSave={async (updated) => {
              try {
                await api.post('/appointments/progress-reports', updated);
                await fetchReports();
                setShowForm(false);
              } catch (err) { console.error(err); }
            }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  );
};

const ProgressReportForm = ({ report, onSave, onCancel }) => {
  const [formData, setFormData] = useState(report);

  const updateArray = (field, index, key, val) => {
    const arr = [...(formData[field] || [])];
    arr[index] = { ...arr[index], [key]: val };
    setFormData({ ...formData, [field]: arr });
  };

  const toggleIssue = (issue) => {
    const current = formData.issues_challenges || [];
    if (current.includes(issue)) {
      setFormData({ ...formData, issues_challenges: current.filter(i => i !== issue) });
    } else {
      setFormData({ ...formData, issues_challenges: [...current, issue] });
    }
  };

  const updateSupport = (key, val) => {
    setFormData({
      ...formData,
      counseling_support: { ...formData.counseling_support, [key]: val }
    });
  };

  const issueOptions = [
    'Lack of conceptual clarity in subjects',
    'Poor time management',
    'Low attendance/absenteeism',
    'Lack of motivation/confidence',
    'Distractions (social media, gaming, etc.)',
    'Personal / family issues',
    'Health issues'
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="report-form-container glass-card">
      <div className="form-header-modern">
        <button className="btn-back" onClick={onCancel}><FiChevronLeft /> Back to List</button>
        <h1>Weekly Counseling Progress Report</h1>
      </div>

      <div className="report-form-sections">
        {/* Core Info */}
        <div className="form-section-modern">
          <h3><FiUser /> Student Information</h3>
          <div className="form-grid-3">
            <div className="input-group-modern">
              <label>Student Name</label>
              <input type="text" className="glass-input" value={formData.student_name} readOnly />
            </div>
            <div className="input-group-modern">
              <label>Register Number</label>
              <input type="text" className="glass-input" value={formData.register_number} onChange={(e) => setFormData({...formData, register_number: e.target.value})} />
            </div>
            <div className="input-group-modern">
              <label>Dept / Year</label>
              <input type="text" className="glass-input" value={formData.department_year} onChange={(e) => setFormData({...formData, department_year: e.target.value})} />
            </div>
          </div>
          <div className="form-grid-2" style={{marginTop: '1rem'}}>
            <div className="input-group-modern">
              <label>Week Start</label>
              <input type="date" className="glass-input" value={formData.week_start} readOnly />
            </div>
            <div className="input-group-modern">
              <label>Week End</label>
              <input type="date" className="glass-input" value={formData.week_end} onChange={(e) => setFormData({...formData, week_end: e.target.value})} />
            </div>
          </div>
        </div>

        {/* 1. Academic Performance */}
        <div className="form-section-modern">
          <h3><FiBarChart2 /> 1. Academic Performance</h3>
          <div className="performance-table">
            <div className="table-header-row">
              <span>Subject</span>
              <span>Score %</span>
              <span>Attendance %</span>
              <span>Remarks</span>
              <span></span>
            </div>
            {(formData.academic_performance || []).map((sub, i) => (
              <div key={i} className="academic-row glass-morphism">
                <input placeholder="Subject" className="glass-input-sm" value={sub.subject} onChange={(e) => updateArray('academic_performance', i, 'subject', e.target.value)} />
                <input placeholder="Score" className="glass-input-sm" value={sub.score} onChange={(e) => updateArray('academic_performance', i, 'score', e.target.value)} />
                <input placeholder="Attendance" className="glass-input-sm" value={sub.attendance} onChange={(e) => updateArray('academic_performance', i, 'attendance', e.target.value)} />
                <input placeholder="Remarks" className="glass-input-sm" value={sub.remarks} onChange={(e) => updateArray('academic_performance', i, 'remarks', e.target.value)} />
                <button className="btn-trash" onClick={() => setFormData({ ...formData, academic_performance: formData.academic_performance.filter((_, idx) => idx !== i) })}><FiTrash2 /></button>
              </div>
            ))}
            <button className="btn-add" onClick={() => setFormData({ ...formData, academic_performance: [...(formData.academic_performance || []), { subject: '', score: '', attendance: '', remarks: '' }] })}><FiPlus /> Add Subject</button>
          </div>
        </div>

        {/* 2. Previous Week's Goals */}
        <div className="form-section-modern">
          <h3><FiCheckCircle /> 2. Review of the Previous Week's Goals</h3>
          <div className="goals-table">
            <div className="table-header-row goals">
              <span>Goal</span>
              <span>Status</span>
              <span>Reason for Status</span>
              <span></span>
            </div>
            {(formData.previous_goals_review || []).map((goal, i) => (
              <div key={i} className="goal-row glass-morphism">
                <input placeholder="Goal" className="glass-input-sm" value={goal.goal} onChange={(e) => updateArray('previous_goals_review', i, 'goal', e.target.value)} />
                <select className="glass-select-sm" value={goal.status} onChange={(e) => updateArray('previous_goals_review', i, 'status', e.target.value)}>
                  <option value="">Status</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Not Started">Not Started</option>
                </select>
                <input placeholder="Reason" className="glass-input-sm" value={goal.reason} onChange={(e) => updateArray('previous_goals_review', i, 'reason', e.target.value)} />
                <button className="btn-trash" onClick={() => setFormData({ ...formData, previous_goals_review: formData.previous_goals_review.filter((_, idx) => idx !== i) })}><FiTrash2 /></button>
              </div>
            ))}
            <button className="btn-add" onClick={() => setFormData({ ...formData, previous_goals_review: [...(formData.previous_goals_review || []), { goal: '', status: '', reason: '' }] })}><FiPlus /> Add Goal Review</button>
          </div>
        </div>

        {/* 3. Issues / Challenges */}
        <div className="form-section-modern">
          <h3><FiBarChart2 /> 3. Issues / Challenges Faced This Week</h3>
          <div className="issues-grid">
            {issueOptions.map(issue => (
              <label key={issue} className="checkbox-label">
                <input type="checkbox" checked={(formData.issues_challenges || []).includes(issue)} onChange={() => toggleIssue(issue)} />
                {issue}
              </label>
            ))}
            <div className="input-group-modern" style={{marginTop: '1rem'}}>
              <label>Other Issues</label>
              <input type="text" className="glass-input" value={formData.other_issues || ''} onChange={(e) => setFormData({...formData, other_issues: e.target.value})} placeholder="Specify other issues..." />
            </div>
          </div>
        </div>

        {/* 4. Counseling & Support */}
        <div className="form-section-modern">
          <h3><FiPlus /> 4. Counseling & Support Provided</h3>
          <div className="support-grid">
            <div className="input-group-modern">
              <label>Academic guidance</label>
              <input type="text" className="glass-input" value={formData.counseling_support?.academic_guidance || ''} onChange={(e) => updateSupport('academic_guidance', e.target.value)} />
            </div>
            <div className="input-group-modern">
              <label>Study strategy suggestions</label>
              <input type="text" className="glass-input" value={formData.counseling_support?.study_strategy || ''} onChange={(e) => updateSupport('study_strategy', e.target.value)} />
            </div>
            <div className="input-group-modern">
              <label>Motivational support</label>
              <input type="text" className="glass-input" value={formData.counseling_support?.motivational_support || ''} onChange={(e) => updateSupport('motivational_support', e.target.value)} />
            </div>
            <div className="input-group-modern">
              <label>Peer study group / mentorship</label>
              <input type="text" className="glass-input" value={formData.counseling_support?.peer_study || ''} onChange={(e) => updateSupport('peer_study', e.target.value)} />
            </div>
            <div className="input-group-modern">
              <label>Parent communication</label>
              <input type="text" className="glass-input" value={formData.counseling_support?.parent_communication || ''} onChange={(e) => updateSupport('parent_communication', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 5. Next Week Plan */}
        <div className="form-section-modern">
          <h3><FiCalendar /> 5. Plan & Targets for Next Week</h3>
          <div className="plans-table">
            <div className="table-header-row plans">
              <span>Goal</span>
              <span>Steps to Achieve</span>
              <span>Responsible</span>
              <span></span>
            </div>
            {(formData.next_week_plan || []).map((plan, i) => (
              <div key={i} className="plan-row glass-morphism">
                <input placeholder="Goal" className="glass-input-sm" value={plan.goal} onChange={(e) => updateArray('next_week_plan', i, 'goal', e.target.value)} />
                <input placeholder="Steps" className="glass-input-sm" value={plan.steps} onChange={(e) => updateArray('next_week_plan', i, 'steps', e.target.value)} />
                <input placeholder="Responsible" className="glass-input-sm" value={plan.responsible} onChange={(e) => updateArray('next_week_plan', i, 'responsible', e.target.value)} />
                <button className="btn-trash" onClick={() => setFormData({ ...formData, next_week_plan: formData.next_week_plan.filter((_, idx) => idx !== i) })}><FiTrash2 /></button>
              </div>
            ))}
            <button className="btn-add" onClick={() => setFormData({ ...formData, next_week_plan: [...(formData.next_week_plan || []), { goal: '', steps: '', responsible: '' }] })}><FiPlus /> Add Target</button>
          </div>
        </div>

        {/* 6. Counselor's Remarks */}
        <div className="form-section-modern">
          <h3><FiFileText /> 6. Counselor's Remarks</h3>
          <textarea 
            className="glass-textarea" 
            rows="4" 
            placeholder="Document your observations and recommendations here..."
            value={formData.counsellor_remarks || ''}
            onChange={(e) => setFormData({ ...formData, counsellor_remarks: e.target.value })}
          />
        </div>

        {/* 7. Student's Commitment */}
        <div className="form-section-modern">
          <h3><FiCheckCircle /> 7. Student's Commitment</h3>
          <label className="checkbox-label commitment">
            <input type="checkbox" checked={formData.student_commitment} onChange={(e) => setFormData({...formData, student_commitment: e.target.checked})} />
            "I will follow the agreed plan and take responsibility for my learning."
          </label>
          <div className="form-grid-2" style={{marginTop: '1rem'}}>
            <div className="input-group-modern">
              <label>Student Signature (Type Name)</label>
              <input type="text" className="glass-input" value={formData.student_signature || ''} onChange={(e) => setFormData({...formData, student_signature: e.target.value})} />
            </div>
            <div className="input-group-modern">
              <label>Date</label>
              <input type="date" className="glass-input" value={formData.student_signature_date} onChange={(e) => setFormData({...formData, student_signature_date: e.target.value})} />
            </div>
          </div>
        </div>

        {/* 8. Counselor's Signature */}
        <div className="form-section-modern">
          <h3><FiCheckCircle /> 8. Counselor's Signature</h3>
          <div className="form-grid-2">
            <div className="input-group-modern">
              <label>Counsellor Name & Signature</label>
              <input type="text" className="glass-input" value={formData.counsellor_signature || ''} onChange={(e) => setFormData({...formData, counsellor_signature: e.target.value})} />
            </div>
            <div className="input-group-modern">
              <label>Date</label>
              <input type="date" className="glass-input" value={formData.counsellor_signature_date} onChange={(e) => setFormData({...formData, counsellor_signature_date: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="form-actions-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Discard Changes</button>
          <button className="btn btn-primary" onClick={() => onSave(formData)}>Finalize & Save Report</button>
        </div>
      </div>
    </motion.div>
  );
};


export default ProgressReports;