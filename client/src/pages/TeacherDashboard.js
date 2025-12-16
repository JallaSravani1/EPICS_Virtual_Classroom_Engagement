// src/pages/TeacherDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';
import { LogOut, Video, Users, BarChart3, Plus, Loader, RefreshCw } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

function TeacherDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTeacherSessions();
    const interval = setInterval(fetchTeacherSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTeacherSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sessions/teacher`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(response.data);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await fetchTeacherSessions();
    } catch (err) {
      setError('Failed to refresh sessions');
    } finally {
      setTimeout(() => setRefreshing(false), 500); // Add slight delay for visual feedback
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionTitle.trim()) {
      setError('Please enter a session title');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/sessions/create`,
        { title: sessionTitle, teacherName: user.name },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSessions([...sessions, response.data]);
      setSessionTitle('');
      setShowCreateForm(false);
      navigate(`/teacher-live/${response.data.sessionId}`);
    } catch (err) {
      setError('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleViewSession = (sessionId) => {
    navigate(`/teacher-live/${sessionId}`);
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader style={{ width: '32px', height: '32px', color: '#667eea', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7fafc' }}>
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <Video style={{ width: '32px', height: '32px' }} />
            <h1>Teacher Dashboard</h1>
          </div>
          <div className="header-right">
            <span className="user-name">{user.name}</span>
            <button 
              className="logout-btn" 
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                backgroundColor: '#f0f4ff',
                color: '#667eea',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: 'none',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
                fontWeight: '600',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => {
                if (!refreshing) e.target.style.backgroundColor = '#e0e7ff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#f0f4ff';
              }}
            >
              <RefreshCw 
                size={20} 
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-main">
        {/* Create Session Button */}
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="create-session-btn"
          >
            <Plus size={24} />
            <span>Start New Session</span>
          </button>
        ) : (
          <form onSubmit={handleCreateSession} className="create-session-form">
            <h3 className="form-title">Create New Session</h3>
            <div className="form-row">
              <input
                type="text"
                placeholder="Enter session title (e.g., React Fundamentals)"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
              />
              <button
                type="submit"
                disabled={creating}
                className="submit-btn"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setSessionTitle(''); }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Sessions Grid */}
        <div>
          <div className="section-header">
            <Video style={{ width: '28px', height: '28px' }} />
            <h3>Your Sessions</h3>
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state">
              <Video style={{ width: '80px', height: '80px', color: '#cbd5e0' }} />
              <p>No sessions created yet. Start your first session!</p>
            </div>
          ) : (
            <div className="sessions-grid">
              {sessions.map((session) => (
                <div key={session._id} className="session-card">
                  <div className="session-header">
                    <div className="session-title">
                      <h4>{session.title}</h4>
                      <p>Started at {new Date(session.startTime).toLocaleTimeString()}</p>
                    </div>
                    <span className={`session-badge ${session.status === 'live' ? 'live' : 'completed'}`}>
                      {session.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="session-info">
                    <div className="session-info-item">
                      <Users size={18} style={{ color: '#667eea' }} />
                      <span>{session.students.length} students</span>
                    </div>
                    <div className="session-info-item">
                      <BarChart3 size={18} style={{ color: '#667eea' }} />
                      <span>Avg Engagement: <strong>{session.avgEngagement ? Math.round(session.avgEngagement) : 'N/A'}%</strong></span>
                    </div>
                    {session.avgEngagement && (
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width: `${session.avgEngagement}%`}}></div>
                      </div>
                    )}
                  </div>

                  {session.status === 'live' && (
                    <button
                      onClick={() => handleViewSession(session.sessionId)}
                      className="session-button"
                    >
                      View Live Session
                    </button>
                  )}
                  {session.status === 'completed' && (
                    <button
                      onClick={() => navigate(`/report/${session.sessionId}`)}
                      className="session-button"
                    >
                      View Report
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add keyframes for spin animation */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default TeacherDashboard;