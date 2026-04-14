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
    const weekStart = new Date(selectedWeek).toISOString().split('T')[0];
    try {
      const existing = await api.get(`/appointments/progress-reports/${selectedStudent}/${weekStart}`);
      if (existing.data.report) {
        setCurrentReport(existing.data.report);
      } else {
        const student = students.find(s => s.user_id === selectedStudent);
        setCurrentReport({
          student_id: selectedStudent,
          week_start: weekStart,
          student_name: student?.name || 'Student',
          counsellor_name: user.name || 'Counsellor',
          academic_performance: [],
          previous_goals_review: [],
          issues_challenges: [],
          counseling_support: {},
          next_week_plan: []
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
                          <button className="btn-icon primary" onClick={() => {/* Download PDF */}}><FiDownload /></button>
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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="report-form-container glass-card">
      <div className="form-header-modern">
        <button className="btn-back" onClick={onCancel}><FiChevronLeft /> Back to List</button>
        <h1>Weekly Counseling Report</h1>
      </div>

      <div className="report-form-sections">
        <div className="form-section-modern">
          <h3><FiUser /> Core Information</h3>
          <div className="form-grid-2">
            <div className="input-group-modern">
              <label>Student Name</label>
              <input type="text" className="glass-input" value={formData.student_name} readOnly />
            </div>
            <div className="input-group-modern">
              <label>Reporting Week</label>
              <input type="text" className="glass-input" value={formData.week_start} readOnly />
            </div>
          </div>
        </div>

        <div className="form-section-modern">
          <h3><FiBarChart2 /> Academic Performance</h3>
          <div className="performance-table">
            {(formData.academic_performance || []).map((sub, i) => (
              <div key={i} className="perf-row glass-morphism">
                <input placeholder="Subject" className="glass-input-sm" value={sub.subject} onChange={(e) => updateArray('academic_performance', i, 'subject', e.target.value)} />
                <input placeholder="Score %" className="glass-input-sm" value={sub.score} onChange={(e) => updateArray('academic_performance', i, 'score', e.target.value)} />
                <button className="btn-trash" onClick={() => setFormData({ ...formData, academic_performance: formData.academic_performance.filter((_, idx) => idx !== i) })}><FiTrash2 /></button>
              </div>
            ))}
            <button className="btn-add" onClick={() => setFormData({ ...formData, academic_performance: [...(formData.academic_performance || []), { subject: '', score: '' }] })}><FiPlus /> Add Subject</button>
          </div>
        </div>

        <div className="form-section-modern">
          <h3><FiCheckCircle /> Counselor Remarks</h3>
          <textarea 
            className="glass-textarea" 
            rows="6" 
            placeholder="Document your observations and recommendations here..."
            value={formData.counsellor_remarks || ''}
            onChange={(e) => setFormData({ ...formData, counsellor_remarks: e.target.value })}
          />
        </div>

        <div className="form-actions-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Discard Changes</button>
          <button className="btn btn-primary" onClick={() => onSave(formData)}>Finalize & Save</button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProgressReports;