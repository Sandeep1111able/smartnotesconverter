/**
 * Smart Notes Converter - Main JavaScript File
 * 
 * This application allows users to:
 * 1. Upload notes (images, PDFs, text) and extract text using OCR.Space API
 * 2. Generate structured summaries using OpenAI GPT-4
 * 3. Create interactive quizzes with multiple choice questions
 * 
 * SETUP INSTRUCTIONS:
 * 1. Replace the placeholder API keys with your actual keys:
 *    - OCR_SPACE_API_KEY: Get from https://ocr.space/ocrapi
 *    - OPENAI_API_KEY: Get from https://platform.openai.com/api-keys
 * 2. For local development, create a .env file in the root directory:
 *    OCR_SPACE_API_KEY=your_ocr_space_key_here
 *    OPENAI_API_KEY=your_openai_key_here
 * 3. Run the application using: python -m http.server 8000
 * 4. Open http://localhost:8000 in your browser
 */

// API Configuration
const API_CONFIG = {
    OCR_SPACE_URL: '/api/ocr',
    OPENAI_URL: '/api/openai'
};

// Application State
let currentFile = null;
let extractedText = '';
let quizData = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let quizCompleted = false;

// DOM Elements
const elements = {
    uploadArea: null,
    fileInput: null,
    extractBtn: null,
    textSection: null,
    extractedText: null,
    summarizeBtn: null,
    quizBtn: null,
    summarySection: null,
    summaryContent: null,
    downloadPdfBtn: null,
    loadingOverlay: null,
    loadingText: null,
    quizModal: null,
    closeQuizModal: null,
    progressText: null,
    currentQuestion: null,
    totalQuestions: null,
    questionText: null,
    optionsContainer: null,
    prevBtn: null,
    nextBtn: null,
    quizResults: null,
    finalScore: null,
    scorePercentage: null,
    resultsSummary: null,
    retryQuizBtn: null
};

/**
 * Initialize the application
 */
function init() {
    initializeElements();
    setupEventListeners();
    console.log('Smart Notes Converter initialized successfully');
}

/**
 * Initialize DOM elements
 */
function initializeElements() {
    elements.uploadArea = document.getElementById('uploadArea');
    elements.fileInput = document.getElementById('fileInput');
    elements.extractBtn = document.getElementById('extractBtn');
    elements.textSection = document.getElementById('textSection');
    elements.extractedText = document.getElementById('extractedText');
    elements.summarizeBtn = document.getElementById('summarizeBtn');
    elements.quizBtn = document.getElementById('quizBtn');
    elements.summarySection = document.getElementById('summarySection');
    elements.summaryContent = document.getElementById('summaryContent');
    elements.downloadPdfBtn = document.getElementById('downloadPdfBtn');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.loadingText = document.getElementById('loadingText');
    elements.quizModal = document.getElementById('quizModal');
    elements.closeQuizModal = document.getElementById('closeQuizModal');
    elements.progressText = document.getElementById('progressText');
    elements.currentQuestion = document.getElementById('currentQuestion');
    elements.totalQuestions = document.getElementById('totalQuestions');
    elements.questionText = document.getElementById('questionText');
    elements.optionsContainer = document.getElementById('optionsContainer');
    elements.prevBtn = document.getElementById('prevBtn');
    elements.nextBtn = document.getElementById('nextBtn');
    elements.quizResults = document.getElementById('quizResults');
    elements.finalScore = document.getElementById('finalScore');
    elements.scorePercentage = document.getElementById('scorePercentage');
    elements.resultsSummary = document.getElementById('resultsSummary');
    elements.retryQuizBtn = document.getElementById('retryQuizBtn');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // File upload events
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleFileDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Button events
    elements.extractBtn.addEventListener('click', extractTextFromFile);
    elements.summarizeBtn.addEventListener('click', generateSummary);
    elements.quizBtn.addEventListener('click', generateQuiz);
    elements.downloadPdfBtn.addEventListener('click', downloadSummaryAsPDF);

    // Quiz modal events
    elements.closeQuizModal.addEventListener('click', closeQuizModal);
    elements.prevBtn.addEventListener('click', showPreviousQuestion);
    elements.nextBtn.addEventListener('click', showNextQuestion);
    elements.retryQuizBtn.addEventListener('click', retryQuiz);

    // Close modal when clicking outside
    elements.quizModal.addEventListener('click', (e) => {
        if (e.target === elements.quizModal) {
            closeQuizModal();
        }
    });
}

/**
 * Handle drag over event
 */
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

/**
 * Handle drag leave event
 */
function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

