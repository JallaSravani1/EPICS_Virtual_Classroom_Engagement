const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

mongoose.connect(
  process.env.MONGO_URI || 
  'mongodb+srv://jallasravani87_db_user:virtualclassroom%4013@cluster0.4qelafg.mongodb.net/virtual_learning?retryWrites=true&w=majority',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)

.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['student', 'teacher'] },
  createdAt: { type: Date, default: Date.now }
});

// Session Schema
const sessionSchema = new mongoose.Schema({
  sessionId: String,
  teacherId: mongoose.Schema.Types.ObjectId,
  teacherName: String,
  title: String,
  status: { type: String, enum: ['live', 'completed'], default: 'live' },
  students: [mongoose.Schema.Types.ObjectId],
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  engagementData: [{
    studentId: mongoose.Schema.Types.ObjectId,
    timestamp: Date,
    engagement: Number,
    faceDetected: Boolean,
    livenessScore: Number,
    engagementClass: String  // ADD THIS LINE
  }],
  avgEngagement: Number,
  metrics: {
    precision: Number,
    recall: Number,
    f1Score: Number
  }
});

// Engagement Schema
const engagementSchema = new mongoose.Schema({
  sessionId: String,
  studentId: mongoose.Schema.Types.ObjectId,
  timestamp: { type: Date, default: Date.now },
  engagementScore: Number,
  faceDetected: Boolean,
  livenessScore: Number,
  overallScore: Number,
  engagementClass: String  // ADD THIS LINE - stores the classification like "Engaged", "Disengaged", etc.
});

const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);
const Engagement = mongoose.model('Engagement', engagementSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth Middleware
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name, email, role } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(400).json({ error: 'User not found' });
    
    const isValid = await bcryptjs.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create Session (Teacher)
app.post('/api/sessions/create', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const sessionId = `session-${Date.now()}`;
    
    const session = new Session({
      sessionId,
      teacherId: req.userId,
      teacherName: req.body.teacherName,
      title,
      status: 'live'
    });
    
    await session.save();
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Available Sessions (Student)
app.get('/api/sessions/available', auth, async (req, res) => {
  try {
    const sessions = await Session.find({ status: 'live' }).populate('teacherId', 'name');
    res.json(sessions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Teacher Sessions
app.get('/api/sessions/teacher', auth, async (req, res) => {
  try {
    const sessions = await Session.find({ teacherId: req.userId });
    res.json(sessions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Join Session
app.post('/api/sessions/join/:sessionId', auth, async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    if (!session.students.includes(req.userId)) {
      session.students.push(req.userId);
      await session.save();
    }
    
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Save Engagement Data
app.post('/api/engagement/save', auth, async (req, res) => {
  try {
    const { sessionId, engagementScore, faceDetected, livenessScore, overallScore, engagementClass } = req.body;
    
    const engagement = new Engagement({
      sessionId,
      studentId: req.userId,
      engagementScore,
      faceDetected,
      livenessScore,
      overallScore,
      engagementClass  // Make sure this is saved
    });
    
    await engagement.save();
    res.json(engagement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Session Report
app.get('/api/sessions/report/:sessionId', auth, async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    const engagements = await Engagement.find({ sessionId: req.params.sessionId });
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    const avgEngagement = engagements.reduce((sum, e) => sum + e.overallScore, 0) / engagements.length || 0;
    
    res.json({
      session,
      engagementData: engagements,
      avgEngagement: avgEngagement.toFixed(2)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// End Session
app.post('/api/sessions/end/:sessionId', auth, async (req, res) => {
  try {
    const { metrics } = req.body;
    const session = await Session.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { status: 'completed', endTime: new Date(), metrics },
      { new: true }
    );
    
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Socket.io for Real-time Updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    io.to(sessionId).emit('user-joined', { socketId: socket.id });
  });
  
  socket.on('engagement-update', (data) => {
    io.to(data.sessionId).emit('engagement-received', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});