// Content script to analyze news articles
function extractArticleText() {
    const selectors = [
        'article',
        '[role="article"]',
        '.article-content',
        '.story-content',
        'main'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element.innerText.trim();
        }
    }
    
    // Fallback to visible text in body
    return document.body.innerText.trim();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyze') {
        const text = extractArticleText();
        if (!text) {
            sendResponse({ error: 'No content found to analyze' });
            return;
        }
        
        chrome.runtime.sendMessage(
            { type: 'analyzeText', text: text },
            response => sendResponse(response)
        );
        return true; // Will respond asynchronously
    }
});