/**
 * Handle file drop event
 */
function handleFileDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

/**
 * Handle file select event
 */
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

/**
 * Handle file selection
 */
function handleFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'text/plain'];
    
    if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid file type: JPG, PNG, PDF, or TXT');
        return;
    }

    currentFile = file;
    elements.extractBtn.disabled = false;
    
    // Show file name in upload area
    const uploadContent = elements.uploadArea.querySelector('.upload-content');
    uploadContent.innerHTML = `
        <i class="fas fa-file-check"></i>
        <h3>${file.name}</h3>
        <p>File selected successfully</p>
        <p class="file-types">Click "Extract Text" to continue</p>
    `;
}

/**
 * Extract text from uploaded file using backend OCR endpoint
 */
async function extractTextFromFile() {
    if (!currentFile) {
        showError('Please select a file first');
        return;
    }

    // Reset the generated summary when extracting text
    elements.summarySection.style.display = 'none';
    elements.summaryContent.innerHTML = '';

    showLoading('Extracting text from file...');

    try {
        let extractedText = '';

        if (currentFile.type === 'text/plain') {
            // Handle text files directly
            extractedText = await readTextFile(currentFile);
        } else {
            // Handle images and PDFs with OCR via backend
            extractedText = await performOCR(currentFile);
        }

        if (!extractedText.trim()) {
            throw new Error('No text could be extracted from the file');
        }

        // Display extracted text
        elements.extractedText.value = extractedText;
        elements.textSection.style.display = 'block';
        elements.extractedText.scrollIntoView({ behavior: 'smooth' });

        hideLoading();
        showSuccess('Text extracted successfully!');

    } catch (error) {
        hideLoading();
        showError(`Failed to extract text: ${error.message}`);
        console.error('OCR Error:', error);
    }
}

/**
 * Read text file content
 */
function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
}

/**
 * Convert file to base64 (for OCR upload)
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Perform OCR on image or PDF file using backend
 */
