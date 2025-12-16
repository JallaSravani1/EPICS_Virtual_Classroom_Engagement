// src/pages/StudentLive.js - WITH FIXED ENGAGEMENT DISPLAY
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff, Phone, BarChart3, RotateCcw } from 'lucide-react';
import axios from 'axios';
import './LiveSession.css';
import io from 'socket.io-client';
import { classifyEngagement } from '../utils/engagementClassifier';

const API_URL = 'http://localhost:5000/api';
const ML_SERVICE_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5000';

function StudentLive({ user }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [engagement, setEngagement] = useState(0);
  const [engagementClass, setEngagementClass] = useState(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    initializeCamera();
    connectSocket();
    fetchSessionInfo();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (isCameraOn) {
      const interval = setInterval(captureAndProcessFrame, 1000);
      return () => clearInterval(interval);
    }
  }, [isCameraOn]);

  // Update engagement class whenever engagement changes
  useEffect(() => {
    const classification = classifyEngagement(engagement);
    setEngagementClass(classification);
  }, [engagement]);

  const fetchSessionInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sessions/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const session = response.data.find(s => s.sessionId === sessionId);
      if (session) {
        setSessionInfo(session);
      }
    } catch (err) {
      console.error('Failed to fetch session info:', err);
    }
  };

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  };

  const captureAndProcessFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    ctx.drawImage(videoRef.current, 0, 0);
    const frameBase64 = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      const response = await axios.post(`${ML_SERVICE_URL}/detect`, {
        frame: frameBase64
      });

      console.log('ML Response:', response.data);

      if (response.data.detections && response.data.detections.length > 0) {
        const detection = response.data.detections[0];
        
        // Use overall_engagement from the ML model
        const engagementScore = Math.round(detection.overall_engagement || detection.engagement || 0);
        setEngagement(engagementScore);

        // Get classification
        const classification = classifyEngagement(engagementScore);

        // Save to backend
        const token = localStorage.getItem('token');
        await axios.post(
          `${API_URL}/engagement/save`,
          {
            sessionId,
            engagementScore: engagementScore,
            faceDetected: response.data.faces_detected > 0,
            livenessScore: Math.round(detection.liveness_score || 0),
            overallScore: engagementScore,
            engagementClass: classification.class
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Emit to teacher in real-time with classification
        if (socketRef.current) {
          socketRef.current.emit('engagement-update', {
            sessionId,
            studentId: user.id,
            studentName: user.name,
            engagement: engagementScore,
            engagementClass: classification.class,
            faceDetected: response.data.faces_detected > 0,
            timestamp: new Date()
          });
        }
      } else {
        console.log('No faces detected');
      }
    } catch (err) {
      console.error('ML Processing error:', err);
    }
  };

  const connectSocket = () => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('join-session', sessionId);
    socketRef.current.on('connect', () => {
      console.log('Connected to socket');
    });
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOn(!isCameraOn);
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(!isMicOn);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh session info
      await fetchSessionInfo();
      // Reset engagement to trigger re-detection
      setEngagement(0);
      setEngagementClass(null);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLeaveSession = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    navigate('/student-dashboard');
  };

  return (
    <div className="live-page">
      <div className="live-container">
        <div className="live-grid">
          {/* Main Content */}
          <div className="main-content">
            {/* Teacher Stream */}
            <div className="video-stream">
              <div className="video-placeholder">
                <Video style={{ width: '100px', height: '100px' }} />
                <p>Teacher Stream (Waiting for teacher...)</p>
              </div>
              <div className="video-live-indicator">
                <div className="live-dot"></div>
                <span>LIVE</span>
              </div>
            </div>

            {/* Session Info */}
            <div className="session-controls">
              <div className="control-info">
                <h2>{sessionInfo?.title || 'Live Session'}</h2>
                <p>Session ID: {sessionId}</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar">
            {/* Your Camera */}
            <div className="sidebar-card">
              <div className="teacher-video">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                {!isCameraOn && (
                  <div style={{ position: 'absolute', inset: 0, background: '#1a202c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VideoOff style={{ width: '60px', height: '60px', color: '#4a5568' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="sidebar-card">
              <div className="media-controls">
                <button
                  onClick={toggleCamera}
                  className={`media-btn ${isCameraOn ? 'on' : 'off'}`}
                  title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                >
                  {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
                <button
                  onClick={toggleMic}
                  className={`media-btn ${isMicOn ? 'on' : 'off'}`}
                  title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="media-btn on"
                  title="Refresh engagement detection"
                  style={{
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                  }}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <button
                onClick={handleLeaveSession}
                style={{
                  width: '100%',
                  background: '#e53e3e',
                  color: 'white',
                  fontWeight: '600',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
              >
                <Phone size={16} />
                <span>Leave Session</span>
              </button>
            </div>

            {/* Engagement Stats with Classification */}
            <div className="sidebar-card" style={{ backgroundColor: engagementClass?.bgColor || '#f7fafc' }}>
              <div className="sidebar-title">Your Engagement</div>
              
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '40px', marginBottom: '4px' }}>
                  {engagementClass?.icon || '😶'}
                </div>
              </div>

              <div className="progress-container">
                <div className="progress-label">Status</div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: engagementClass?.color || '#667eea',
                  textAlign: 'center'
                }}>
                  {engagementClass?.class || 'Initializing...'}
                </div>
              </div>

              <div className="progress-container" style={{ marginTop: '12px' }}>
                <div className="progress-label">Score</div>
                <div className="progress-value" style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: engagementClass?.color || '#667eea'
                }}>
                  {engagement}%
                </div>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${engagement}%`,
                  background: engagementClass?.color || '#667eea'
                }}></div>
              </div>

              <p style={{ 
                fontSize: '12px', 
                color: '#4b5563', 
                marginTop: '8px', 
                textAlign: 'center',
                fontWeight: '500'
              }}>
                {engagementClass?.description || (isCameraOn ? 'Analyzing your engagement...' : 'Camera is off')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentLive;