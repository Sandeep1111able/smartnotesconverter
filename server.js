// To use ESM imports, add "type": "module" to your package.json
// Required environment variables:
// - OCR_SPACE_API_KEY: For OCR.Space API
// - OPENAI_API_KEY: For OpenAI GPT-4 (primary AI service)
// - GEMINI_API_KEY: For Google Gemini (fallback AI service)
// - AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET: For Auth0 authentication
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';
import vision from '@google-cloud/vision';
import path from 'path';
import session from 'express-session';
import passport from 'passport';
import { Strategy as Auth0Strategy } from 'passport-auth0';
import fs from 'fs';
import { connectToDatabase, saveSummary, getUserSummaries, deleteContent, getContentById, updateSummary } from './database.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS properly for authentication
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://smartnotesconverter.azurewebsites.net', 'https://dev-hkokt28n7mmyf6e3.us.auth0.com']
    : ['http://localhost:5000', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('public'));

// --- Auth0 Config ---
const authConfig = {
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  callbackURL: process.env.AUTH0_CALLBACK_URL
};

// --- Session Middleware ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: true
  })
);

// --- Passport Auth0 Setup ---
passport.use(
  new Auth0Strategy(
    {
      domain: authConfig.domain,
      clientID: authConfig.clientID,
      clientSecret: authConfig.clientSecret,
      callbackURL: authConfig.callbackURL
    },
    function (accessToken, refreshToken, extraParams, profile, done) {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());

// --- Auth Routes ---

// Start login
app.get('/login', passport.authenticate('auth0', {
  scope: 'openid email profile'
}));

// Auth0 callback
app.get('/callback', passport.authenticate('auth0', {
  failureRedirect: '/'
}), (req, res) => {
  res.redirect('/');
});

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect(
      `https://${authConfig.domain}/v2/logout?client_id=${authConfig.clientID}&returnTo=${process.env.AUTH0_LOGOUT_URL}`
    );
  });
});

// Get current user info
app.get('/user', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// Check authentication status
app.get('/api/auth-status', (req, res) => {
  res.json({ 
    authenticated: req.isAuthenticated(),
    user: req.user || null 
  });
});

// --- Protect routes example ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  
  // For API requests, return JSON error instead of redirect
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // For web requests, redirect to login
  res.redirect('/login');
}

// Example of a protected route
app.get('/profile', ensureAuthenticated, (req, res) => {
  res.send(`Hello, ${req.user.displayName || req.user.id}!`);
});

// Write GOOGLE_CREDENTIALS env variable to file if present (for Azure compatibility)
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    fs.writeFileSync(
      'google-credentials.json',
      process.env.GOOGLE_CREDENTIALS,
      { encoding: 'utf8' }
    );
    console.log('Google credentials file written from environment variable.');
  } catch (err) {
    console.error('Failed to write Google credentials file:', err);
  }
}

// Initialize the Vision client with your credentials
const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(process.cwd(), 'google-credentials.json')
});

// Unified OCR endpoint: try Google Vision first, then OCR.Space, then handle error
app.post('/api/ocr', async (req, res) => {
  const { fileBase64 } = req.body;
  if (!fileBase64) return res.status(400).json({ error: 'No file provided' });

  // Try Google Vision OCR first
  try {
    // Remove the data URL prefix if present
    const base64Data = fileBase64.replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const [result] = await client.documentTextDetection({ image: { content: buffer } });
    const extractedText = result.fullTextAnnotation && result.fullTextAnnotation.text ? result.fullTextAnnotation.text : '';
    if (extractedText && extractedText.trim().length > 0) {
      return res.json({ ParsedResults: [{ ParsedText: extractedText }] });
    }
    // If no text found, fall through to OCR.Space
  } catch (visionError) {
    console.error('Google Vision OCR error:', visionError.message);
    // Continue to OCR.Space fallback
  }

  //Fallback: Try OCR.Space
  try {
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('base64Image', fileBase64);
    formData.append('apikey', process.env.OCR_SPACE_API_KEY);
    formData.append('OCREngine', 2);
    formData.append('language', 'eng');

    const fetchRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    const data = await fetchRes.json();
    if (data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ParsedText && data.ParsedResults[0].ParsedText.trim().length > 0) {
      return res.json(data);
    } else if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage ? data.ErrorMessage[0] : 'OCR.Space processing error');
    } else {
      throw new Error('No text found in OCR.Space response');
    }
  } catch (ocrSpaceError) {
    console.error('OCR.Space error:', ocrSpaceError.message);
    return res.status(500).json({ error: 'Failed to extract text using both Google Vision and OCR.Space.' });
  }
});

