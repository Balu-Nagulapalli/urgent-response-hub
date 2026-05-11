/**
 * Professional Backend Server for Voice Transcription
 * Features: Audio validation, retry logic, mixed language support, detailed logging
 */

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

// ─── Configuration ────────────────────────────────────────────────────────
const uploadDir = "uploads/";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MIN_FILE_SIZE = 100 * 1024; // 100KB
const GROQ_TIMEOUT = 60000; // 60 seconds
const MAX_CHUNK_SIZE = 25 * 1024 * 1024; // GROQ max file size
const CHUNK_OVERLAP = 2; // seconds

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Created upload directory: ${uploadDir}`);
}

// ─── Multer Configuration ────────────────────────────────────────────────
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"];
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    } else {
      cb(null, true);
    }
  },
});

// ─── Utility Functions ───────────────────────────────────────────────────

/**
 * Validate audio file
 */
function validateAudioFile(file, fileSize) {
  console.log(`📊 [Server] Validating audio file: ${file.filename}`);
  console.log(`   - Size: ${(fileSize / 1024).toFixed(2)} KB`);
  console.log(`   - MIME type: ${file.mimetype}`);

  if (fileSize < MIN_FILE_SIZE) {
    throw new Error(
      `Audio file too small (${(fileSize / 1024).toFixed(2)} KB). ` +
      `Minimum required: ${(MIN_FILE_SIZE / 1024).toFixed(2)} KB. Speak for at least 1-2 seconds.`
    );
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      `Audio file too large (${(fileSize / 1024 / 1024).toFixed(2)} MB). ` +
      `Maximum allowed: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)} MB.`
    );
  }

  console.log(`✅ [Server] Audio file validation passed`);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry logic for GROQ API
 */
async function transcribeWithRetry(formData, headers, attempt = 1) {
  const MAX_RETRIES = 3;

  try {
    console.log(`📤 [Server] Sending to GROQ (attempt ${attempt}/${MAX_RETRIES})...`);
    const startTime = Date.now();

    const response = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      {
        headers,
        timeout: GROQ_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const duration = Date.now() - startTime;
    console.log(`✅ [Server] GROQ transcription successful (${duration}ms)`);
    console.log(`   - Response: "${(response.data?.text || "").substring(0, 100)}..."`);

    return response.data;
  } catch (err) {
    const errorMsg = err?.response?.data?.error?.message || err?.message || "Unknown error";
    const statusCode = err?.response?.status;

    console.error(
      `❌ [Server] GROQ transcription failed (attempt ${attempt}/${MAX_RETRIES}):`,
      errorMsg
    );

    // Retry on server errors (5xx) or rate limiting (429)
    if ((statusCode >= 500 || statusCode === 429) && attempt < MAX_RETRIES) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ [Server] Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      return transcribeWithRetry(formData, headers, attempt + 1);
    }

    throw err;
  }
}

/**
 * Cleanup uploaded file
 */
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`⚠️ [Server] Cleanup error: ${err.message}`);
      } else {
        console.log(`🧹 [Server] Cleaned up file: ${path.basename(filePath)}`);
      }
    });
  }
}

// ─── Routes ────────────────────────────────────────────────────────────

/**
 * POST /speech-to-text
 * Convert audio file to text using GROQ Whisper API
 * Supports: English, Telugu, mixed languages
 * Features: Audio validation, retry logic, comprehensive error handling
 */
app.post("/speech-to-text", upload.single("file"), async (req, res) => {
  let uploadedPath = "";

  try {
    console.log("\n📱 [Server] === Speech-to-Text Request ===");

    // ─── Validate File ───────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        error: "No audio file provided",
        details: "Please select an audio file to transcribe.",
      });
    }

    uploadedPath = req.file.path;
    const fileSize = fs.statSync(uploadedPath).size;
    const language = (req.body?.language || "auto").toString().toLowerCase();

    try {
      validateAudioFile(req.file, fileSize);
    } catch (validationErr) {
      console.error(`❌ [Server] Validation failed: ${validationErr.message}`);
      return res.status(422).json({
        error: "Audio validation failed",
        details: validationErr.message,
      });
    }

    // ─── Check GROQ API Key ──────────────────────────────────────────
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error("❌ [Server] GROQ_API_KEY not configured");
      return res.status(500).json({
        error: "Server configuration error",
        details: "GROQ_API_KEY not set in backend environment. Contact system administrator.",
      });
    }

    // ─── Prepare GROQ Request ───────────────────────────────────────
    console.log(`🎙️ [Server] Preparing GROQ request...`);
    console.log(`   - Language: ${language}`);
    console.log(`   - File: ${path.basename(uploadedPath)}`);

    const formData = new FormData();
    formData.append("file", fs.createReadStream(uploadedPath), {
      filename: req.file.originalname || "voice-input.webm",
      contentType: req.file.mimetype || "audio/webm",
    });

    // Advanced GROQ configuration for accuracy
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("temperature", "0.3"); // Balance between accuracy and flexibility
    formData.append("language", language === "auto" ? "" : language); // Auto-detect if not specified

    // Prompt to improve mixed language and emergency context recognition
    const prompt =
      "Emergency incident reporting. " +
      "Include all speech: English, Telugu, Hindi, or mixed languages. " +
      "Focus on: casualty count, injuries, location, emergency type, immediate needs, hazards. " +
      "Preserve all critical information.";

    formData.append("prompt", prompt);

    // ─── Call GROQ API ──────────────────────────────────────────────
    const headers = {
      Authorization: `Bearer ${groqApiKey}`,
      ...formData.getHeaders(),
    };

    let groqResponse;
    try {
      groqResponse = await transcribeWithRetry(formData, headers);
    } catch (groqErr) {
      const statusCode = groqErr?.response?.status || 500;
      const errorMsg = groqErr?.response?.data?.error?.message || groqErr?.message;

      console.error(
        `❌ [Server] GROQ API error (${statusCode}): ${errorMsg}`
      );

      // Provide user-friendly error messages
      let details = "Failed to transcribe audio. Please try again.";

      if (statusCode === 429) {
        details = "API rate limit reached. Wait a moment and try again.";
      } else if (statusCode === 400) {
        details = "Invalid audio format. Supported: WebM, MP4, WAV, OGG, MPEG.";
      } else if (statusCode >= 500) {
        details = "GROQ service temporarily unavailable. Please try again.";
      }

      return res.status(statusCode).json({
        error: "Transcription failed",
        details,
      });
    }

    // ─── Process Response ───────────────────────────────────────────
    const text = (groqResponse?.text || "").trim();

    if (!text) {
      console.warn("⚠️ [Server] No transcription text returned");
      return res.status(422).json({
        error: "No speech detected",
        details:
          "Could not detect clear speech. Speak louder, slower, and reduce background noise. " +
          "Try again with clearer audio.",
      });
    }

    console.log(`✅ [Server] Transcription result: "${text}"`);
    console.log(`📊 [Server] Response size: ${text.length} characters`);

    // ─── Return Success ─────────────────────────────────────────────
    return res.json({
      text,
      language,
      confidence: "high", // Could be calculated from GROQ response if available
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `❌ [Server] Unexpected error:`,
      err.message
    );

    return res.status(500).json({
      error: "Transcription service error",
      details: err.message || "An unexpected error occurred.",
    });
  } finally {
    // ─── Cleanup ────────────────────────────────────────────────────
    cleanupFile(uploadedPath);
    console.log("────────────────────────────────────────\n");
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Speech-to-Text Server",
    port: process.env.PORT || 5000,
    groqConfigured: !!process.env.GROQ_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /debug/env
 * Debug endpoint to check configuration (remove in production)
 */
app.get("/debug/env", (req, res) => {
  res.json({
    groqApiKeySet: !!process.env.GROQ_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT || 5000,
  });
});

// ─── Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ [Server] Error handler caught:", err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(413).json({
        error: "File too large",
        details: `Maximum file size is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)} MB.`,
      });
    }
    return res.status(400).json({
      error: "Upload error",
      details: err.message,
    });
  }

  res.status(500).json({
    error: "Server error",
    details: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Speech-to-Text Server Started`);
  console.log(`${"=".repeat(60)}`);
  console.log(`🌐 Running on port: ${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/speech-to-text`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Debug: http://localhost:${PORT}/debug/env`);
  console.log(`🎤 GROQ API configured: ${!!process.env.GROQ_API_KEY ? "✅ Yes" : "❌ No"}`);
  console.log(`${"=".repeat(60)}\n`);
});

export default app;
