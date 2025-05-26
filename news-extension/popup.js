// Add these constants at the top of your file
const TRUSTED_NEWS_DOMAINS = [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'bbc.co.uk',
    'nytimes.com',
    'theguardian.com',
    'bloomberg.com',
    'wsj.com',
    'cnbc.com',
    'ndtv.com',
    'indianexpress.com',
    'thehindu.com'
];

// Add this new function for news verification
async function verifyWithNewsSources(title, text) {
    try {
        // Clean and prepare the search query
        const searchQuery = encodeURIComponent(title.substring(0, 100));
        const timestamp = new Date().getTime();
        
        // Search across multiple news sources
        const searchUrls = [
            `https://news.google.com/search?q=${searchQuery}&hl=en-US&gl=US&ceid=US:en`,
            `https://www.bing.com/news/search?q=${searchQuery}`,
            `https://news.search.yahoo.com/search?p=${searchQuery}`
        ];

        // Fetch and analyze search results
        const results = await Promise.all(searchUrls.map(async url => {
            try {
                const response = await fetch(url);
                const html = await response.text();
                return analyzeNewsResults(html);
            } catch (error) {
                console.error('Error fetching news:', error);
                return null;
            }
        }));

        return processNewsVerification(results);
    } catch (error) {
        console.error('News verification error:', error);
        return {
            verified: false,
            matches: 0,
            trustedSources: []
        };
    }
}

// Add these helper functions
function analyzeNewsResults(html) {
    const matches = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract news article links
    const links = doc.querySelectorAll('a');
    links.forEach(link => {
        const href = link.href;
        if (TRUSTED_NEWS_DOMAINS.some(domain => href.includes(domain))) {
            matches.push({
                url: href,
                source: TRUSTED_NEWS_DOMAINS.find(domain => href.includes(domain)),
                title: link.textContent
            });
        }
    });

    return matches;
}

function processNewsVerification(results) {
    const allMatches = results.flat().filter(Boolean);
    const uniqueSources = new Set(allMatches.map(m => m.source));

    return {
        verified: uniqueSources.size >= 2,
        matches: allMatches.length,
        trustedSources: Array.from(uniqueSources)
    };
}