// Unified AI endpoint: try OpenAI first, then Gemini as fallback
app.post('/api/openai', async (req, res) => {
    const { prompt, maxTokens } = req.body;
    
    // Try OpenAI first
    try {
        console.log('Attempting OpenAI request...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that creates structured summaries and educational quizzes.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: maxTokens || 500,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if OpenAI returned an error in the response body
        if (data.error) {
            throw new Error(data.error.message || 'OpenAI API error');
        }
        
        console.log('OpenAI request successful');
        return res.json(data);
        
    } catch (openaiError) {
        console.error('OpenAI error:', openaiError.message);
        
        // Fallback to Gemini
        try {
            console.log('Attempting Gemini fallback...');
            
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('Gemini API key not configured');
            }
            
            const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a helpful assistant that creates structured summaries and educational quizzes. Please respond to the following request: ${prompt}`
                        }]
                    }],
                    generationConfig: {
                        maxOutputTokens: maxTokens || 500,
                        temperature: 0.7
                    }
                })
            });
            
            if (!geminiResponse.ok) {
                throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
            }
            
            const geminiData = await geminiResponse.json();
            
            // Check if Gemini returned an error
            if (geminiData.error) {
                throw new Error(geminiData.error.message || 'Gemini API error');
            }
            
            // Transform Gemini response to match OpenAI format
            const transformedResponse = {
                choices: [{
                    message: {
                        content: geminiData.candidates[0].content.parts[0].text
                    }
                }],
                model: 'gemini-pro',
                usage: {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                }
            };
            
            console.log('Gemini fallback successful');
            return res.json(transformedResponse);
            
        } catch (geminiError) {
            console.error('Gemini error:', geminiError.message);
            return res.status(500).json({ 
                error: `Both OpenAI and Gemini failed. OpenAI error: ${openaiError.message}. Gemini error: ${geminiError.message}` 
            });
        }
    }
});

// New endpoint for Google Vision OCR
app.post('/api/ocr-google', async (req, res) => {
  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'No file provided' });

    // Remove the data URL prefix if present
    const base64Data = fileBase64.replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const [result] = await client.textDetection({ image: { content: buffer } });
    const detections = result.textAnnotations;
    const extractedText = detections && detections.length > 0 ? detections[0].description : '';

    res.json({ ParsedResults: [{ ParsedText: extractedText }] });
  } catch (error) {
    console.error('Google Vision OCR error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Initialize database connection
connectToDatabase();

// --- Database Routes ---
app.post('/api/save-summary', ensureAuthenticated, async (req, res) => {
    try {
        const { title, content, originalText } = req.body;
        const userId = req.user.id;
        
        const summaryData = {
            user_id: userId,
            title: title || 'Untitled Summary',
            content: content,
            original_text: originalText,
            type: 'summary'
        };
        
        const savedSummary = await saveSummary(summaryData);
        res.json({ success: true, summary: savedSummary });
    } catch (error) {
        console.error('Error saving summary:', error);
        res.status(500).json({ error: 'Failed to save summary' });
    }
});

app.get('/api/user-summaries', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const summaries = await getUserSummaries(userId);
        // Explicitly convert ObjectId to string to be safe
        const summariesWithStringIds = summaries.map(summary => ({
            ...summary,
            _id: summary._id.toString()
        }));
        res.json({ summaries: summariesWithStringIds });
    } catch (error) {
        console.error('Error fetching summaries:', error);
        res.status(500).json({ error: 'Failed to fetch summaries' });
    }
});

// --- AI-Powered Q&A Endpoint ---
app.post('/api/ask-question', ensureAuthenticated, async (req, res) => {
  try {
    const { contentId, question } = req.body;
    if (!contentId || !question) {
      return res.status(400).json({ error: 'Missing contentId or question' });
    }

    const content = await getContentById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Construct prompt for the AI
    const prompt = `You are an expert assistant. Based on the following summary, answer the user question.\n\nSummary:\n${content.content}\n\nUser question: ${question}\n\nAnswer:`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.2
      })
    }).then(r => r.json());

    const answer = aiResponse.choices && aiResponse.choices[0] ? aiResponse.choices[0].message.content.trim() : 'No answer';

    res.json({ answer });
  } catch (error) {
    console.error('Q&A Error:', error);
    res.status(500).json({ error: 'Failed to get answer' });
  }
});

// --- Update Summary Endpoint ---
app.put('/api/update-summary/:contentId', ensureAuthenticated, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // First check if the content exists and belongs to the user
    const existingContent = await getContentById(contentId);
    if (!existingContent) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (existingContent.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this content' });
    }

    // Update the content in the database
    const updatedContent = await updateSummary(contentId, { title, content });
    
    res.json({ success: true, summary: updatedContent });
  } catch (error) {
    console.error('Error updating summary:', error);
    res.status(500).json({ error: 'Failed to update summary' });
  }
});

app.delete('/api/delete-content/:contentId', ensureAuthenticated, async (req, res) => {
    try {
        const { contentId } = req.params;
        console.log('Received delete request for ID:', contentId); // Added for debugging
        const userId = req.user.id;
        
        const deleted = await deleteContent(contentId, userId);
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Content not found or user not authorized' });
        }
    } catch (error) {
        console.error('Error deleting content:', error);
        res.status(500).json({ error: 'Failed to delete content' });
    }
});

app.get('/api/share/:contentId', async (req, res) => {
    try {
        const { contentId } = req.params;
        const content = await getContentById(contentId);
        if (content) {
            res.json(content);
        } else {
            res.status(404).json({ error: 'Content not found' });
        }
    } catch (error) {
        console.error('Error fetching shared content:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
 