
# 🧠 Deepfake Detection System

This is a complete deepfake detection system built with three independent modules:

- 🎭 **IMAGE_DETECTION** – Deepfake Image Detection (Flask)
- 🎥 **VIDEO_DETECTION** – Deepfake Video Detection (Django)
- 📰 **NEWS_DETECTION** – Fake News Detection (Django + React)

It also includes two browser extensions for real-time detection:

- 🖼️ `deepfake-image-detector-extension`
- 🗞️ `news-extension`

---

## 📁 Project Structure

```
DEEPFAKE/
│
├── IMAGE_DETECTION/                        # Flask app for deepfake image detection
├── VIDEO_DETECTION/                        # Django app for video deepfake detection
├── NEWS_DETECTION/                         # Django + React app for fake news detection
│
├── deepfake-image-detector-extension/      # Chrome extension for image detection
├── news-extension/                         # Chrome extension for news detection
│
├── solution-images/                        # Final Output images of all 3 modules     
│
└── README.md                               # Project documentation
```

---

## 🛠️ Setup Guide

```bash
git clone https://github.com/Prakhar2025/DEEPFAKE
cd DEEPFAKE
```

> 📌 **Important:** Always return to the `DEEPFAKE` directory before switching modules.

### 1. 🎭 IMAGE_DETECTION

> Flask-based module to detect deepfake images

#### 📌 Steps:
```bash
cd DEEPFAKE
cd IMAGE_DETECTION
python -m venv venv
venv\Scripts\activate   # or source venv/bin/activate (Linux/Mac)
```

#### 🔧 Install dependencies:
```bash
pip install Flask==3.0.2
pip install opencv-python==4.9.0.80
pip install numpy==1.26.4
pip install tensorflow==2.15.0
```

#### 🚀 Run the app:
```bash
python app.py
```
Once the image detection task is completed, press `Ctrl + C` to stop the server and move back:
```bash
cd ../
```

---

### 2. 🎥 VIDEO_DETECTION

> Django-based module to detect manipulated/deepfake videos

#### 📌 Steps:
```bash
cd DEEPFAKE
cd VIDEO_DETECTION
python -m venv venv
venv\Scripts\activate
```

#### 🔧 Install dependencies:
```bash
pip install numpy==1.23.5
pip install tensorflow==2.12.0
pip install django opencv-python pillow matplotlib scikit-learn
```

#### 🚀 Run the server:
```bash
python manage.py runserver
```
Once the video detection task is completed, press `Ctrl + C` and move back:
```bash
cd ../
```

---

### 3. 📰 NEWS_DETECTION

> Full-stack Fake News Detection system (Django + React)

⚛️ JavaScript Setup (Frontend) - Use separate terminal

#### 📌 Steps:

🐍 Python Setup (Backend)
```bash
cd DEEPFAKE
cd NEWS_DETECTION/app/FakeNewsDetectorAPI/
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

🌐 React Frontend (New Terminal)
```bash
cd DEEPFAKE/NEWS_DETECTION/app/fake-news-detector-frontend/
npm install
npm start
```

---

## 🌐 Chrome Extensions

### 🖼️ deepfake-image-detector-extension

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the `deepfake-image-detector-extension` folder

### 🗞️ news-extension

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the `news-extension` folder

---

## 🧪 Testing Resources

You can use the test samples (images and videos) available in the provided Google Drive folder:
```bash
https://drive.google.com/drive/folders/1SMUrzFxQwdIIosYfPBnN9Uj20LLL6KFI?usp=drive_link
```
Or repository test datasets to check system accuracy and functionality.

---

## 📌 Key Notes

- All 3 detection modules run **independently**.
- Always activate the correct virtual environment before running any module.
- Always return to the main `DEEPFAKE` directory before running a different module.
- The extensions allow for **real-time content validation** while browsing the web.

---

## 👥 Contributors

- Prakhar Shukla
