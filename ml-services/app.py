from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import mediapipe as mp
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Load YOLOv8n model for face detection
yolo_model = YOLO('yolov8n.pt')

# MediaPipe Face Mesh for engagement detection
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=5,
    min_detection_confidence=0.5
)

def detect_faces_yolo(image_cv):
    """YOLOv8n Face Detection"""
    results = yolo_model(image_cv)
    faces = []
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            confidence = float(box.conf[0])
            faces.append({
                'bbox': [x1, y1, x2, y2],
                'confidence': confidence
            })
    
    return faces

def calculate_engagement_mediapipe(image_cv, face_bbox):
    """Calculate engagement using MediaPipe Face Mesh"""
    x1, y1, x2, y2 = face_bbox
    
    # Ensure bbox is within image bounds
    h, w = image_cv.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    
    if x2 <= x1 or y2 <= y1:
        return None
        
    face_roi = image_cv[y1:y2, x1:x2]
    
    # Flip for selfie
    face_roi = cv2.flip(face_roi, 1)
    
    results = face_mesh.process(cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB))
    
    if results.multi_face_landmarks:
        landmarks = results.multi_face_landmarks[0]
        
        # Eye aspect ratio calculation
        def eye_aspect_ratio(landmarks, p1, p2, p3, p4, p5, p6):
            pts = np.array([[landmarks.landmark[i].x, landmarks.landmark[i].y] for i in [p1, p2, p3, p4, p5, p6]])
            dist_vert1 = np.linalg.norm(pts[1] - pts[5])
            dist_vert2 = np.linalg.norm(pts[2] - pts[4])
            dist_horiz = np.linalg.norm(pts[0] - pts[3])
            ear = (dist_vert1 + dist_vert2) / (2 * dist_horiz + 1e-6)
            return ear
        
        # Head pose estimation
        def get_head_pose(landmarks):
            nose = np.array([landmarks.landmark[1].x, landmarks.landmark[1].y])
            chin = np.array([landmarks.landmark[152].x, landmarks.landmark[152].y])
            left_ear = np.array([landmarks.landmark[234].x, landmarks.landmark[234].y])
            right_ear = np.array([landmarks.landmark[454].x, landmarks.landmark[454].y])
            
            yaw = np.arctan2((right_ear[0] - left_ear[0]), (right_ear[1] - left_ear[1]))
            pitch = np.arctan2((chin[1] - nose[1]), (chin[0] - nose[0]))
            
            return np.degrees(yaw), np.degrees(pitch)
        
        # Calculate metrics
        left_eye_ratio = eye_aspect_ratio(landmarks, 33, 160, 158, 133, 153, 144)
        right_eye_ratio = eye_aspect_ratio(landmarks, 362, 385, 387, 362, 381, 374)
        yaw, pitch = get_head_pose(landmarks)
        
        # Eye openness score (0-100)
        # Typical EAR values: 0.2-0.4 (open eyes), <0.2 (closed)
        avg_ear = (left_eye_ratio + right_eye_ratio) / 2
        eye_openness = float(min(max((avg_ear - 0.15) / 0.15 * 100, 0), 100))
        
        # Head pose score (0-100) - penalize extreme angles
        # Good attention: yaw and pitch close to 0
        head_pose_score = float(max(0, 100 - (abs(yaw) * 2 + abs(pitch) * 1.5)))
        
        # Overall engagement score
        # 50% eye openness + 50% head pose
        engagement_score = float(eye_openness * 0.5 + head_pose_score * 0.5)
        
        return {
            'eye_openness': eye_openness,
            'head_pose_score': head_pose_score,
            'engagement_score': engagement_score,
            'yaw': float(yaw),
            'pitch': float(pitch),
            'left_ear': float(left_eye_ratio),
            'right_ear': float(right_eye_ratio)
        }
    
    return None

