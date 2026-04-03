const axios = require('axios');
const cheerio = require('cheerio');

// SkillPay Billing Integration
const BILLING_URL = 'https://skillpay.me/api/v1/billing';
const API_KEY = process.env.SKILLPAY_API_KEY;
const SKILL_ID = 'url-content-summarizer-001';
const PRICE_PER_CALL = 0.05;

// Charge user
async function chargeUser(userId) {
  if (!userId) return { ok: true };
  
  try {
    const { data } = await axios.post(BILLING_URL + '/charge', {
      user_id: userId,
      skill_id: SKILL_ID,
      amount: PRICE_PER_CALL,
    }, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (data.success) {
      return { ok: true, balance: data.balance };
    }
    return { ok: false, balance: data.balance, payment_url: data.payment_url };
  } catch (error) {
    console.error('Billing error:', error.message);
    return { ok: false, error: error.message };
  }
}

// Fetch and parse webpage
async function fetchContent(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; URLSummarizer/1.0; Vercel)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: 15000,
    maxRedirects: 5,
    httpsAgent: new (require('https').Agent)({
      rejectUnauthorized: false
    })
  });
  
  return response.data;
}

// Extract text content from HTML
function extractContent(html, url) {
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, nav, footer, header, aside, form, iframe, noscript').remove();
  
  // Try to find main content
  let content = '';
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.content',
    '#content',
    '.post',
    '.article',
    'body'
  ];
  
  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 200) {
      content = el.text().trim();
      break;
    }
  }
  
  if (!content) {
    content = $('body').text().trim();
  }
  
  // Clean up whitespace
  content = content.replace(/\s+/g, ' ').trim();
  
  // Extract title
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                'Untitled';
  
  // Extract meta description
  const description = $('meta[name="description"]').attr('content') || '';
  
  // Extract images count
  const imagesCount = $('img').length;
  
  // Extract links count
  const linksCount = $('a').length;
  
  return {
    title,
    description,
    content,
    imagesCount,
    linksCount,
    url
  };
}

// Calculate reading time (avg 200 words per minute)
function calculateReadingTime(text) {
  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return {
    words,
    minutes,
    text: minutes <= 1 ? '1 min read' : `${minutes} min read`
  };
}

// Extract keywords using TF-IDF-like approach
function extractKeywords(text, count = 10) {
  // Common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'as', 'if', 'then', 'than', 'so',
    'such', 'no', 'not', 'only', 'own', 'same', 'too', 'very', 'just',
    'also', 'now', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'any',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'once', 'about', 'what', 'which',
    'who', 'whom', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
    'he', 'him', 'his', 'she', 'her', 'i', 'me', 'my'
  ]);
  
  // Tokenize and count
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // Sort by frequency
  const sorted = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
  
  return sorted.map(([word, count]) => ({ word, count }));
}

// Generate summary
function generateSummary(content, sentenceCount = 3) {
  // Split into sentences
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  
  if (sentences.length <= sentenceCount) {
    return sentences.join(' ').trim();
  }
  
  // Score sentences by keyword density
  const keywords = extractKeywords(content, 20);
  const keywordSet = new Set(keywords.map(k => k.word));
  
  const scoredSentences = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase().split(/\s+/);
    let score = 0;
    words.forEach(word => {
      if (keywordSet.has(word.replace(/[^a-z0-9]/g, ''))) {
        score += 2;
      }
    });
    // Boost early sentences
    score += Math.max(0, 5 - index) * 0.5;
    return { sentence: sentence.trim(), score, index };
  });
  
  // Get top sentences
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => a.index - b.index);
  
  return topSentences.map(s => s.sentence).join(' ').trim();
}

// Main API handler
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { url, userId, demo = 'false', summaryLength = 'medium' } = req.query;
    
    // Validate URL
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }
    
    // Validate URL format
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }
    
    // Billing (skip for demo mode)
    if (demo !== 'true' && userId) {
      const charge = await chargeUser(userId);
      if (!charge.ok) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient balance',
          balance: charge.balance,
          paymentUrl: charge.payment_url,
          message: 'Please top up your balance to use this skill'
        });
      }
    }
    
    // Fetch and parse content
    const html = await fetchContent(url);
    const extracted = extractContent(html, url);
    
    if (!extracted.content || extracted.content.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract sufficient content from the URL'
      });
    }
    
    // Analyze content
    const readingTime = calculateReadingTime(extracted.content);
    const keywords = extractKeywords(extracted.content, 10);
    
    // Generate summary based on length preference
    const sentenceCount = summaryLength === 'short' ? 2 : 
                          summaryLength === 'long' ? 5 : 3;
    const summary = generateSummary(extracted.content, sentenceCount);
    
    // Response
    res.json({
      success: true,
      url: url,
      timestamp: Date.now(),
      title: extracted.title,
      metaDescription: extracted.description,
      summary,
      keywords,
      readingTime,
      stats: {
        wordCount: readingTime.words,
        imagesCount: extracted.imagesCount,
        linksCount: extracted.linksCount
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    
    if (error.code === 'ENOTFOUND') {
      return res.status(400).json({
        success: false,
        error: 'URL not found or unreachable'
      });
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        error: 'Request timeout'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
