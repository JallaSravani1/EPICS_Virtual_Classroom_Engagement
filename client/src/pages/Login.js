// src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, Video, Mail, Lock } from 'lucide-react';
import './Login.css';

const API_URL = 'http://localhost:5000/api';

function Login({ onLogin }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: formData.email,
        password: formData.password
      });

      onLogin(response.data.token, response.data.user);
      navigate(response.data.user.role === 'student' ? '/student-dashboard' : '/teacher-dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        {/* Left Side - Branding */}
        <div className="login-branding">
          <div className="branding-content">
            <div className="branding-icon">
              <Video size={60} />
            </div>
            <h1 className="branding-title">EduEngage</h1>
            <p className="branding-subtitle">Smart Learning Platform with AI-Powered Engagement Detection</p>
            <div className="branding-features">
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>Real-time Engagement Tracking</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>Live Video Sessions</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>AI-Powered Analytics</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="login-form-section">
          <div className="login-form-wrapper">
            <h2 className="form-title">Welcome Back</h2>
            <p className="form-subtitle">Sign in to continue learning</p>

            {/* Role Selection */}
            <div className="role-tabs">
              <button
                type="button"
                className={`role-tab ${formData.role === 'student' ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'student' })}
              >
                👨‍🎓 Student
              </button>
              <button
                type="button"
                className={`role-tab ${formData.role === 'teacher' ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'teacher' })}
              >
                👨‍🏫 Teacher
              </button>
            </div>

            {error && (
              <div className="error-box">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              {/* Email Field */}
              <div className="form-field">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail size={20} className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="form-field">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock size={20} className="input-icon" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="submit-button"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Footer */}
            <div className="form-footer">
              <p>Don't have an account? <Link to="/register">Create one</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;