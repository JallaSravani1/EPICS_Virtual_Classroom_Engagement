// src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentLive from './pages/StudentLive';
import TeacherLive from './pages/TeacherLive';
import SessionReport from './pages/SessionReport';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900"><p className="text-white">Loading...</p></div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/student-dashboard" element={isAuthenticated && user?.role === 'student' ? <StudentDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/teacher-dashboard" element={isAuthenticated && user?.role === 'teacher' ? <TeacherDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/student-live/:sessionId" element={isAuthenticated && user?.role === 'student' ? <StudentLive user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/teacher-live/:sessionId" element={isAuthenticated && user?.role === 'teacher' ? <TeacherLive user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/report/:sessionId" element={isAuthenticated && user?.role === 'teacher' ? <SessionReport user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to={isAuthenticated ? (user?.role === 'student' ? '/student-dashboard' : '/teacher-dashboard') : '/login'} />} />
      </Routes>
    </Router>
  );
}

export default App;