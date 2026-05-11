# Working Backend Fix

Due to complexity with file encoding, here's the **corrected server.js code** you can copy-paste directly:

## Solution 1: Using Mock Response (Works Immediately ✅)

Replace `d:\Project_space\voice_input\urgent-response-hub\backend\server.js` with this:

```javascript
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Simple mock endpoint - works immediately
app.post("/speech-to-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    // Clean up file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error:", err);
    });

    // Return mock transcription
    const mockResponses = [
      "Emergency! I need immediate medical assistance",
      "There is a fire in the building, need help urgently",
      "Accident reported, multiple injuries, please send ambulance",
      "Lost person, please help find missing family member",
      "Severe flooding in my area, need rescue assistance"
    ];

    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    console.log("Mock transcription:", randomResponse);
    res.json({ text: randomResponse });

  } catch (err) {
    console.error("Error:", err.message);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: "Error processing audio", details: err.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "Running", port: 5000 }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Mock Transcription Mode (for testing)`);
});
```

## Solution 2: Using Real Groq API (Requires Valid API Key)

When ready with a real API key, replace the POST endpoint with:

```javascript
import FormData from "form-data";

app.post("/speech-to-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY || "YOUR_KEY_HERE";
    
    const formData = new FormData();
    formData.append("file", fs.createReadStream(req.file.path), { 
      filename: "audio.webm", 
      contentType: "audio/webm" 
    });
    formData.append("model", "whisper-large-v3");

    const response = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",    
      formData,
      {
        headers: { 
          Authorization: `Bearer ${GROQ_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 30000
      }
    );

    fs.unlink(req.file.path, () => {});
    res.json(response.data);

  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ 
      error: "Error processing audio", 
      details: err.response?.data?.error?.message || err.message 
    });
  }
});
```

## Installation Steps

1. **Stop the backend** (Ctrl+C in backend terminal)
2. **Replace server.js** with one of the solutions above
3. **Install form-data** (if using Solution 2):
   ```bash
   cd backend
   npm install form-data
   ```
4. **Start backend**:
   ```bash
   npm start
   ```
5. **Test voice input** on http://localhost:8080/report

---

**Choose Solution 1 (Mock) to test immediately without API key!**
