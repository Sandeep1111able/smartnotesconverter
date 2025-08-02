# Smart Notes Converter 

Transform raw notes (images, PDFs, text) into polished summaries and quizzes powered by OCR, OpenAI & Auth0.

---

##  Key Features

| Category | Highlights |
| -------- | ---------- |
| Extraction | • OCR with **OCR.Space** / **Google Vision**  <br>• Supports JPG, PNG, PDF, TXT |
| AI Magic | • GPT-3.5 / GPT-4 summaries  <br>• Adjustable style, length, intent, language  <br>• **AI-powered Q&A** for saved summaries |
| Productivity | • Interactive editor (rich-text)  <br>• One-click PDF download  <br>• Saved dashboard with shareable links |
| Learning | • Auto-generated multiple-choice quizzes  <br>• Flash-card-friendly summaries |
| Auth & DB | • **Auth0** login  <br>• MongoDB Atlas persistence |

---

##  Tech Stack

* **Frontend**: Vanilla JS, HTML5, CSS3 
* **Backend**: Node.js + Express (ESM modules)
* **Database**: MongoDB Atlas via `mongodb` driver
* **AI**: OpenAI Chat Completion & Google Gemini (fallback)
* **OCR**: OCR.Space API & Google Vision API
* **Auth**: Auth0 (Passport strategy)
* **PDF**: jsPDF
* **Hosting**: Azure App Service (Linux)

---

##  Local Development

### 1. Clone & Install

```bash
# clone
git clone https://github.com/Sandeep1111able/smartnotesconverter.git
cd smartnotesconverter

# install deps
npm install
```

### 2. Environment Variables

Create a `.env` file at the project root:

```bash
PORT=5000
SESSION_SECRET=yourSessionSecret

# Auth0
AUTH0_DOMAIN=your-tenant.eu.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_CALLBACK_URL=http://localhost:5000/callback
AUTH0_LOGOUT_URL=http://localhost:5000

# MongoDB
MONGODB_CONNECTION_STRING=mongodb+srv://user:pass@cluster.mongodb.net/smartnotes

# OCR & AI
OCR_SPACE_API_KEY=...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
GOOGLE_CREDENTIALS={...json...}  
```

### 3. Run

```bash
npm run dev   # nodemon + live-reload
```
Visit `http://localhost:5000`.

---

##  Azure Deployment

1.  **Create** an App Service (Linux, Node 18 LTS).
2.  **Configure** the same environment variables in *Configuration → Application Settings*.
3.  **Provision** MongoDB Atlas & Auth0 callback URLs with your Azure domain.
4.  **CI/CD** – push to `main`; GitHub Action in `.github/workflows` auto-deploys to Azure.

> If you prefer manual deployment: `az webapp up --name smartnotesconverter --resource-group <rg>`.

---




