// src/utils/engagementClassifier.js
// Classification system for engagement levels

export const ENGAGEMENT_CLASSES = {
  HIGHLY_ENGAGED: 'Highly Engaged',
  ENGAGED: 'Engaged',
  NEUTRAL: 'Neutral',
  DISENGAGED: 'Disengaged',
  HIGHLY_DISENGAGED: 'Highly Disengaged'
};

export const ENGAGEMENT_THRESHOLDS = {
  HIGHLY_ENGAGED: { min: 80, max: 100, color: '#10b981', bgColor: '#d1fae5' },
  ENGAGED: { min: 60, max: 79, color: '#3b82f6', bgColor: '#dbeafe' },
  NEUTRAL: { min: 40, max: 59, color: '#f59e0b', bgColor: '#fef3c7' },
  DISENGAGED: { min: 20, max: 39, color: '#ef4444', bgColor: '#fee2e2' },
  HIGHLY_DISENGAGED: { min: 0, max: 19, color: '#7c2d12', bgColor: '#fed7aa' }
};

/**
 * Classify engagement score into categories
 * @param {number} score - Engagement score (0-100)
 * @returns {object} - { class, label, color, bgColor, percentage }
 */
export const classifyEngagement = (score) => {
  const engagement = Math.min(Math.max(score, 0), 100);

  if (engagement >= 80) {
    return {
      class: ENGAGEMENT_CLASSES.HIGHLY_ENGAGED,
      level: 5,
      score: engagement,
      ...ENGAGEMENT_THRESHOLDS.HIGHLY_ENGAGED,
      icon: '😊',
      description: 'Student is very actively participating'
    };
  } else if (engagement >= 60) {
    return {
      class: ENGAGEMENT_CLASSES.ENGAGED,
      level: 4,
      score: engagement,
      ...ENGAGEMENT_THRESHOLDS.ENGAGED,
      icon: '🙂',
      description: 'Student is actively participating'
    };
  } else if (engagement >= 40) {
    return {
      class: ENGAGEMENT_CLASSES.NEUTRAL,
      level: 3,
      score: engagement,
      ...ENGAGEMENT_THRESHOLDS.NEUTRAL,
      icon: '😐',
      description: 'Student engagement is moderate'
    };
  } else if (engagement >= 20) {
    return {
      class: ENGAGEMENT_CLASSES.DISENGAGED,
      level: 2,
      score: engagement,
      ...ENGAGEMENT_THRESHOLDS.DISENGAGED,
      icon: '😔',
      description: 'Student seems disengaged'
    };
  } else {
    return {
      class: ENGAGEMENT_CLASSES.HIGHLY_DISENGAGED,
      level: 1,
      score: engagement,
      ...ENGAGEMENT_THRESHOLDS.HIGHLY_DISENGAGED,
      icon: '😞',
      description: 'Student is not engaged at all'
    };
  }
};

/**
 * Get engagement class from score
 * @param {number} score - Engagement score (0-100)
 * @returns {string} - Class label
 */
export const getEngagementClass = (score) => {
  return classifyEngagement(score).class;
};

/**
 * Get engagement color from score
 * @param {number} score - Engagement score (0-100)
 * @returns {string} - Hex color code
 */
export const getEngagementColor = (score) => {
  return classifyEngagement(score).color;
};

/**
 * Get average class from multiple scores
 * @param {array} scores - Array of engagement scores
 * @returns {object} - Average classification
 */
export const getAverageEngagementClass = (scores) => {
  if (scores.length === 0) return classifyEngagement(0);
  const avg = scores.reduce((a, b) => a + b) / scores.length;
  return classifyEngagement(avg);
};

/**
 * Classify multiple students
 * @param {object} studentEngagements - { studentId: { score } }
 * @returns {object} - { studentId: { classification } }
 */
export const classifyMultipleStudents = (studentEngagements) => {
  const classifications = {};
  
  Object.entries(studentEngagements).forEach(([studentId, data]) => {
    classifications[studentId] = classifyEngagement(data.score || 0);
  });
  
  return classifications;
};

/**
 * Get engagement statistics
 * @param {object} studentEngagements - { studentId: { score } }
 * @returns {object} - Statistics with class distribution
 */
export const getEngagementStatistics = (studentEngagements) => {
  const scores = Object.values(studentEngagements).map(d => d.score || 0);
  
  if (scores.length === 0) {
    return {
      averageScore: 0,
      averageClass: ENGAGEMENT_CLASSES.HIGHLY_DISENGAGED,
      totalStudents: 0,
      distribution: {
        highlyEngaged: 0,
        engaged: 0,
        neutral: 0,
        disengaged: 0,
        highlyDisengaged: 0
      }
    };
  }

  const avgScore = scores.reduce((a, b) => a + b) / scores.length;
  const avgClass = classifyEngagement(avgScore);

  const distribution = {
    highlyEngaged: scores.filter(s => s >= 80).length,
    engaged: scores.filter(s => s >= 60 && s < 80).length,
    neutral: scores.filter(s => s >= 40 && s < 60).length,
    disengaged: scores.filter(s => s >= 20 && s < 40).length,
    highlyDisengaged: scores.filter(s => s < 20).length
  };

  return {
    averageScore: Math.round(avgScore),
    averageClass: avgClass.class,
    totalStudents: scores.length,
    distribution,
    health: getSessionHealth(avgScore)
  };
};

/**
 * Determine session health
 * @param {number} avgScore - Average engagement score
 * @returns {object} - Health status
 */
export const getSessionHealth = (avgScore) => {
  if (avgScore >= 75) {
    return { status: 'Excellent', emoji: '🌟', message: 'Class is highly engaged' };
  } else if (avgScore >= 60) {
    return { status: 'Good', emoji: '✅', message: 'Most students are engaged' };
  } else if (avgScore >= 40) {
    return { status: 'Fair', emoji: '⚠️', message: 'Moderate engagement level' };
  } else {
    return { status: 'Poor', emoji: '❌', message: 'Low overall engagement' };
  }
};