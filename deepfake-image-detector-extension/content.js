// Modified injectTFJSLoader function in content.js
function injectTFJSLoader() {
    return new Promise((resolve, reject) => {
      // Create script element to inject tfjs-loader.js
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('tfjs-loader.js');
      
      // Set up communication with the injected script
      document.addEventListener('tfjs-loader-ready', function() {
        console.log('TensorFlow.js loader script ready');
        
        // Get the URLs for the model files
        const modelUrl = chrome.runtime.getURL('models/converted_model/model.json');
        
        // Pass model configuration to the injected script
        document.dispatchEvent(new CustomEvent('model-config-ready', {
          detail: {
            modelUrl: modelUrl,
            // Add any other configuration needed
            inputShape: [224, 224, 3]
          }
        }));
      });
      
      document.addEventListener('model-loaded', function() {
        console.log('Model loaded in page context');
        resolve();
      });
      
      document.addEventListener('model-load-error', function(event) {
        console.error('Model load error:', event.detail?.error);
        reject(event.detail?.error || 'Unknown error loading model');
      });
      
      document.addEventListener('tfjs-load-error', function() {
        reject('Failed to load TensorFlow.js');
      });
      
      // Inject script
      (document.head || document.documentElement).appendChild(script);
      
      // Set a timeout in case the script injection fails
      setTimeout(() => {
        reject('Timeout while loading TensorFlow.js');
      }, 30000); // 30 seconds timeout
    });
  }
  
  // Initialize when the page loads
  let modelLoaded = false;
  let modelLoadingInProgress = false;
  
  // Try to inject the TFJS loader as soon as possible
  function initializeModel() {
    if (modelLoaded || modelLoadingInProgress) return;
    
    modelLoadingInProgress = true;
    console.log('Deepfake detector content script initializing model');
    
    injectTFJSLoader()
      .then(() => {
        console.log('TensorFlow.js and model successfully initialized');
        modelLoaded = true;
        modelLoadingInProgress = false;
      })
      .catch(error => {
        console.error('Failed to initialize TensorFlow.js or model:', error);
        modelLoadingInProgress = false;
      });
  }
  
  // Start loading as soon as content script loads
  initializeModel();
  
  // Also try on DOMContentLoaded in case needed
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Deepfake detector content script loaded');
    
    // Re-attempt initialization if not already done
    if (!modelLoaded && !modelLoadingInProgress) {
      initializeModel();
    }
  });
  
  // Helper function to analyze an image
  async function analyzeImageWithTFJS(imageData) {
    if (!modelLoaded) {
      if (!modelLoadingInProgress) {
        // Try to initialize model if not already in progress
        await injectTFJSLoader();
        modelLoaded = true;
      } else {
        // Model is still loading, wait for it
        throw new Error('Model is still loading, please try again in a moment');
      }
    }
    
    return new Promise((resolve, reject) => {
      // Set up listeners for the analysis result
      const resultListener = function(event) {
        document.removeEventListener('analysis-result', resultListener);
        if (event.detail.error) {
          reject(event.detail.error);
        } else {
          resolve(event.detail);
        }
      };
      
      // Set a timeout in case of no response
      const timeout = setTimeout(() => {
        document.removeEventListener('analysis-result', resultListener);
        reject('Analysis timeout: No response from model');
      }, 10000);
      
      document.addEventListener('analysis-result', function(event) {
        clearTimeout(timeout);
        resultListener(event);
      });
      
      try {
        // Send image data to the TFJS loader
        document.dispatchEvent(new CustomEvent('analyze-image', {
          detail: { imageData }
        }));
      } catch (error) {
        clearTimeout(timeout);
        document.removeEventListener('analysis-result', resultListener);
        reject('Failed to dispatch analyze-image event: ' + error.message);
      }
    });
  }
  
  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanPage') {
      // Make sure to actually send a response
      scanImagesOnPage()
        .then(result => {
          try {
            sendResponse(result);
          } catch (error) {
            console.error('Error sending response:', error);
          }
        })
        .catch(error => {
          console.error('Error in scanImagesOnPage:', error);
          try {
            sendResponse({ error: error.message, processedImages: 0, totalImages: 0 });
          } catch (sendError) {
            console.error('Error sending error response:', sendError);
          }
        });
      return true; // Important: indicates async response
    } else if (request.action === 'analyzeSelectedImage') {
      try {
        analyzeSelectedImage();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error in analyzeSelectedImage:', error);
        try {
          sendResponse({ error: error.message });
        } catch (sendError) {
          console.error('Error sending error response:', sendError);
        }
      }
      return false; // Not async
    } else if (request.action === 'checkModelStatus') {
      try {
        sendResponse({ loaded: modelLoaded });
      } catch (error) {
        console.error('Error sending model status response:', error);
      }
      return false; // Not async
    } else if (request.action === 'highlightImage') {
      try {
        highlightImage(request.index);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error highlighting image:', error);
      }
      return false;
    } else if (request.action === 'unhighlightImage') {
      try {
        unhighlightImage(request.index);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error unhighlighting image:', error);
      }
      return false;
    }
    
    return false;
  });
  
  // Global variable to store results for highlighting
  let pageResults = [];
  
  // Scan all images on the page
  async function scanImagesOnPage() {
    if (!modelLoaded) {
      try {
        await injectTFJSLoader();
        modelLoaded = true;
      } catch (error) {
        throw new Error('Model not initialized: ' + error.message);
      }
    }
    
    const images = Array.from(document.querySelectorAll('img'));
    const results = [];
    let processedCount = 0;
    let errorCount = 0;
    
    // Process each image that meets minimum size requirements
    const relevantImages = images.filter(img => 
      img.naturalWidth > 100 && img.naturalHeight > 100);
    
    if (relevantImages.length === 0) {
      return {
        totalImages: 0,
        processedImages: 0,
        results: []
      };
    }
    
    // Process images in batches to avoid overloading the browser
    const batchSize = 5;
    for (let i = 0; i < relevantImages.length; i += batchSize) {
      const batch = relevantImages.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (img) => {
        try {
          const imageData = await getImageDataUrl(img);
          
          // Analyze image using TensorFlow.js
          const result = await analyzeImageWithTFJS(imageData);
          
          if (!result.error) {
            results.push({
              imageUrl: img.src,
              result: result,
              element: img
            });
            
            // Add visual indicator on the image based on result
            addImageOverlay(img, result);
            processedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error processing image:', error);
          errorCount++;
        }
      });
      
      // Wait for all images in this batch to be processed
      await Promise.allSettled(batchPromises);
    }
    
    // Store results for highlighting
    pageResults = results;
    
    return {
      totalImages: relevantImages.length,
      processedImages: processedCount,
      errorCount: errorCount,
      results: results
    };
  }
  
  // Get image data as a data URL
  function getImageDataUrl(imgElement) {
    return new Promise((resolve, reject) => {
      try {
        // Check if image is loaded
        if (!imgElement.complete) {
          imgElement.onload = () => {
            createImageDataUrl();
          };
          imgElement.onerror = () => {
            reject(new Error('Failed to load image'));
          };
        } else {
          createImageDataUrl();
        }
        
        function createImageDataUrl() {
          try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Check for valid dimensions
            const width = imgElement.naturalWidth;
            const height = imgElement.naturalHeight;
            
            if (width === 0 || height === 0) {
              reject(new Error('Image has zero width or height'));
              return;
            }
            
            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;
            
            // Draw image to canvas
            context.drawImage(imgElement, 0, 0);
            
            // Try to get data URL
            try {
              const dataUrl = canvas.toDataURL('image/jpeg');
              resolve(dataUrl);
            } catch (e) {
              // This can happen with cross-origin images
              reject(new Error('Cannot access image data: ' + e.message));
            }
          } catch (error) {
            reject(error);
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Add visual overlay to indicate deepfake probability
  function addImageOverlay(imgElement, result) {
    // Skip if element is no longer in DOM
    if (!document.contains(imgElement)) return;
    
    // Remove any existing overlay
    const existingOverlay = imgElement.parentNode.querySelector('.deepfake-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'deepfake-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '5px';
    overlay.style.left = '5px';
    overlay.style.padding = '5px 10px';
    overlay.style.borderRadius = '3px';
    overlay.style.fontSize = '12px';
    overlay.style.fontWeight = 'bold';
    overlay.style.color = 'white';
    overlay.style.zIndex = '9999';
    
    // Style based on prediction
    if (result.isFake) {
      overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      overlay.textContent = `LIKELY FAKE (${result.confidence}%)`;
    } else {
      overlay.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
      overlay.textContent = `LIKELY REAL (${result.confidence}%)`;
    }
    
    // Position the overlay relative to the image
    const imgParent = imgElement.parentNode;
    
    // Make sure parent has position relative or absolute for overlay positioning
    if (getComputedStyle(imgParent).position === 'static') {
      imgParent.style.position = 'relative';
    }
    
    // Add overlay to parent of image
    imgParent.appendChild(overlay);
  }
  
  // Function to analyze a user-selected image
  function analyzeSelectedImage() {
    // Create selection instructions
    const instructions = document.createElement('div');
    instructions.id = 'deepfake-instructions';
    instructions.textContent = 'Click on any image to analyze it for deepfakes...';
    instructions.style.position = 'fixed';
    instructions.style.top = '10px';
    instructions.style.left = '50%';
    instructions.style.transform = 'translateX(-50%)';
    instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    instructions.style.color = 'white';
    instructions.style.padding = '10px 20px';
    instructions.style.borderRadius = '5px';
    instructions.style.zIndex = '10000';
    
    document.body.appendChild(instructions);
    
    // Add click listener for image selection
    const clickHandler = async (event) => {
      if (event.target.tagName === 'IMG') {
        try {
          const img = event.target;
          
          // Show analyzing indicator
          const tempOverlay = document.createElement('div');
          tempOverlay.style.position = 'absolute';
          tempOverlay.style.top = '0';
          tempOverlay.style.left = '0';
          tempOverlay.style.width = '100%';
          tempOverlay.style.height = '100%';
          tempOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
          tempOverlay.style.color = 'white';
          tempOverlay.style.display = 'flex';
          tempOverlay.style.justifyContent = 'center';
          tempOverlay.style.alignItems = 'center';
          tempOverlay.style.zIndex = '9999';
          tempOverlay.textContent = 'Analyzing...';
          
          // Position the overlay
          if (getComputedStyle(img.parentNode).position === 'static') {
            img.parentNode.style.position = 'relative';
          }
          img.parentNode.appendChild(tempOverlay);
          
          // Get image data
          const imageData = await getImageDataUrl(img);
          
          // Analyze using TensorFlow.js
          const result = await analyzeImageWithTFJS(imageData);
          
          // Remove temporary overlay
          if (document.contains(tempOverlay)) {
            tempOverlay.remove();
          }
          
          if (!result.error) {
            addImageOverlay(img, result);
            
            // Show a detailed result popup
            showResultPopup(img, result);
          } else {
            console.error('Error analyzing image:', result.error);
            alert('Failed to analyze image: ' + result.error);
          }
        } catch (error) {
          console.error('Error processing selected image:', error);
          alert('Failed to process image: ' + error.message);
        }
        
        // Clean up
        if (document.contains(instructions)) {
          document.body.removeChild(instructions);
        }
        document.removeEventListener('click', clickHandler);
      }
    };
    
    document.addEventListener('click', clickHandler);
  }
  
// Show detailed result popup
function showResultPopup(imgElement, result) {
    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'deepfake-result-popup';
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.backgroundColor = 'white';
    popup.style.padding = '20px';
    popup.style.borderRadius = '5px';
    popup.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
    popup.style.zIndex = '10001';
    popup.style.maxWidth = '400px';
    
    // Create popup content
    popup.innerHTML = `
      <h2 style="margin-top: 0; color: ${result.isFake ? 'red' : 'green'}">
        ${result.isFake ? 'Potential Deepfake Detected' : 'Image Appears Authentic'}
      </h2>
      <p>Confidence: <strong>${result.confidence}%</strong></p>
      <p>Raw score: ${result.score.toFixed(4)}</p>
      <div style="text-align: center; margin: 10px 0;">
        <img src="${imgElement.src}" style="max-width: 100%; max-height: 200px; object-fit: contain;">
      </div>
      <p style="color: #666; font-style: italic; font-size: 12px;">
        Note: This is an AI-based assessment and may not be 100% accurate.
      </p>
      <div style="text-align: right; margin-top: 15px;">
        <button id="deepfake-close-button" style="padding: 8px 15px; cursor: pointer;">Close</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(popup);
    
    // Add close functionality
    document.getElementById('deepfake-close-button').addEventListener('click', () => {
      document.body.removeChild(popup);
    });
    
    // Also close on escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(popup);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }
  
  // Highlight specific image from results list when hovering in popup
  function highlightImage(index) {
    if (pageResults.length > index) {
      const img = pageResults[index].element;
      
      // Skip if element is no longer in DOM
      if (!document.contains(img)) return;
      
      img.style.outline = '5px solid orange';
      img.style.outlineOffset = '2px';
      
      // Scroll to the image
      img.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  // Remove highlight from image
  function unhighlightImage(index) {
    if (pageResults.length > index) {
      const img = pageResults[index].element;
      
      // Skip if element is no longer in DOM
      if (!document.contains(img)) return;
      
      img.style.outline = '';
      img.style.outlineOffset = '';
    }
  }