async function performOCR(file) {
    const fileBase64 = await fileToBase64(file);
    const response = await fetch(API_CONFIG.OCR_SPACE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 })
    });

    if (!response.ok) {
        throw new Error(`OCR API request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.IsErroredOnProcessing) {
        throw new Error((data.ErrorMessage && data.ErrorMessage[0]) || 'OCR processing failed');
    }

    if (data.ParsedResults && data.ParsedResults[0]) {
        const extractedText = data.ParsedResults[0].ParsedText;
        return extractedText || 'No text found.';
    }
    throw new Error('No text found in OCR response.');
}

/**
 * Generate summary using OpenAI API
 */
async function generateSummary() {
    const text = elements.extractedText.value.trim();
    if (!text) {
        showError('Please extract text first');
        return;
    }

    // Collect user preferences
    const summaryStyle = document.getElementById('summaryStyle').value;
    const summaryLength = document.getElementById('summaryLength').value;
    const summaryIntent = document.getElementById('summaryIntent').value;
    const summaryLanguage = document.getElementById('summaryLanguage').value;

    // Build the prompt template with explicit style instructions
    let styleInstruction = '';
    switch (summaryStyle) {
        case 'Bullet Points':
            styleInstruction = 'Format the summary as clear bullet points.';
            break;
        case 'Descriptive':
            styleInstruction = 'Write the summary in a descriptive paragraph style.';
            break;
        case 'Objective':
            styleInstruction = 'Write the summary in an objective, factual tone.';
            break;
        case 'Narrative':
            styleInstruction = 'Write the summary as a narrative, telling a story.';
            break;
        case 'Q&A':
            styleInstruction = 'Format the summary as a series of questions and answers.';
            break;
        default:
            styleInstruction = '';
    }

    const prompt = `You are an intelligent assistant that summarizes notes into clear and useful formats.\n\nUser preferences:\n- Summary Style: ${summaryStyle}\n- Summary Length: ${summaryLength}\n- Summary Intent: ${summaryIntent}\n- Language: ${summaryLanguage}\n\n${styleInstruction}\n\nBased on these preferences, summarize the following content accordingly.\n\n=== START OF USER NOTES ===\n${text}\n=== END OF USER NOTES ===\n\nGenerate only the summary. Do not explain what you're doing. Use formatting where appropriate (e.g., headers, bullets, paragraphs).`;

    showLoading('Generating summary...');

    try {
        const summary = await callOpenAI({
            prompt: prompt,
            maxTokens: 500
        });

        // Display summary
        elements.summaryContent.innerHTML = formatSummary(summary, summaryStyle);
        elements.summarySection.style.display = 'block';
        elements.summarySection.scrollIntoView({ behavior: 'smooth' });

        hideLoading();
        showSuccess('Summary generated successfully!');

    } catch (error) {
        hideLoading();
        showError(`Failed to generate summary: ${error.message}`);
        console.error('Summary Error:', error);
    }
}

/**
 * Generate quiz using OpenAI API
 */
async function generateQuiz() {
    const text = elements.extractedText.value.trim();
    if (!text) {
        showError('Please extract text first');
        return;
    }

    // Determine number of questions based on content length
    const textLength = text.length;
    let questionCount = 3; // Minimum 3 questions
    
    if (textLength >= 8000) {
        questionCount = 8;
    } else if (textLength >= 6000) {
        questionCount = 7;
    } else if (textLength >= 4000) {
        questionCount = 6;
    } else if (textLength >= 3000) {
        questionCount = 5;
    } else if (textLength >= 1500) {
        questionCount = 4;
    }
    // For shorter text, keep 3 questions as minimum

    showLoading(`Creating ${questionCount}-question interactive quiz...`);

    try {
        const quizPrompt = `Create a ${questionCount}-question multiple choice quiz based on the following text. Each question should have 4 options (A, B, C, D) with only one correct answer. Include explanations for each correct answer. Make sure questions cover different aspects of the content. Format as JSON:

{
  "questions": [
    {
      "question": "Question text here?",
      "options": {
        "A": "Option A",
        "B": "Option B", 
        "C": "Option C",
        "D": "Option D"
      },
      "correct": "B",
      "explanation": "Explanation for why B is correct"
    }
  ]
}

Text to create quiz from:
${text}`;

        const quizResponse = await callOpenAI({
            prompt: quizPrompt,
            maxTokens: questionCount * 200 + 400 // Adjust tokens based on question count
        });

        // Parse quiz data
        quizData = parseQuizData(quizResponse);
        
        if (!quizData || !quizData.questions || quizData.questions.length === 0) {
            throw new Error('Failed to generate valid quiz data');
        }

        // Initialize quiz
        initializeQuiz();
        openQuizModal();

        hideLoading();
        showSuccess(`Quiz created successfully with ${quizData.questions.length} questions!`);

    } catch (error) {
        hideLoading();
        showError(`Failed to create quiz: ${error.message}`);
        console.error('Quiz Error:', error);
    }
}

/**
 * Call OpenAI API via backend
 */
async function callOpenAI({ prompt, maxTokens = 500 }) {
    const response = await fetch(API_CONFIG.OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

/**
 * Parse quiz data from OpenAI response
 */
function parseQuizData(response) {
    try {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        // Fallback: try to parse the entire response
        return JSON.parse(response);
    } catch (error) {
        console.error('Failed to parse quiz data:', error);
        throw new Error('Invalid quiz data format received from AI');
    }
}

/**
 * Initialize quiz state
 */
function initializeQuiz() {
    currentQuestionIndex = 0;
    userAnswers = new Array(quizData.questions.length).fill(null);
    quizCompleted = false;
    
    elements.totalQuestions.textContent = quizData.questions.length;
    showQuestion(0);
    updateProgress();
}

/**
 * Open quiz modal
 */
function openQuizModal() {
    elements.quizModal.style.display = 'flex';
    elements.quizResults.style.display = 'none';
    document.body.style.overflow = 'hidden';
}

/**
 * Close quiz modal
 */
function closeQuizModal() {
    elements.quizModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

/**
 * Show question at specified index
 */
function showQuestion(index) {
    if (index < 0 || index >= quizData.questions.length) return;

    const question = quizData.questions[index];
    currentQuestionIndex = index;

    // Update question text
    elements.questionText.textContent = question.question;
    elements.currentQuestion.textContent = index + 1;

    // Create options
    elements.optionsContainer.innerHTML = '';
    Object.entries(question.options).forEach(([key, value]) => {
        const option = document.createElement('div');
        option.className = 'option';
        option.textContent = `${key}. ${value}`;
        
        // Check if user has already answered this question
        if (userAnswers[index] !== null) {
            option.classList.add('disabled');
            if (userAnswers[index] === key) {
                option.classList.add('selected');
            }
            if (key === question.correct) {
                option.classList.add('correct');
            } else if (userAnswers[index] === key && key !== question.correct) {
                option.classList.add('incorrect');
            }
        } else {
            option.addEventListener('click', () => selectAnswer(key));
        }
        
        elements.optionsContainer.appendChild(option);
    });

    // Update navigation buttons
    elements.prevBtn.disabled = index === 0;
    elements.nextBtn.disabled = index === quizData.questions.length - 1;
    
    updateProgress();
}

/**
 * Select answer for current question
 */
function selectAnswer(answer) {
    if (userAnswers[currentQuestionIndex] !== null) return;

    userAnswers[currentQuestionIndex] = answer;
    
    // Update option styling
    const options = elements.optionsContainer.querySelectorAll('.option');
    const question = quizData.questions[currentQuestionIndex];
    
    options.forEach(option => {
        option.classList.add('disabled');
        option.removeEventListener('click', option.onclick);
        
        const optionKey = option.textContent.split('.')[0];
        
        if (optionKey === answer) {
            option.classList.add('selected');
        }
        
        if (optionKey === question.correct) {
            option.classList.add('correct');
        } else if (optionKey === answer && answer !== question.correct) {
            option.classList.add('incorrect');
        }
    });

    // Enable next button if not on last question
    if (currentQuestionIndex < quizData.questions.length - 1) {
        elements.nextBtn.disabled = false;
    } else {
        // Show results if this is the last question
        setTimeout(() => {
            showQuizResults();
        }, 1000);
    }
}

/**
 * Show previous question
 */
function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        showQuestion(currentQuestionIndex - 1);
    }
}

/**
 * Show next question
 */
function showNextQuestion() {
    if (currentQuestionIndex < quizData.questions.length - 1) {
        showQuestion(currentQuestionIndex + 1);
    }
}

/**
 * Update circular progress indicator
 */
function updateProgress() {
    const answeredCount = userAnswers.filter(answer => answer !== null).length;
    const totalQuestions = quizData.questions.length;
    // const percentage = (answeredCount / totalQuestions) * 100;
    
    // Update circular progress (removed)
    // if (elements.progressCircle) {
    //     elements.progressCircle.style.background = `conic-gradient(#667eea 0deg, #667eea ${percentage * 3.6}deg, #e1e5e9 ${percentage * 3.6}deg)`;
    // }
    if (elements.progressText) {
        elements.progressText.textContent = `${answeredCount}/${totalQuestions}`;
    }
}

/**
 * Show quiz results
 */
function showQuizResults() {
    const totalQuestions = quizData.questions.length;
    const correctAnswers = userAnswers.filter((answer, index) => 
        answer === quizData.questions[index].correct
    ).length;
    
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    // Update score display
    elements.finalScore.textContent = `${correctAnswers}/${totalQuestions}`;
    elements.scorePercentage.textContent = `${percentage}%`;
    
    // Generate results summary
    const resultsHTML = generateResultsSummary(correctAnswers, totalQuestions);
    elements.resultsSummary.innerHTML = resultsHTML;
    
    // Show results section
    elements.quizResults.style.display = 'block';
    quizCompleted = true;
}

/**
 * Generate results summary HTML
 */
function generateResultsSummary(correct, total) {
    const percentage = Math.round((correct / total) * 100);
    let performance = '';
    let color = '';
    
    if (percentage >= 80) {
        performance = 'Excellent!';
        color = '#28a745';
    } else if (percentage >= 60) {
        performance = 'Good job!';
        color = '#ffc107';
    } else if (percentage >= 40) {
        performance = 'Not bad!';
        color = '#fd7e14';
    } else {
        performance = 'Keep practicing!';
        color = '#dc3545';
    }
    
    return `
        <h4 style="color: ${color}">${performance}</h4>
        <p>You answered <strong>${correct} out of ${total}</strong> questions correctly.</p>
        <p>Score: <strong>${percentage}%</strong></p>
        <p>${percentage >= 60 ? 'Great work! You have a good understanding of the material.' : 'Consider reviewing the material to improve your understanding.'}</p>
    `;
}

/**
 * Retry quiz
 */
function retryQuiz() {
    initializeQuiz();
    elements.quizResults.style.display = 'none';
}

/**
 * Format summary for display
 */
function formatSummary(summary, summaryStyle = 'Bullet Points') {
    if (summaryStyle === 'Bullet Points') {
        // Convert markdown-style lists to HTML
        const formattedSummary = summary
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
                    return `<li>${line.substring(1).trim()}</li>`;
                }
                return `<li>${line.trim()}</li>`;
            })
            .join('');
        return `<ul>${formattedSummary}</ul>`;
    } else {
        // For other styles, return as a paragraph or as-is
        // Optionally, you could add more formatting for Q&A, Narrative, etc.
        return `<div style="white-space: pre-line;">${summary}</div>`;
    }
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Processing...') {
    elements.loadingText.textContent = message;
    elements.loadingOverlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Simple success notification - could be enhanced with a toast library
    console.log('Success:', message);
}

