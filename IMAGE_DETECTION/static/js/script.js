// DOM Elements
const themeSwitch = document.getElementById("theme-switch")
const fileInput = document.getElementById("fileInput")
const browseBtn = document.getElementById("browse-btn")
const uploadBtn = document.getElementById("upload-btn")
const captureBtn = document.getElementById("capture-btn")
const switchCameraBtn = document.getElementById("switch-camera")
const clearHistoryBtn = document.getElementById("clear-history")
const closeResultsBtn = document.getElementById("close-results")
const saveResultBtn = document.getElementById("save-result")
const shareResultBtn = document.getElementById("share-result")
const tabBtns = document.querySelectorAll(".tab-btn")
const tabContents = document.querySelectorAll(".tab-content")
const dropArea = document.getElementById("drop-area")
const fileInfo = document.getElementById("file-info")
const video = document.getElementById("video")
const loadingOverlay = document.getElementById("loading-overlay")
const resultsContainer = document.getElementById("results-container")
const historyList = document.getElementById("history-list")
const toast = document.getElementById("toast")
const toastMessage = document.getElementById("toast-message")
const toastClose = document.getElementById("toast-close")
const menuToggle = document.getElementById("menuToggle")
const navLinks = document.getElementById("navLinks")
const webcamPreviewContainer = document.getElementById("webcam-preview-container")
const webcamPreviewImage = document.getElementById("webcam-preview-image")

// State
let currentFile = null
let currentStream = null
let facingMode = "user" // front camera by default
let analysisHistory = JSON.parse(localStorage.getItem("analysisHistory")) || []
let currentResult = null
let webcamInitialized = false
let capturedImage = null
let isCapturing = false // Flag to prevent multiple captures

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initTheme()
  renderHistory()
  createParticles()

  // Check if dark mode is preferred
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark-theme")
    themeSwitch.checked = true
  }

  // Mobile menu toggle
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active")
      menuToggle.classList.toggle("active")
    })
  }
})

// Create particles for hero background
function createParticles() {
  const particles = document.getElementById("particles")
  if (!particles) return

  const particleCount = 50

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div")
    particle.className = "particle"
    particle.style.left = Math.random() * 100 + "vw"
    particle.style.top = Math.random() * 100 + "vh"
    particle.style.transform = `scale(${Math.random()})`
    particle.style.opacity = Math.random()
    particle.style.animation = `float ${5 + Math.random() * 10}s linear infinite`
    particles.appendChild(particle)
  }
}

// Theme Toggle
function initTheme() {
  themeSwitch.addEventListener("change", () => {
    document.body.classList.toggle("dark-theme")
    showToast(themeSwitch.checked ? "Dark mode enabled" : "Light mode enabled")
  })
}

// Tab Navigation
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-tab")

    // Remove active class from all tabs
    tabBtns.forEach((b) => b.classList.remove("active"))
    tabContents.forEach((c) => c.classList.remove("active"))

    // Add active class to selected tab
    btn.classList.add("active")
    document.getElementById(`${tabId}-tab`).classList.add("active")

    // Initialize webcam when switching to webcam tab
    if (tabId === "webcam") {
      if (!webcamInitialized) {
        initWebcam()
        webcamInitialized = true
      } else if (!currentStream) {
        initWebcam()
      }
    } else {
      // Stop webcam when switching to other tabs
      stopWebcam()
    }
  })
})

// File Upload
browseBtn.addEventListener("click", () => {
  fileInput.click()
})

fileInput.addEventListener("change", (e) => {
  handleFileSelect(e.target.files[0])
})

uploadBtn.addEventListener("click", () => {
  if (currentFile) {
    uploadAndAnalyze(currentFile)
  }
})

// Drag and Drop
;["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults, false)
})

function preventDefaults(e) {
  e.preventDefault()
  e.stopPropagation()
}
;["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.add("drag-over")
  })
})
;["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.remove("drag-over")
  })
})

dropArea.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0]
  handleFileSelect(file)
})

function handleFileSelect(file) {
  if (!file) return

  // Check if file is an image
  if (!file.type.match("image.*")) {
    showToast("Please select an image file")
    return
  }

  currentFile = file
  fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`
  uploadBtn.disabled = false

  // Show preview
  const reader = new FileReader()
  reader.onload = (e) => {
    const preview = document.getElementById("preview")
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`
    }
  }
  reader.readAsDataURL(file)
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " bytes"
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
  else return (bytes / 1048576).toFixed(1) + " MB"
}

