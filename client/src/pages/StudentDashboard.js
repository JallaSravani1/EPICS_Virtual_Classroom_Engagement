// src/pages/StudentDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';
import { LogOut, Video, Users, BarChart3, Loader } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

function StudentDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAvailableSessions();
  }, []);

  const fetchAvailableSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sessions/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(response.data);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/sessions/join/${sessionId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate(`/student-live/${sessionId}`);
    } catch (err) {
      setError('Failed to join session');
    }
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
            <h1>Student Dashboard</h1>
          </div>
          <div className="header-right">
            <span className="user-name">{user.name}</span>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-main">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-info">
            <h2>Welcome, {user.name}!</h2>
            <p>Join live sessions and track your learning progress</p>
          </div>
          <BarChart3 style={{ width: '80px', height: '80px', opacity: 0.15 }} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Available Sessions */}
        <div>
          <div className="section-header">
            <Video style={{ width: '28px', height: '28px' }} />
            <h3>Available Sessions</h3>
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state">
              <Video style={{ width: '80px', height: '80px', color: '#cbd5e0' }} />
              <p>No live sessions available at the moment</p>
            </div>
          ) : (
            <div className="sessions-grid">
              {sessions.map((session) => (
                <div key={session._id} className="session-card">
                  <div className="session-header">
                    <div className="session-title">
                      <h4>{session.title}</h4>
                      <p>by {session.teacherName}</p>
                    </div>
                    <span className="session-badge live">LIVE</span>
                  </div>

                  <div className="session-info">
                    <div className="session-info-item">
                      <span style={{ fontWeight: 600, marginRight: '8px' }}>Started:</span>
                      {new Date(session.startTime).toLocaleTimeString()}
                    </div>
                    <div className="session-info-item">
                      <Users size={18} style={{ color: '#667eea' }} />
                      {session.students.length} students joined
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinSession(session.sessionId)}
                    className="session-button"
                  >
                    Join Session
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;