document.addEventListener('DOMContentLoaded', function() {
    const statusDiv = document.getElementById('status');
    const resultDiv = document.getElementById('result');
    const statsDiv = document.getElementById('stats');
    const loadingBar = document.getElementById('loading-bar');

    async function analyzeContent() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({
                    text: document.body.innerText,
                    title: document.title,
                    links: Array.from(document.links).map(link => link.href),
                    metadata: {
                        author: document.querySelector('meta[name="author"]')?.content,
                        date: document.querySelector('meta[name="date"]')?.content,
                        description: document.querySelector('meta[name="description"]')?.content
                    }
                })
            });

            if (!results || !results[0].result) {
                throw new Error('Could not analyze page content');
            }

            const pageData = results[0].result;
            const analysis = await analyzeText(pageData);
            
            displayResults(analysis, pageData);
            loadingBar.style.display = 'none';

        } catch (error) {
            console.error('Analysis error:', error);
            statusDiv.textContent = `Error: ${error.message}`;
            loadingBar.style.display = 'none';
        }
    }

    async function analyzeText(pageData) {
        const text = pageData.text;
        const title = pageData.title;

        // Enhanced credibility indicators for legitimate news
        const credibilityIndicators = {
            // Very high credibility (official sources)
            'arrested': 5,
            'authorities': 5,
            'officials': 5,
            'police': 5,
            'ministry': 5,
            'government': 5,
            'court': 5,
            'investigation': 5,
            
            // High credibility (attribution)
            'according to': 4,
            'sources confirm': 4,
            'official statement': 4,
            'spokesperson said': 4,
            'confirmed by': 4,
            
            // Medium credibility (reporting)
            'reported': 3,
            'announced': 3,
            'statement': 3,
            'press release': 3
        };

        // Risk indicators with refined weights
        const riskIndicators = {
            'you won\'t believe': 5,
            'shocking truth': 5,
            'they don\'t want you to know': 5,
            'conspiracy': 4,
            'miracle cure': 4,
            'secret they\'re hiding': 4,
            'click here': 2,  // Reduced weight
            'share before': 2 // Reduced weight
        };

        let credibilityScore = 0;
        let fakeScore = 0;
        let structureScore = 0;
        let sourceScore = 0;

        // Enhanced text structure analysis
        const paragraphs = text.split('\n\n');
        const avgParagraphLength = text.length / paragraphs.length;
        structureScore = Math.min(100, 
            (paragraphs.length / 3) * 30 +  // Number of paragraphs
            (avgParagraphLength / 100) * 40 + // Average paragraph length
            (text.length > 1000 ? 30 : text.length / 33.33) // Article length
        );

        // Check for credibility indicators with context
        Object.entries(credibilityIndicators).forEach(([phrase, weight]) => {
            const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
            const matches = (text.match(regex) || []).length;
            credibilityScore += matches * weight * 1.5; // Increased multiplier
        });

        // Check for risk indicators
        Object.entries(riskIndicators).forEach(([phrase, weight]) => {
            const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
            const matches = (text.match(regex) || []).length;
            fakeScore += matches * weight;
        });

        // Enhanced source reliability checks
        const hasLinks = pageData.links.length > 0;
        const hasAuthor = pageData.metadata.author;
        const hasDate = pageData.metadata.date;
        const hasQuotes = (text.match(/["'"'].*?["'"']/g) || []).length > 0;
        sourceScore = (hasLinks ? 25 : 0) + 
                     (hasAuthor ? 25 : 0) + 
                     (hasDate ? 25 : 0) + 
                     (hasQuotes ? 25 : 0);

        // Additional legitimate news indicators
        if (text.includes('LIVE') || text.includes('UPDATE') || text.includes('BREAKING')) {
            credibilityScore += 20;
        }
        if (/\d{1,2}:\d{2}/.test(text)) { // Has time stamps
            credibilityScore += 15;
        }
        if (/\([A-Z]+\)/.test(text)) { // Has news agency abbreviations
            credibilityScore += 25;
        }

        // Add news verification
        const newsVerification = await verifyWithNewsSources(title, text);
        
        // Adjust credibility score based on verification
        if (newsVerification.verified) {
            credibilityScore += newsVerification.matches * 10;
            sourceScore += Math.min(50, newsVerification.trustedSources.length * 15);
        }

        // Normalize scores with adjusted weights
        credibilityScore = Math.min(100, (credibilityScore / 30) * 100);
        fakeScore = Math.min(100, (fakeScore / 15) * 100);

        // Adjusted final prediction calculation
        const overallScore = (
            credibilityScore * 1.5 + // Increased weight for credibility
            structureScore * 1.0 +
            sourceScore * 1.2 - 
            fakeScore * 0.8  // Reduced weight for fake indicators
        ) / 3.7; // Normalized by total weights

        let prediction;
        let confidence;

        if (overallScore > 60) { // Lowered threshold for REAL
            prediction = 'REAL';
            confidence = overallScore;
        } else if (overallScore < 40) {
            prediction = 'FAKE';
            confidence = 100 - overallScore;
        } else {
            prediction = 'UNCERTAIN';
            confidence = Math.abs(50 - overallScore) * 2;
        }

        return {
            prediction,
            confidence: Math.round(confidence),
            details: {
                credibilityScore: Math.round(credibilityScore),
                fakeScore: Math.round(fakeScore),
                structureScore: Math.round(structureScore),
                sourceScore: Math.round(sourceScore),
                newsVerification: {
                    verified: newsVerification.verified,
                    matches: newsVerification.matches,
                    trustedSources: newsVerification.trustedSources
                }
            }
        };
    }

    function displayResults(analysis, pageData) {
        // Update main result
        resultDiv.className = `result ${analysis.prediction.toLowerCase()}`;
        resultDiv.innerHTML = `
            <h4 style="margin:0;font-size:18px">${analysis.prediction}</h4>
            <div style="font-size:14px;margin-top:5px">Confidence: ${analysis.confidence}%</div>
        `;

        // Update detailed stats
        statsDiv.innerHTML = `
            <div class="stat-card">
                <div>Credibility Score</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${analysis.details.credibilityScore}%; background: #00b09b"></div>
                </div>
            </div>
            <div class="stat-card">
                <div>Risk Score</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${analysis.details.fakeScore}%; background: #ff416c"></div>
                </div>
            </div>
            <div class="stat-card">
                <div>Content Structure</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${analysis.details.structureScore * 20}%; background: #4facfe"></div>
                </div>
            </div>
            <div class="stat-card">
                <div>Source Reliability</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${analysis.details.sourceScore * 20}%; background: #96c93d"></div>
                </div>
            </div>
        `;

        // Add verification results
        if (analysis.details.newsVerification.verified) {
            statsDiv.innerHTML += `
                <div class="stat-card verification-card">
                    <div>News Verification</div>
                    <div class="verified-sources">
                        <span class="verified-badge">✓ Verified</span>
                        <div class="source-list">
                            Found on ${analysis.details.newsVerification.matches} trusted sources:
                            ${analysis.details.newsVerification.trustedSources.map(source => 
                                `<span class="trusted-source">${source}</span>`
                            ).join(', ')}
                        </div>
                    </div>
                </div>
            `;
        }

        statusDiv.textContent = 'Analysis Complete';
    }

    // Start analysis
    analyzeContent();
});