# 🚀 How to Run the Urgent Response Hub Application

## Application Overview
The **Urgent Response Hub** is a full-stack emergency response application with:
- ✅ Frontend: React + Vite + TypeScript
- ✅ Backend: Node.js + Express
- ✅ Voice Input: Groq Whisper Speech-to-Text API
- ✅ Location Services: GPS integration
- ✅ ServiceNow Integration: Incident management

---

## Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **bun** package manager
- **Groq API Key** for voice transcription
- **ServiceNow Instance** (optional, for production)
- **Web Browser** with microphone access (Chrome, Firefox, Edge recommended)

---

## Installation Setup

### Step 1: Install Root Dependencies
```bash
cd d:\Project_space\voice_input\urgent-response-hub
npm install --legacy-peer-deps
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

---

## Configuration

### Set Groq API Key (for voice-to-text)
Replace the placeholder key in [backend/server.js](backend/server.js) line 30:
```javascript
const GROQ_API_KEY = process.env.GROQ_API_KEY || "YOUR_ACTUAL_API_KEY_HERE";
```

**OR** set as environment variable:
```bash
# Windows PowerShell
$env:GROQ_API_KEY = "REMOVED"

# Windows CMD
set GROQ_API_KEY=REMOVED

# macOS/Linux
export GROQ_API_KEY="REMOVED"
```

### ServiceNow Configuration (Optional)
Create `.env` file in root directory:
```bash
VITE_SN_INSTANCE=https://your-instance.service-now.com
VITE_SN_USERNAME=your-username
VITE_SN_PASSWORD=your-password
```

---

## Running the Application

### Option 1: Run Both Servers Simultaneously (Recommended)

**Terminal 1 - Frontend Server (Port 8080):**
```bash
cd d:\Project_space\voice_input\urgent-response-hub
npm run dev
```

**Terminal 2 - Backend Server (Port 5000):**
```bash
cd d:\Project_space\voice_input\urgent-response-hub\backend
npm start
```

### Option 2: Using Individual Commands

**Frontend:**
```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm test            # Run tests
```

**Backend:**
```bash
npm start            # Start server on port 5000
```

---

## Server URLs

Once running, access the application at:

| Service | URL | Port | Status |
|---------|-----|------|--------|
| **Frontend** | http://localhost:8080 | 8080 | React App |
| **Backend** | http://localhost:5000 | 5000 | Express API |
| **Health Check** | http://localhost:5000/health | 5000 | API Status |
| **Speech-to-Text** | http://localhost:5000/speech-to-text | 5000 | Voice API |

---

## Application Features

### 1. **Home Page** (`/`)
- Emergency helpline contact
- Quick action buttons
- Emergency categories (Medical, Rescue, Food Aid, Shelter)

### 2. **Report Incident** (`/report`) ⭐ **WITH VOICE INPUT**
- Full Name
- Email Address
- Contact Number
- Location (with GPS auto-fill)
- Emergency Type selector
- **🎤 Voice Input Panel** (NEW!)
  - Click "Add Voice" to show voice input
  - Click "Record Voice" to record audio
  - 4-second recording window
  - Auto-transcription to Description field
  - Real-time feedback

### 3. **Track Status** (`/status`)
- View submitted incident status
- Track help request progress
- View incident details

---

## Voice Input Workflow

### Using Voice to Report Emergency:

1. **Navigate to Report Incident page**
   - Click "Report Incident" in navigation

2. **Fill Required Fields**
   - Full Name
   - Contact Number
   - Location
   - Emergency Type

3. **Activate Voice Input**
   - Scroll to Description field
   - Click **"Add Voice"** button
   - Voice panel opens with blue background

4. **Record Voice**
   - Click **"Record Voice"** button (red)
   - Allow microphone access when prompted
   - Speak your emergency details (4 seconds)
   - Recording stops automatically

5. **Auto-Fill Description**
   - Transcribed text appears in the panel
   - Description field auto-fills with recognized text
   - Edit if needed

6. **Submit Emergency**
   - Click "Send Help Request" button
   - Incident created in ServiceNow
   - Redirected to status tracking page

---

## File Structure

```
urgent-response-hub/
├── src/
│   ├── components/
│   │   ├── voiceInput.tsx          # Voice input component
│   │   ├── ReportIncident.tsx      # Report form with voice integration
│   │   └── ...other components
│   ├── pages/
│   ├── hooks/
│   └── App.tsx
├── backend/
│   ├── server.js                   # Express server with Groq integration
│   └── package.json
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Troubleshooting

### Issue: "Microphone Access Denied"
**Solution:** Allow microphone access in browser settings
- Chrome: Settings → Privacy → Microphone → Allow
- Firefox: Settings → Permissions → Microphone → Allow
- Edge: Settings → Privacy → Microphone → Allow

### Issue: Backend not responding
**Solution:** Check if port 5000 is available
```bash
# Check running processes
Get-Process node

# Kill process on port 5000
Stop-Process -Id <PID> -Force

# Restart backend
cd backend && npm start
```

### Issue: "Cannot reach ServiceNow"
**Solution:** 
- Verify `.env` credentials are correct
- Check CORS settings in ServiceNow
- Ensure network connectivity

### Issue: Voice transcription returns mock response
**Solution:**
- Verify Groq API key is set correctly
- Check if `GROQ_API_KEY` environment variable is loaded
- Restart backend after setting API key

---

## Development Commands

```bash
# Frontend Development
npm run dev              # Start dev server with hot reload
npm run lint            # Run ESLint
npm test                # Run Vitest
npm run test:watch      # Run tests in watch mode

# Backend
cd backend && npm start  # Start Express server

# Production
npm run build            # Build for production
npm run preview          # Preview production build
```

---

## Performance Optimization

- Frontend: Vite with React SWC (fast builds)
- Backend: Express with compression
- Voice: 4-second chunks for quick transcription
- Database: Async operations with proper error handling

---

## Security Notes

- 🔐 Never commit `.env` files
- 🔐 Keep API keys private
- 🔐 Use HTTPS in production
- 🔐 Validate all user inputs
- 🔐 Enable CORS carefully in production

---

## Support & Debugging

Enable debug logging:
```javascript
// In ReportIncident.tsx
console.log("Form submitted:", data);

// In backend/server.js
console.log("Transcribing audio:", req.file.path);
```

---

## Key Endpoints

### Speech-to-Text API
```
POST /speech-to-text
Content-Type: multipart/form-data

Body:
- file: <audio file>

Response:
{
  "text": "Emergency medical assistance needed"
}
```

### Health Check
```
GET /health

Response:
{
  "status": "Server is running",
  "port": 5000
}
```

---

## Next Steps

1. ✅ Run `npm install --legacy-peer-deps`
2. ✅ Set Groq API key in `backend/server.js`
3. ✅ Start backend: `cd backend && npm start`
4. ✅ Start frontend: `npm run dev`
5. ✅ Open http://localhost:8080
6. ✅ Test voice input on Report page

---

**Application is ready to use! 🚀**