// Webcam
function initWebcam() {
  if (currentStream) {
    stopWebcam()
  }

  const constraints = {
    video: {
      facingMode: facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  }

  // Hide webcam preview if visible
  if (webcamPreviewContainer) {
    webcamPreviewContainer.style.display = "none"
  }

  // Show a message that we're requesting camera permission
  const videoContainer = document.querySelector(".video-container")
  if (videoContainer) {
    // Remove any existing messages first
    const existingMessage = videoContainer.querySelector(".webcam-message")
    if (existingMessage) existingMessage.remove()

    const existingError = videoContainer.querySelector(".webcam-error")
    if (existingError) existingError.remove()

    videoContainer.insertAdjacentHTML(
      "beforeend",
      `
      <div class="webcam-message">
        <i class="fas fa-camera"></i>
        <p>Requesting camera permission...</p>
      </div>
    `,
    )
  }

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      // Remove the message
      const message = document.querySelector(".webcam-message")
      if (message) message.remove()

      currentStream = stream
      video.srcObject = stream

      // Reset the isCapturing flag
      isCapturing = false

      video
        .play()
        .then(() => {
          showToast("Camera activated successfully")
        })
        .catch((err) => {
          console.error("Error playing video:", err)
          showToast("Error playing video stream")
        })
    })
    .catch((err) => {
      console.error("Error accessing webcam: ", err)

      // Remove the message
      const message = document.querySelector(".webcam-message")
      if (message) message.remove()

      // Update the video container with an error message
      if (videoContainer) {
        videoContainer.insertAdjacentHTML(
          "beforeend",
          `
          <div class="webcam-error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Could not access webcam. Please check your camera permissions in browser settings.</p>
            <button class="btn secondary retry-webcam">Try Again</button>
          </div>
        `,
        )

        // Add event listener to the retry button
        const retryBtn = document.querySelector(".retry-webcam")
        if (retryBtn) {
          retryBtn.addEventListener("click", () => {
            const error = document.querySelector(".webcam-error")
            if (error) error.remove()
            initWebcam()
          })
        }
      }

      showToast("Camera access denied. Please check permissions.")
    })
}

function stopWebcam() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => {
      track.stop()
    })
    currentStream = null

    // Clear the video source
    if (video) {
      video.srcObject = null
    }

    // Reset the isCapturing flag
    isCapturing = false
  }
}

switchCameraBtn.addEventListener("click", () => {
  facingMode = facingMode === "user" ? "environment" : "user"
  initWebcam()
  showToast(facingMode === "user" ? "Switched to front camera" : "Switched to back camera")
})

