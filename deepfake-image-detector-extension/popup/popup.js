// Popup script for Deepfake Detector extension

// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get UI elements
    const scanPageButton = document.getElementById('scanPage');
    const analyzeSelectedButton = document.getElementById('analyzeSelected');
    const statusElement = document.getElementById('status');
    const resultsElement = document.getElementById('results');
    
    // Set initial status
    statusElement.textContent = 'Initializing...';
    statusElement.className = 'status warning';
    
    // Check if content script is ready and model is loaded
    checkContentScriptStatus();
    
    // Handler for "Scan All Images" button
    scanPageButton.addEventListener('click', async () => {
      // Update status
      statusElement.textContent = 'Scanning images on page...';
      statusElement.className = 'status scanning';
      resultsElement.innerHTML = '';
      
      try {
        // Get the active tab
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const activeTab = tabs[0];
        
        if (!activeTab) {
          throw new Error('No active tab found');
        }
        
        // Send message to content script to scan the page
        chrome.tabs.sendMessage(
          activeTab.id, 
          {action: 'scanPage'},
          function(response) {
            // Check for communication errors
            if (chrome.runtime.lastError) {
              console.log('Error in communication:', chrome.runtime.lastError.message);
              statusElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
              statusElement.className = 'status error';
              return;
            }
            
            if (!response) {
              statusElement.textContent = 'No response from page. Please refresh the page and try again.';
              statusElement.className = 'status error';
              return;
            }
            
            // Update status with scan results
            statusElement.textContent = `Scanned ${response.processedImages} of ${response.totalImages} images`;
            statusElement.className = 'status success';
            
            // Display results
            displayResults(response.results);
          }
        );
      } catch (error) {
        console.error('Error scanning page:', error);
        statusElement.textContent = 'Error: ' + error.message;
        statusElement.className = 'status error';
      }
    });
    
    // Handler for "Analyze Selected Image" button
    analyzeSelectedButton.addEventListener('click', async () => {
      try {
        // Update status
        statusElement.textContent = 'Click on an image to analyze...';
        statusElement.className = 'status scanning';
        resultsElement.innerHTML = '';
        
        // Get the active tab
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const activeTab = tabs[0];
        
        if (!activeTab) {
          throw new Error('No active tab found');
        }
        
        // Send message to content script to enable image selection
        chrome.tabs.sendMessage(
          activeTab.id,
          {action: 'analyzeSelectedImage'},
          function(response) {
            // We don't need a response here, but handle errors
            if (chrome.runtime.lastError) {
              console.log('Communication error:', chrome.runtime.lastError.message);
              // We can ignore this error as we're closing the popup anyway
            }
            
            // Close the popup to allow interaction with the page
            window.close();
          }
        );
      } catch (error) {
        console.error('Error initiating image analysis:', error);
        statusElement.textContent = 'Error: ' + error.message;
        statusElement.className = 'status error';
      }
    });
    
    // Function to check if content script is injected and model is loaded
    function checkContentScriptStatus() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
          statusElement.textContent = 'Cannot access current tab';
          statusElement.className = 'status error';
          return;
        }
        
        const activeTab = tabs[0];
        
        // Try to send a message to check if content script is running
        chrome.tabs.sendMessage(
          activeTab.id,
          {action: 'checkModelStatus'},
          function(response) {
            if (chrome.runtime.lastError) {
              console.log('Content script may not be injected:', chrome.runtime.lastError.message);
              statusElement.textContent = 'Extension not ready. Please refresh the page.';
              statusElement.className = 'status error';
              
              // Disable buttons
              scanPageButton.disabled = true;
              analyzeSelectedButton.disabled = true;
              return;
            }
            
            // Check model status
            if (response && response.loaded) {
              statusElement.textContent = 'Model loaded. Ready to detect deepfakes.';
              statusElement.className = 'status success';
              
              // Enable buttons
              scanPageButton.disabled = false;
              analyzeSelectedButton.disabled = false;
            } else {
              statusElement.textContent = 'Loading model, please wait...';
              statusElement.className = 'status warning';
              
              // Disable buttons until model is loaded
              scanPageButton.disabled = true;
              analyzeSelectedButton.disabled = true;
              
              // Check again in a few seconds
              setTimeout(checkContentScriptStatus, 2000);
            }
          }
        );
      });
    }
    
    // Function to display scan results
    function displayResults(results) {
      // Clear previous results
      resultsElement.innerHTML = '';
      
      if (!results || results.length === 0) {
        resultsElement.innerHTML = '<p class="no-results">No suitable images found to analyze.</p>';
        return;
      }
      
      // Create results list
      const resultsList = document.createElement('ul');
      resultsList.className = 'results-list';
      
      // Add each result to the list
      results.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'result-item';
        
        // Format the confidence text and color
        const confidenceColor = item.result.isFake ? '#ff3b30' : '#34c759';
        const verdict = item.result.isFake ? 'FAKE' : 'REAL';
        
        // Create result HTML
        listItem.innerHTML = `
          <div class="result-image-container">
            <img src="${item.imageUrl}" alt="Image ${index + 1}" class="result-image">
          </div>
          <div class="result-details">
            <div class="result-verdict" style="color: ${confidenceColor};">${verdict}</div>
            <div class="result-confidence">
              Confidence: <strong>${item.result.confidence}%</strong>
            </div>
          </div>
        `;
        
        // Add hover effect to highlight the corresponding image on the page
        listItem.addEventListener('mouseover', () => {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab) {
              chrome.tabs.sendMessage(activeTab.id, {
                action: 'highlightImage',
                index: index
              }).catch(err => console.log('Highlight error:', err));
            }
          });
        });
        
        listItem.addEventListener('mouseout', () => {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab) {
              chrome.tabs.sendMessage(activeTab.id, {
                action: 'unhighlightImage',
                index: index
              }).catch(err => console.log('Unhighlight error:', err));
            }
          });
        });
        
        resultsList.appendChild(listItem);
      });
      
      resultsElement.appendChild(resultsList);
    }
  });