// This script will be injected into the page context to handle TensorFlow operations
(async function() {
    // Store the model URL and binary URLs passed from the content script
    let modelConfig = null;
    
    // Listen for the model config from content script
    document.addEventListener('model-config-ready', function(event) {
      modelConfig = event.detail;
      // Now that we have the config, load TensorFlow.js
      loadTensorFlow();
    });
    
    // Function to load TensorFlow.js
    function loadTensorFlow() {
      // Create a script element to load TensorFlow.js
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js';
      script.onload = () => {
        console.log('TensorFlow.js loaded successfully');
        
        // Use a simpler approach for testing
        useSimplifiedModel();
      };
      script.onerror = () => {
        console.error('Failed to load TensorFlow.js');
        document.dispatchEvent(new CustomEvent('tfjs-load-error'));
      };
      document.head.appendChild(script);
    }
    
    // Global model variable
    let model = null;
    
    // Use a simplified model for testing
    async function useSimplifiedModel() {
      try {
        // For testing, create a simple random model
        console.log('Creating a simple test model');
        
        // Create a simple sequential model for binary classification
        model = tf.sequential();
        
        // Add a convolutional layer
        model.add(tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 16,
          kernelSize: 3,
          activation: 'relu'
        }));
        
        // Add max pooling
        model.add(tf.layers.maxPooling2d({
          poolSize: 2,
          strides: 2
        }));
        
        // Add another conv+pool
        model.add(tf.layers.conv2d({
          filters: 32,
          kernelSize: 3,
          activation: 'relu'
        }));
        model.add(tf.layers.maxPooling2d({
          poolSize: 2,
          strides: 2
        }));
        
        // Flatten and add dense layers
        model.add(tf.layers.flatten());
        model.add(tf.layers.dense({
          units: 64,
          activation: 'relu'
        }));
        model.add(tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        }));
        
        // Compile the model
        model.compile({
          optimizer: 'adam',
          loss: 'binaryCrossentropy',
          metrics: ['accuracy']
        });
        
        console.log('Test model created successfully');
        document.dispatchEvent(new CustomEvent('model-loaded'));
        
      } catch (error) {
        console.error('Error creating test model:', error);
        document.dispatchEvent(new CustomEvent('model-load-error', {
          detail: { error: error.message }
        }));
      }
    }
    
    // Listen for image analysis requests
    document.addEventListener('analyze-image', async (event) => {
      const imageData = event.detail.imageData;
      
      if (!model) {
        document.dispatchEvent(new CustomEvent('analysis-result', {
          detail: { error: 'Model not loaded yet' }
        }));
        return;
      }
      
      try {
        // Process the image
        const tensor = await createImageTensor(imageData);
        
        // For the test model, we'll generate a random prediction
        // This is just for testing the interface
        const randomScore = Math.random(); // Random number between 0 and 1
        const isFake = randomScore > 0.5;
        const confidencePercent = Math.round((randomScore > 0.5 ? randomScore : 1 - randomScore) * 100);
        
        // Clean up tensor
        tensor.dispose();
        
        // Send back result
        document.dispatchEvent(new CustomEvent('analysis-result', {
          detail: {
            isFake,
            confidence: confidencePercent,
            score: randomScore
          }
        }));
        
      } catch (error) {
        console.error('Error analyzing image:', error);
        document.dispatchEvent(new CustomEvent('analysis-result', {
          detail: { error: error.message }
        }));
      }
    });
    
    // Helper function to convert image to tensor
    async function createImageTensor(imageData) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 224;  // Fixed size for the model
            canvas.height = 224;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 224, 224);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, 224, 224);
            
            // Convert to tensor and preprocess
            let tensor = tf.browser.fromPixels(imageData).toFloat();
            
            // Normalize
            tensor = tensor.div(255.0);
            
            // Add batch dimension
            tensor = tensor.expandDims(0);
            
            resolve(tensor);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = (error) => reject(error);
        img.src = imageData;
      });
    }
    
    // Notify that the script is ready
    document.dispatchEvent(new CustomEvent('tfjs-loader-ready'));
  })();