captureBtn.addEventListener("click", () => {
  // Prevent multiple captures at once
  if (isCapturing) {
    showToast("Already processing a capture, please wait...")
    return
  }

  if (!currentStream) {
    showToast("Webcam is not available")
    return
  }

  // Check if video is ready
  if (!video.videoWidth) {
    showToast("Webcam is not ready yet. Please wait a moment.")
    return
  }

  // Set capturing flag
  isCapturing = true

  // Show loading indicator on the capture button
  captureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Capturing...'
  captureBtn.disabled = true

  // Create a canvas to capture the image
  const canvas = document.createElement("canvas")
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext("2d")

  // Apply mirror effect if using front camera
  if (facingMode === "user") {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }

  ctx.drawImage(video, 0, 0)

  // Show preview of captured image
  if (webcamPreviewContainer && webcamPreviewImage) {
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9)
    webcamPreviewImage.src = imageDataUrl
    webcamPreviewContainer.style.display = "flex"

    // Remove any existing preview actions
    const existingActions = document.getElementById("preview-actions")
    if (existingActions) {
      existingActions.remove()
    }

    // Add cancel and confirm buttons to the preview
    const previewActions = document.createElement("div")
    previewActions.id = "preview-actions"
    previewActions.className = "preview-actions"
    previewActions.innerHTML = `
      <button class="btn secondary" id="cancel-capture">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn primary" id="confirm-capture">
        <i class="fas fa-check"></i> Use This Image
      </button>
    `
    webcamPreviewContainer.appendChild(previewActions)

    // Add event listeners to the buttons
    document.getElementById("cancel-capture").addEventListener("click", () => {
      webcamPreviewContainer.style.display = "none"
      captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture & Analyze'
      captureBtn.disabled = false
      isCapturing = false
    })

    document.getElementById("confirm-capture").addEventListener("click", () => {
      // Convert the canvas to a blob and create a file
      canvas.toBlob(
        (blob) => {
          const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" })
          capturedImage = file

          // Show preview in the results area
          const preview = document.getElementById("preview")
          if (preview) {
            preview.innerHTML = `<img src="${webcamPreviewImage.src}" alt="Preview">`
          }

          // Hide the preview container
          webcamPreviewContainer.style.display = "none"

          // Analyze the image
          uploadAndAnalyze(file)

          // Reset the capture button
          captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture & Analyze'
          captureBtn.disabled = false
        },
        "image/jpeg",
        0.9,
      )
    })
  } else {
    // Fallback if preview elements don't exist
    canvas.toBlob(
      (blob) => {
        const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" })

        // Show preview
        const reader = new FileReader()
        reader.onload = (e) => {
          const preview = document.getElementById("preview")
          if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`
          }
        }
        reader.readAsDataURL(file)

        uploadAndAnalyze(file)

        // Reset the capture button
        captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture & Analyze'
        captureBtn.disabled = false
      },
      "image/jpeg",
      0.9,
    )
  }
})

// Analysis
function uploadAndAnalyze(file) {
  showLoading(true)

  const formData = new FormData()
  formData.append("file", file)

  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      showLoading(false)

      if (data.error) {
        showToast(data.error)
        isCapturing = false // Reset capturing flag
      } else {
        displayResults(data, file)
        isCapturing = false // Reset capturing flag
      }
    })
    .catch((error) => {
      showLoading(false)
      console.error("Error:", error)
      showToast("An error occurred during analysis")
      isCapturing = false // Reset capturing flag

      // Reset the capture button if it was a webcam capture
      if (captureBtn.disabled) {
        captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture & Analyze'
        captureBtn.disabled = false
      }
    })
}

function displayResults(data, file) {
  // Store current result
  currentResult = {
    file: file,
    result: data.result,
    confidence: data.confidence,
    imageUrl: data.image_url,
    timestamp: new Date().toISOString(),
  }

  // Display image
  const preview = document.getElementById("preview")
  if (preview) {
    preview.innerHTML = `<img src="${data.image_url}" alt="Analyzed Image">`
  }

  // Display verdict
  const resultVerdict = document.getElementById("result-verdict")
  let verdictClass = ""
  let verdictText = ""

  if (data.result === "Real") {
    verdictClass = "verdict-real"
    verdictText = `<i class="fas fa-check-circle"></i> This image appears to be REAL`
  } else {
    verdictClass = "verdict-fake"
    verdictText = `<i class="fas fa-exclamation-triangle"></i> This image appears to be FAKE`
  }

  if (resultVerdict) {
    resultVerdict.className = "result-verdict " + verdictClass
    resultVerdict.innerHTML = verdictText
  }

  // Display confidence meter
  const confidenceMeter = document.getElementById("confidence-meter")
  const confidenceValueEl = document.getElementById("confidence-value")

  if (confidenceMeter && confidenceValueEl) {
    confidenceMeter.style.width = "0%"
    confidenceMeter.className = "meter-fill"

    if (data.result === "Real") {
      confidenceMeter.classList.add("real")
    } else {
      confidenceMeter.classList.add("fake")
    }

    confidenceValueEl.textContent = data.confidence

    // Animate confidence meter
    setTimeout(() => {
      confidenceMeter.style.width = data.confidence
    }, 100)
  }

  // Display explanation
  const explanation = document.getElementById("result-explanation")
  if (explanation) {
    if (data.result === "Real") {
      explanation.innerHTML = `
        Our AI analysis indicates this image is likely authentic with ${data.confidence} confidence. 
        No significant manipulation markers were detected. However, advanced deepfakes can sometimes 
        evade detection, so always maintain healthy skepticism with online content.
      `
    } else {
      explanation.innerHTML = `
        Our AI analysis detected manipulation patterns consistent with deepfakes, with ${data.confidence} confidence.
        The image shows artificial characteristics that don't appear in authentic photos. 
        This type of content is increasingly common online and can be used to spread misinformation.
      `
    }
  }

  // Generate heatmap
  generateHeatmap(data.result)

  // Show results container with animation
  if (resultsContainer) {
    resultsContainer.style.display = "block"

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: "smooth" })
  }
}

// History
function saveToHistory() {
  if (!currentResult) return

  // Create a URL for the file
  const fileUrl = URL.createObjectURL(currentResult.file)

  const historyItem = {
    ...currentResult,
    id: Date.now().toString(),
    fileUrl: fileUrl,
  }

  analysisHistory.unshift(historyItem)

  // Limit history to 20 items
  if (analysisHistory.length > 20) {
    analysisHistory.pop()
  }

  localStorage.setItem("analysisHistory", JSON.stringify(analysisHistory))
  renderHistory()
  showToast("Result saved to history")

  // Switch to history tab
  tabBtns.forEach((btn) => {
    if (btn.getAttribute("data-tab") === "history") {
      btn.click()
    }
  })
}

function renderHistory() {
  if (!historyList) return

  if (analysisHistory.length === 0) {
    historyList.innerHTML = `
      <div class="empty-history">
        <i class="fas fa-history"></i>
        <p>Your analysis history will appear here</p>
      </div>
    `
    return
  }

  historyList.innerHTML = ""

  analysisHistory.forEach((item) => {
    const date = new Date(item.timestamp)
    const formattedDate = date.toLocaleDateString() + " " + date.toLocaleTimeString()

    const historyItem = document.createElement("div")
    historyItem.className = "history-item"
    historyItem.innerHTML = `
      <div class="history-image">
        <img src="${item.fileUrl || item.imageUrl}" alt="History Image">
      </div>
      <div class="history-details">
        <span class="history-result ${item.result.toLowerCase()}">${item.result}</span>
        <p>Confidence: ${item.confidence}</p>
        <p class="history-date">${formattedDate}</p>
      </div>
    `

    historyItem.addEventListener("click", () => {
      // Load this result
      const preview = document.getElementById("preview")
      if (preview) {
        preview.innerHTML = `<img src="${item.fileUrl || item.imageUrl}" alt="History Image">`
      }

      // Display results
      displayResults(
        {
          result: item.result,
          confidence: item.confidence,
          image_url: item.fileUrl || item.imageUrl,
        },
        null,
      )
    })

    historyList.appendChild(historyItem)
  })
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear your history?")) {
      analysisHistory = []
      localStorage.removeItem("analysisHistory")
      renderHistory()
      showToast("History cleared")
    }
  })
}

if (saveResultBtn) {
  saveResultBtn.addEventListener("click", saveToHistory)
}

if (shareResultBtn) {
  shareResultBtn.addEventListener("click", () => {
    if (!currentResult) return

    if (navigator.share) {
      navigator
        .share({
          title: "DeepFake Detection Result",
          text: `This image was analyzed as ${currentResult.result} with ${currentResult.confidence} confidence.`,
          url: window.location.href,
        })
        .then(() => showToast("Shared successfully"))
        .catch((err) => showToast("Error sharing: " + err.message))
    } else {
      // Fallback for browsers that don't support Web Share API
      const dummyInput = document.createElement("input")
      document.body.appendChild(dummyInput)
      dummyInput.value = `DeepFake Detection Result: ${currentResult.result} (${currentResult.confidence} confidence)`
      dummyInput.select()
      document.execCommand("copy")
      document.body.removeChild(dummyInput)
      showToast("Result copied to clipboard")
    }
  })
}

if (closeResultsBtn) {
  closeResultsBtn.addEventListener("click", () => {
    if (resultsContainer) {
      resultsContainer.style.display = "none"
    }
  })
}

// Utility Functions
function showLoading(show) {
  if (loadingOverlay) {
    if (show) {
      loadingOverlay.classList.add("active")
    } else {
      loadingOverlay.classList.remove("active")
    }
  }
}

function showToast(message) {
  if (toast && toastMessage) {
    toastMessage.textContent = message
    toast.classList.add("active")

    // Auto hide after 3 seconds
    setTimeout(() => {
      hideToast()
    }, 3000)
  }
}

function hideToast() {
  if (toast) {
    toast.classList.remove("active")
  }
}

if (toastClose) {
  toastClose.addEventListener("click", hideToast)
}

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  stopWebcam()
})

// Generate a simulated heatmap when showing results
function generateHeatmap(result) {
  const heatmapContainer = document.getElementById("heatmap")
  if (!heatmapContainer) return

  // Create canvas for heatmap
  const canvas = document.createElement("canvas")
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext("2d")

  // Draw gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)

  if (result === "Fake") {
    gradient.addColorStop(0, "rgba(244, 67, 54, 0.1)")
    gradient.addColorStop(1, "rgba(244, 67, 54, 0.6)")

    // Draw some random "detection" points
    ctx.fillStyle = "rgba(244, 67, 54, 0.8)"
  } else {
    gradient.addColorStop(0, "rgba(76, 175, 80, 0.1)")
    gradient.addColorStop(1, "rgba(76, 175, 80, 0.6)")

    // Draw some random "detection" points
    ctx.fillStyle = "rgba(76, 175, 80, 0.8)"
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Add some random circles to simulate detection points
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const radius = Math.random() * 20 + 5

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Add grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
  ctx.lineWidth = 1

  for (let i = 0; i < canvas.width; i += 20) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, canvas.height)
    ctx.stroke()
  }

  for (let i = 0; i < canvas.height; i += 20) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(canvas.width, i)
    ctx.stroke()
  }

  // Add text
  ctx.fillStyle = "#fff"
  ctx.font = "14px Arial"
  ctx.fillText("AI Detection Heatmap (Visualization)", 10, 20)

  heatmapContainer.innerHTML = ""
  heatmapContainer.appendChild(canvas)
}

// Add CSS for preview actions
const style = document.createElement("style")
style.textContent = `
  .preview-actions {
    position: absolute;
    bottom: 20px;
    display: flex;
    gap: 10px;
    justify-content: center;
    width: 100%;
  }
  
  .webcam-preview-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 20;
  }
  
  .webcam-preview-image {
    max-width: 90%;
    max-height: 70%;
    border-radius: var(--border-radius);
    margin-bottom: 20px;
  }
`
document.head.appendChild(style)

