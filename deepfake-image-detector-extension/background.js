// Simple service worker that communicates between content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Forward messages between popup and content script
    if (request.target === 'content' && sender.tab === undefined) {
      // Message from popup to content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            ...request,
            source: 'background'
          }, sendResponse);
          return true;
        }
      });
      return true;
    } else if (sender.tab) {
      // Message from content script
      if (request.target === 'popup') {
        // Store the result to be fetched by popup
        chrome.storage.local.set({
          'analysisResult': request.data
        });
      }
    }
  });