/**
 * Show error message
 */
function showError(message) {
    // Simple error notification - could be enhanced with a toast library
    alert(`Error: ${message}`);
}

/**
 * Download summary as PDF
 */
function downloadSummaryAsPDF() {
    const summaryContent = elements.summaryContent.innerHTML;
    const originalText = elements.extractedText.value;
    
    if (!summaryContent.trim()) {
        showError('No summary available to download');
        return;
    }

    try {
        // Create new jsPDF instance
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set font and size
        doc.setFont('helvetica');
        doc.setFontSize(16);
        
        // Add title
        doc.setFillColor(102, 126, 234);
        doc.rect(20, 20, 170, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Smart Notes Converter - Report', 25, 27);
        
        // Reset text color
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        
        // Add timestamp
        const now = new Date();
        const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        doc.text(`Generated on: ${timestamp}`, 25, 40);
        
        // Add original text length info
        doc.text(`Original text length: ${originalText.length} characters`, 25, 50);
        
        // SECTION 1: EXTRACTED TEXT
        doc.setFontSize(14);
        doc.setFillColor(240, 240, 240);
        doc.rect(20, 65, 170, 8, 'F');
        doc.setTextColor(102, 126, 234);
        doc.text('EXTRACTED TEXT', 25, 72);
        
        // Reset text color
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        
        // Add extracted text content
        let yPosition = 85;
        const lineHeight = 6;
        const maxWidth = 160;
        const pageHeight = 280;
        
        // Split original text into lines
        const originalLines = originalText.split('\n').filter(line => line.trim());
        
        originalLines.forEach(line => {
            // Check if we need a new page
            if (yPosition > pageHeight) {
                doc.addPage();
                yPosition = 20;
            }
            
            // Split long lines
            const words = line.split(' ');
            let currentLine = '';
            
            words.forEach(word => {
                const testLine = currentLine + word + ' ';
                const textWidth = doc.getTextWidth(testLine);
                
                if (textWidth > maxWidth && currentLine !== '') {
                    doc.text(currentLine.trim(), 25, yPosition);
                    yPosition += lineHeight;
                    currentLine = word + ' ';
                    
                    // Check if we need a new page
                    if (yPosition > pageHeight) {
                        doc.addPage();
                        yPosition = 20;
                    }
                } else {
                    currentLine = testLine;
                }
            });
            
            if (currentLine.trim()) {
                doc.text(currentLine.trim(), 25, yPosition);
                yPosition += lineHeight;
            }
        });
        
        // Add some space before summary section
        yPosition += 15;
        
        // Check if we need a new page for summary section
        if (yPosition > pageHeight - 50) {
            doc.addPage();
            yPosition = 20;
        }
        
        // SECTION 2: GENERATED SUMMARY
        doc.setFontSize(14);
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPosition, 170, 8, 'F');
        doc.setTextColor(102, 126, 234);
        doc.text('GENERATED SUMMARY', 25, yPosition + 7);
        
        // Reset text color
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        
        yPosition += 20;
        
        // Extract text from summary HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = summaryContent;
        const summaryText = tempDiv.textContent || tempDiv.innerText || '';
        
        // Split summary into lines
        const summaryLines = summaryText.split('\n').filter(line => line.trim());
        
        summaryLines.forEach(line => {
            // Check if we need a new page
            if (yPosition > pageHeight) {
                doc.addPage();
                yPosition = 20;
            }
            
            // Split long lines
            const words = line.split(' ');
            let currentLine = '';
            
            words.forEach(word => {
                const testLine = currentLine + word + ' ';
                const textWidth = doc.getTextWidth(testLine);
                
                if (textWidth > maxWidth && currentLine !== '') {
                    doc.text(currentLine.trim(), 25, yPosition);
                    yPosition += lineHeight;
                    currentLine = word + ' ';
                    
                    // Check if we need a new page
                    if (yPosition > pageHeight) {
                        doc.addPage();
                        yPosition = 20;
                    }
                } else {
                    currentLine = testLine;
                }
            });
            
            if (currentLine.trim()) {
                doc.text(currentLine.trim(), 25, yPosition);
                yPosition += lineHeight;
            }
        });
        
        // Generate filename
        const filename = `smart_notes_report_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.pdf`;
        
        // Save the PDF
        doc.save(filename);
        
        showSuccess('PDF report downloaded successfully!');
        
    } catch (error) {
        console.error('PDF generation error:', error);
        showError('Failed to generate PDF. Please try again.');
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 