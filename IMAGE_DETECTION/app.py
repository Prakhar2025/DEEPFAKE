from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
from tensorflow.keras.models import load_model
import base64
import os
import uuid
import json
from datetime import datetime
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    handlers=[logging.FileHandler("app.log"), logging.StreamHandler()])
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'}

# Debug: Print current working directory
logger.info(f"Current working directory: {os.getcwd()}")

# Load the pre-trained Xception model
MODEL_PATH = os.path.join('model', 'new_xception.h5')  # Adjust to your model's name
logger.info(f"Attempting to load model from: {MODEL_PATH}")

# Create model directory if it doesn't exist
os.makedirs('model', exist_ok=True)

# Global variable to store the model
model = None

def load_model_if_exists():
    global model
    if os.path.exists(MODEL_PATH):
        try:
            model = load_model(MODEL_PATH)
            logger.info("Model loaded successfully!")
            logger.info("Model summary:")
            model.summary()
            return True
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            try:
                # Fallback: Load with compile=False
                model = load_model(MODEL_PATH, compile=False)
                logger.info("Model loaded with compile=False fallback.")
                logger.info("Model summary:")
                model.summary()
                return True
            except Exception as e:
                logger.error(f"Failed to load model even with fallback: {e}")
                return False
    else:
        logger.warning(f"Model file not found at {MODEL_PATH}. Please place 'deepfake_xception.h5' in the 'model' folder.")
        return False

# Try to load the model at startup
model_loaded = load_model_if_exists()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def preprocess_image(image):
    try:
        # Resize to 299x299 (Xception input size)
        image = cv2.resize(image, (299, 299))
        # Convert to RGB if needed (Xception expects RGB)
        if len(image.shape) == 2:  # Grayscale
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:  # RGBA
            image = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
        else:  # BGR from cv2.imread
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        # Normalize to [0, 1] as per training
        image = image / 255.0
        # Expand dimensions for model input
        image = np.expand_dims(image, axis=0)
        logger.info(f"Preprocessed image shape: {image.shape}")
        return image
    except Exception as e:
        logger.error(f"Error preprocessing image: {e}")
        return None

def predict_image(image):
    global model, model_loaded
    
    # If model is not loaded, try to load it again
    if not model_loaded:
        model_loaded = load_model_if_exists()
        
    if not model_loaded:
        # If we don't have a real model, use a demo mode with simulated results
        logger.warning("No model loaded, using demo mode with simulated results")
        return simulate_prediction(image)
    
    try:
        processed_image = preprocess_image(image)
        if processed_image is None:
            return "Error", 0.0, "Failed to preprocess image"
            
        # Add a small delay to simulate processing time for better UX
        time.sleep(0.5)
            
        # Predict using the Xception model
        prediction = model.predict(processed_image)
        logger.info(f"Raw prediction: {prediction}")
        
        # Assuming the model outputs a single value between 0 and 1
        score = prediction[0][0]
        
        # Invert the logic if necessary
        result = "Fake" if score > 0.5 else "Real"
        confidence = float(score) if result == "Fake" else float(1 - score)
        
        logger.info(f"Result: {result}, Confidence: {confidence:.2%}")
        return result, confidence, "Prediction successful"
    except Exception as e:
        logger.error(f"Error during prediction: {e}")
        return "Error", 0.0, str(e)

def simulate_prediction(image):
    """Simulate a prediction when no model is available"""
    # Calculate image characteristics
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blur = cv2.Laplacian(gray, cv2.CV_64F).var()
        brightness = np.mean(gray)
        
        # Use these characteristics to influence the result
        # Higher blur and extreme brightness often indicate manipulation
        blur_factor = min(blur / 500, 1.0)  # Normalize blur
        brightness_factor = abs(brightness - 128) / 128  # How far from middle gray
        
        # Calculate probability based on image characteristics
        import random
        fake_probability = (blur_factor * 0.5) + (brightness_factor * 0.3) + (random.random() * 0.2)
        
        # Ensure we get a mix of real and fake results
        is_fake = fake_probability > 0.5
        
        # Confidence should be higher when factors are more extreme
        base_confidence = 0.6 + (blur_factor * 0.2) + (brightness_factor * 0.2)
        confidence = min(base_confidence, 0.95)  # Cap at 95%
        
        result = "Fake" if is_fake else "Real"
        logger.info(f"Demo mode - Result: {result}, Confidence: {confidence:.2%}")
        return result, confidence, "Demo mode: analysis based on image characteristics"
    except Exception as e:
        logger.error(f"Error in simulation: {e}")
        return "Real", 0.75, "Demo mode: fallback result"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    
    if file and allowed_file(file.filename):
        try:
            # Generate a unique filename
            file_ext = file.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            # Save the file
            file.save(filepath)
            logger.info(f"Saved uploaded file to {filepath}")
            
            # Read the image
            image = cv2.imread(filepath)
            if image is None:
                return jsonify({'error': 'Failed to read image'})
                
            # Predict
            result, confidence, message = predict_image(image)
            
            if result == "Error":
                return jsonify({'error': f'Analysis error: {message}'})
            
            # Log the prediction
            log_prediction(filepath, result, confidence)
            
            return jsonify({
                'result': result,
                'confidence': f"{confidence:.2%}",
                'image_url': f"/{filepath}",
                'message': message
            })
        except Exception as e:
            logger.error(f"Error processing upload: {e}")
            return jsonify({'error': f'Processing error: {str(e)}'})
    
    return jsonify({'error': 'Invalid file format'})

@app.route('/webcam', methods=['POST'])
def webcam_upload():
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data'})
        
        # Decode base64 image
        img_data = base64.b64decode(data['image'].split(',')[1])
        nparr = np.frombuffer(img_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Failed to decode image'})
        
        # Generate a unique filename
        unique_filename = f"{uuid.uuid4().hex}.jpg"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Save the image
        cv2.imwrite(filepath, image)
        logger.info(f"Saved webcam image to {filepath}")
        
        # Predict
        result, confidence, message = predict_image(image)
        
        if result == "Error":
            return jsonify({'error': f'Analysis error: {message}'})
        
        # Log the prediction
        log_prediction(filepath, result, confidence)
        
        return jsonify({
            'result': result,
            'confidence': f"{confidence:.2%}",
            'image_url': f"/{filepath}",
            'message': message
        })
    except Exception as e:
        logger.error(f"Error processing webcam image: {e}")
        return jsonify({'error': f'Processing error: {str(e)}'})

def log_prediction(image_path, result, confidence):
    """Log prediction to a file for analytics"""
    log_dir = 'logs'
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, 'predictions.json')
    
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'image_path': image_path,
        'result': result,
        'confidence': float(confidence)
    }
    
    # Load existing logs
    logs = []
    if os.path.exists(log_file):
        try:
            with open(log_file, 'r') as f:
                logs = json.load(f)
        except Exception as e:
            logger.error(f"Error reading log file: {e}")
            logs = []
    
    # Add new log
    logs.append(log_entry)
    
    # Save logs
    try:
        with open(log_file, 'w') as f:
            json.dump(logs, f, indent=2)
        logger.info(f"Logged prediction for {image_path}")
    except Exception as e:
        logger.error(f"Error writing to log file: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model_loaded,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    # Create upload directory if it doesn't exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Create logs directory
    os.makedirs('logs', exist_ok=True)
    
    # Clean up old uploads if needed
    # Uncomment this if you want to clean up old files on startup
    # cleanup_old_uploads(UPLOAD_FOLDER, max_age_days=7)
    
    logger.info("Starting DeepFake Detector application")
    app.run(debug=True, host='0.0.0.0', port=5000)