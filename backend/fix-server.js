#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const serverCode = `import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";

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

app.post("/speech-to-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY || "REMOVED";

    if (GROQ_API_KEY === "YOUR_GROQ_API_KEY") {
      console.warn("GROQ_API_KEY not set. Using mock response.");
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.json({ text: "Mock transcription: Emergency assistance needed immediately", mock: true });
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(req.file.path), { filename: "audio.webm", contentType: "audio/webm" });
    formData.append("model", "whisper-large-v3");

    console.log("Sending audio to Groq API...");
    const response = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", formData, {
      headers: { 
        Authorization: \`Bearer \${GROQ_API_KEY}\`, 
        ...formData.getHeaders() 
      },
      timeout: 30000
    });

    console.log("Transcription successful:", response.data.text);
    if (req.file) fs.unlink(req.file.path, () => {});
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

app.get("/health", (req, res) => res.json({ status: "Server is running", port: 5000 }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Speech-to-text: http://localhost:\${PORT}/speech-to-text\`);
});
`;

fs.writeFileSync(path.join(__dirname, 'server.js'), serverCode, 'utf8');
console.log('✅ server.js has been updated with FormData support');
