import "dotenv/config";
import express from "express";
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

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.post("/speech-to-text", upload.single("file"), async (req, res) => {
  let uploadedPath = "";
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }
    uploadedPath = req.file.path;

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return res.status(500).json({
        error: "Missing GROQ_API_KEY",
        details: "Set GROQ_API_KEY in your backend environment before using voice transcription.",
      });
    }

    const language = (req.body?.language || "en").toString();
    const formData = new FormData();
    formData.append("file", fs.createReadStream(uploadedPath), {
      filename: req.file.originalname || "voice-input.webm",
      contentType: req.file.mimetype || "audio/webm",
    });
    formData.append("model", "whisper-large-v3");
    formData.append("temperature", "0");
    formData.append("language", language);
    formData.append("response_format", "json");
    formData.append("prompt", "Emergency incident reporting context.");

    const groqResponse = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 45000,
      }
    );

    const text = (groqResponse.data?.text || "").trim();
    if (!text) {
      return res.status(422).json({
        error: "No transcription text",
        details: "No clear speech detected. Speak louder and reduce background noise.",
      });
    }

    res.json({ text });

  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.error?.message || err?.message || "Unknown transcription error";
    console.error("Speech-to-text error:", details);
    res.status(status).json({ error: "Error processing audio", details });
  } finally {
    if (uploadedPath && fs.existsSync(uploadedPath)) {
      fs.unlink(uploadedPath, (cleanupError) => {
        if (cleanupError) console.error("Cleanup error:", cleanupError.message);
      });
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "Server is running", port: 5000 });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Speech-to-text endpoint: http://localhost:${PORT}/speech-to-text`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 Mode: Real Groq Whisper Transcription`);
});