def liveness_detection(image_cv, face_bbox):
    """Simple liveness detection based on image quality"""
    x1, y1, x2, y2 = face_bbox
    
    # Ensure bbox is within bounds
    h, w = image_cv.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    
    if x2 <= x1 or y2 <= y1:
        return {'is_live': False, 'liveness_score': 0.0}
        
    face_roi = image_cv[y1:y2, x1:x2]
    
    # Liveness detection using Laplacian variance (blur detection)
    gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    
    # Liveness score based on image sharpness
    # Higher variance = sharper image = more likely real person
    liveness_score = float(min(laplacian_var / 50, 100))  # Normalize
    
    return {
        'is_live': bool(liveness_score > 20),
        'liveness_score': liveness_score
    }

@app.route('/api/detect', methods=['POST'])
def detect_engagement():
    """Process frame and detect engagement"""
    try:
        data = request.json
        frame_base64 = data['frame']
        
        # Decode base64 frame
        frame_data = base64.b64decode(frame_base64)
        nparr = np.frombuffer(frame_data, np.uint8)
        image_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image_cv is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Face detection with YOLO
        faces = detect_faces_yolo(image_cv)
        
        results = {
            'faces_detected': len(faces),
            'detections': []
        }
        
        for i, face in enumerate(faces):
            bbox = face['bbox']
            
            # MediaPipe engagement calculation
            engagement_data = calculate_engagement_mediapipe(image_cv, bbox)
            
            # Liveness detection
            liveness_data = liveness_detection(image_cv, bbox)
            
            if engagement_data:
                detection = {
                    'face_id': i,
                    'bbox': bbox,
                    'confidence': float(face['confidence']),
                    'engagement': float(engagement_data['engagement_score']),
                    'eye_openness': float(engagement_data['eye_openness']),
                    'head_pose': float(engagement_data['head_pose_score']),
                    'is_live': bool(liveness_data['is_live']),
                    'liveness_score': float(liveness_data['liveness_score']),
                    'overall_engagement': float(engagement_data['engagement_score']),  # Use MediaPipe score
                    'yaw': float(engagement_data['yaw']),
                    'pitch': float(engagement_data['pitch'])
                }
            else:
                # No landmarks detected
                detection = {
                    'face_id': i,
                    'bbox': bbox,
                    'confidence': float(face['confidence']),
                    'engagement': 0.0,
                    'eye_openness': 0.0,
                    'head_pose': 0.0,
                    'is_live': bool(liveness_data['is_live']),
                    'liveness_score': float(liveness_data['liveness_score']),
                    'overall_engagement': 0.0,
                    'yaw': 0.0,
                    'pitch': 0.0
                }
            
            results['detections'].append(detection)
        
        return jsonify(results)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/batch-process', methods=['POST'])
