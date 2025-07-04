// To use ESM imports, add "type": "module" to your package.json
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';
import vision from '@google-cloud/vision';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('public'));

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

  // Fallback: Try OCR.Space
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

// Proxy endpoint for OpenAI
app.post('/api/openai', async (req, res) => {
    try {
        const { prompt, maxTokens } = req.body;
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
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 