def batch_process():
    """Process multiple frames and calculate comprehensive metrics with confusion matrix"""
    try:
        data = request.json
        frames = data['frames']
        engagement_threshold = data.get('engagement_threshold', 50)  # Configurable threshold
        liveness_threshold = data.get('liveness_threshold', 20)
        
        all_detections = []
        
        for frame_base64 in frames:
            frame_data = base64.b64decode(frame_base64)
            nparr = np.frombuffer(frame_data, np.uint8)
            image_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image_cv is None:
                continue
            
            faces = detect_faces_yolo(image_cv)
            
            for face in faces:
                bbox = face['bbox']
                engagement_data = calculate_engagement_mediapipe(image_cv, bbox)
                liveness_data = liveness_detection(image_cv, bbox)
                
                if engagement_data:
                    all_detections.append({
                        'engagement': engagement_data['engagement_score'],
                        'eye_openness': engagement_data['eye_openness'],
                        'head_pose': engagement_data['head_pose_score'],
                        'is_live': liveness_data['is_live'],
                        'liveness_score': liveness_data['liveness_score'],
                        'yaw': engagement_data['yaw'],
                        'pitch': engagement_data['pitch']
                    })
        
        # Calculate comprehensive metrics
        if all_detections:
            engagements = [d['engagement'] for d in all_detections]
            liveness_scores = [d['liveness_score'] for d in all_detections]
            eye_openness = [d['eye_openness'] for d in all_detections]
            head_poses = [d['head_pose'] for d in all_detections]
            
            # Confusion Matrix Components
            # Predicted Positive: engagement > threshold AND is_live
            # Predicted Negative: engagement <= threshold OR not is_live
            # Actual Positive: is_live (assuming live faces should be engaged)
            # Actual Negative: not is_live
            
            tp = sum(1 for d in all_detections if d['engagement'] > engagement_threshold and d['is_live'])
            fp = sum(1 for d in all_detections if d['engagement'] > engagement_threshold and not d['is_live'])
            fn = sum(1 for d in all_detections if d['engagement'] <= engagement_threshold and d['is_live'])
            tn = sum(1 for d in all_detections if d['engagement'] <= engagement_threshold and not d['is_live'])
            
            total = tp + fp + fn + tn
            
            # Calculate metrics
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            accuracy = (tp + tn) / total if total > 0 else 0
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
            
            # Additional metrics
            false_positive_rate = fp / (fp + tn) if (fp + tn) > 0 else 0
            false_negative_rate = fn / (fn + tp) if (fn + tp) > 0 else 0
            
            # Matthews Correlation Coefficient
            mcc_denominator = np.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
            mcc = ((tp * tn) - (fp * fn)) / mcc_denominator if mcc_denominator > 0 else 0
            
            metrics = {
                'confusion_matrix': {
                    'true_positive': int(tp),
                    'false_positive': int(fp),
                    'true_negative': int(tn),
                    'false_negative': int(fn),
                    'total': int(total)
                },
                'classification_metrics': {
                    'accuracy': round(accuracy, 4),
                    'precision': round(precision, 4),
                    'recall': round(recall, 4),
                    'f1_score': round(f1_score, 4),
                    'specificity': round(specificity, 4),
                    'false_positive_rate': round(false_positive_rate, 4),
                    'false_negative_rate': round(false_negative_rate, 4),
                    'mcc': round(mcc, 4)
                },
                'engagement_stats': {
                    'avg_engagement': round(np.mean(engagements), 2),
                    'std_engagement': round(np.std(engagements), 2),
                    'min_engagement': round(np.min(engagements), 2),
                    'max_engagement': round(np.max(engagements), 2),
                    'median_engagement': round(np.median(engagements), 2),
                    'percentile_25': round(np.percentile(engagements, 25), 2),
                    'percentile_75': round(np.percentile(engagements, 75), 2)
                },
                'liveness_stats': {
                    'avg_liveness': round(np.mean(liveness_scores), 2),
                    'std_liveness': round(np.std(liveness_scores), 2),
                    'min_liveness': round(np.min(liveness_scores), 2),
                    'max_liveness': round(np.max(liveness_scores), 2),
                    'live_faces_count': sum(1 for d in all_detections if d['is_live']),
                    'non_live_faces_count': sum(1 for d in all_detections if not d['is_live'])
                },
                'additional_metrics': {
                    'avg_eye_openness': round(np.mean(eye_openness), 2),
                    'avg_head_pose': round(np.mean(head_poses), 2),
                    'avg_yaw': round(np.mean([abs(d['yaw']) for d in all_detections]), 2),
                    'avg_pitch': round(np.mean([abs(d['pitch']) for d in all_detections]), 2)
                },
                'thresholds_used': {
                    'engagement_threshold': engagement_threshold,
                    'liveness_threshold': liveness_threshold
                },
                'total_frames_processed': len(all_detections)
            }
        else:
            metrics = {
                'confusion_matrix': {
                    'true_positive': 0,
                    'false_positive': 0,
                    'true_negative': 0,
                    'false_negative': 0,
                    'total': 0
                },
                'classification_metrics': {
                    'accuracy': 0,
                    'precision': 0,
                    'recall': 0,
                    'f1_score': 0,
                    'specificity': 0,
                    'false_positive_rate': 0,
                    'false_negative_rate': 0,
                    'mcc': 0
                },
                'engagement_stats': {},
                'liveness_stats': {},
                'additional_metrics': {},
                'thresholds_used': {
                    'engagement_threshold': engagement_threshold,
                    'liveness_threshold': liveness_threshold
                },
                'total_frames_processed': 0
            }
        
        return jsonify(metrics)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ML Services Running'})

if __name__ == '__main__':
    app.run(debug=True, port=5001)