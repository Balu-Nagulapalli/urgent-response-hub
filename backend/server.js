import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const backendEnvPath = path.join(__dirname, ".env");

dotenv.config({ path: backendEnvPath });

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:8080",
    "https://erm-kappa.vercel.app",
    /\.vercel\.app$/,
  ],
  credentials: true,
}));
app.use(express.json());

// ─── ServiceNow Config ────────────────────────────────────────────────────────
const SN_INSTANCE = (process.env.SN_INSTANCE || "").trim();
const SN_USERNAME = (process.env.SN_USERNAME || "").trim();
const SN_PASSWORD = (process.env.SN_PASSWORD || "").trim();
const SN_AUTH     = "Basic " + Buffer.from(`${SN_USERNAME}:${SN_PASSWORD}`).toString("base64");
const snConfigured = Boolean(SN_INSTANCE && SN_USERNAME && SN_PASSWORD);

console.log(`ServiceNow configured: ${snConfigured}`);
if (!snConfigured) {
  console.warn("⚠️  [Server] SN_INSTANCE / SN_USERNAME / SN_PASSWORD missing in backend/.env");
}

// ─── Groq Config ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE   = 15 * 1024 * 1024;
const GROQ_TIMEOUT    = 25000;
const MAX_RETRIES     = 3;
const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

const groqApiKey    = (process.env.GROQ_API_KEY || "").trim();
const groqConfigured = Boolean(groqApiKey);

console.log(`GROQ API Loaded: ${groqConfigured}`);
if (!groqConfigured) {
  console.error("❌ [Server] GROQ_API_KEY is missing. Add it to backend/.env and restart.");
}

// Optional: LLAMA API key (can be provided separately). If present, use for classification.
const llamaApiKey = (process.env.LLAMA_API_KEY || "").trim();
const classificationApiKey = llamaApiKey || groqApiKey;
const classificationConfigured = Boolean(classificationApiKey);
console.log(`LLAMA API Loaded: ${Boolean(llamaApiKey)}; Classification API available: ${classificationConfigured}`);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`UNSUPPORTED_AUDIO:${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGroqError(err) {
  const status = err?.response?.status;
  const code   = String(err?.code || "");
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  if (["ECONNABORTED","ETIMEDOUT","ECONNRESET","ENOTFOUND","EAI_AGAIN"].includes(code)) return true;
  return false;
}

function getGroqErrorMessage(err) {
  return err?.response?.data?.error?.message || err?.message || "Unknown transcription error";
}

async function transcribeWithRetry(formData, headers, attempt = 1) {
  const startTime = Date.now();
  try {
    console.log(`📤 [Server] Sending audio to Groq (attempt ${attempt}/${MAX_RETRIES})...`);
    const response = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      { headers, timeout: GROQ_TIMEOUT, maxBodyLength: Infinity, maxContentLength: Infinity }
    );
    console.log(`📡 [Server] Groq response time: ${Date.now() - startTime}ms`);
    return response.data;
  } catch (err) {
    const message = getGroqErrorMessage(err);
    console.error(`❌ [Server] Groq failed after ${Date.now() - startTime}ms — ${message}`);
    if (attempt < MAX_RETRIES && isRetryableGroqError(err)) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
      console.log(`⏳ [Server] Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      return transcribeWithRetry(formData, headers, attempt + 1);
    }
    throw err;
  }
}

// ─── Route: ServiceNow Proxy ──────────────────────────────────────────────────
// POST /api/sn/incident  →  forwards to ServiceNow table API
// Called by ReportIncident.tsx — keeps credentials server-side, avoids CORS/401

app.post("/api/sn/incident", async (req, res) => {
  console.log("\n🏥 [Server] === ServiceNow Incident Proxy ===");

  if (!snConfigured) {
    console.error("❌ [Server] ServiceNow not configured");
    return res.status(503).json({
      error:   "ServiceNow not configured",
      details: "Add SN_INSTANCE, SN_USERNAME, SN_PASSWORD to backend/.env and restart.",
    });
  }

  try {
    console.log(`📤 [Server] Forwarding incident to: ${SN_INSTANCE}`);

    const snRes = await axios.post(
      `${SN_INSTANCE}/api/now/table/incident`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept":        "application/json",
          "Authorization": SN_AUTH,
        },
        timeout: 15000,
      }
    );

    console.log(`✅ [Server] Incident created: ${snRes.data?.result?.number}`);
    return res.status(snRes.status).json(snRes.data);

  } catch (err) {
    const status  = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err?.message || "Unknown error";
    console.error(`❌ [Server] ServiceNow error (${status}): ${message}`);
    return res.status(status).json({
      error:   "ServiceNow request failed",
      details: message,
    });
  } finally {
    console.log("────────────────────────────────────────");
  }
});

// ── GET /api/sn/incidents ─────────────────────────────────────
// Called by TeamDashboard to fetch filtered incidents
app.get("/api/sn/incidents", async (req, res) => {
  if (!snConfigured) return res.status(503).json({ error: "ServiceNow not configured" });
  try {
    const params = new URLSearchParams(req.query);
    const snRes = await axios.get(
      `${SN_INSTANCE}/api/now/table/incident?${params.toString()}`,
      {
        headers: { "Accept": "application/json", "Authorization": SN_AUTH },
        timeout: 15000,
      }
    );
    res.status(snRes.status).json(snRes.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err.message;
    console.error(`❌ [SN Proxy] GET /incidents failed (${status}): ${message}`);
    res.status(status).json({ error: message });
  }
});

// ── PATCH /api/sn/incidents/:sys_id ──────────────────────────
// Called by TeamDashboard to update state / priority / work notes
app.patch("/api/sn/incidents/:sys_id", async (req, res) => {
  if (!snConfigured) return res.status(503).json({ error: "ServiceNow not configured" });
  try {
    const snRes = await axios.patch(
      `${SN_INSTANCE}/api/now/table/incident/${req.params.sys_id}`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": SN_AUTH,
        },
        timeout: 15000,
      }
    );
    res.status(snRes.status).json(snRes.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err.message;
    console.error(`❌ [SN Proxy] PATCH /incidents/${req.params.sys_id} failed (${status}): ${message}`);
    res.status(status).json({ error: message });
  }
});

// ── GET /api/sn/incidents/:sys_id/activity ───────────────────
// Called by TeamDashboard to fetch work notes / activity log
app.get("/api/sn/incidents/:sys_id/activity", async (req, res) => {
  if (!snConfigured) return res.status(503).json({ error: "ServiceNow not configured" });
  try {
    const snRes = await axios.get(
      `${SN_INSTANCE}/api/now/table/sys_journal_field` +
      `?sysparm_query=element_id=${req.params.sys_id}^element=work_notes^ORDERBYDESCsys_created_on` +
      `&sysparm_fields=sys_created_on,sys_created_by,value,element&sysparm_limit=50`,
      {
        headers: { "Accept": "application/json", "Authorization": SN_AUTH },
        timeout: 15000,
      }
    );
    res.status(snRes.status).json(snRes.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err.message;
    console.error(`❌ [SN Proxy] GET /activity failed (${status}): ${message}`);
    res.status(status).json({ error: message });
  }
});

// ── POST /api/sn/auth/login ───────────────────────────────────
// Authenticates ALL users: both team users (empty District) and district users
// Team users stored in u_ers_users table with empty u_district field
// Returns unified response with districtId="ALL" for team users
app.post("/api/sn/auth/login", async (req, res) => {
  if (!snConfigured) return res.status(503).json({ error: "ServiceNow not configured" });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const userRes = await axios.get(
      `${SN_INSTANCE}/api/now/table/u_ers_users` +
      `?sysparm_query=u_username=${encodeURIComponent(username)}^u_is_active=true` +
      `&sysparm_fields=sys_id,u_username,u_password_hash,u_role,u_phone,u_district` +
      `&sysparm_limit=1&sysparm_display_value=all`,
      {
        headers: { "Accept": "application/json", "Authorization": SN_AUTH },
        timeout: 15000,
      }
    );

    const userRecord = userRes.data?.result?.[0];
    if (!userRecord) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const storedPassword =
      typeof userRecord.u_password_hash === "object"
        ? userRecord.u_password_hash.value
        : userRecord.u_password_hash;

    if (storedPassword !== password) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const SN_ROLE_MAP = {
      "100": "super_admin",
      "200": "police_team",
      "300": "fire_team",
      "400": "control_room",
      "500": "rescue_team",
      "600": "medical_team",
      "super_admin":  "super_admin",
      "police_team":  "police_team",
      "fire_team":    "fire_team",
      "control_room": "control_room",
      "rescue_team":  "rescue_team",
      "medical_team": "medical_team",
      "general_team": "general_team",
    };

    const rawRole =
      typeof userRecord.u_role === "object"
        ? userRecord.u_role.value
        : String(userRecord.u_role).trim();

    const role = SN_ROLE_MAP[rawRole] ?? "general_team";

    let districtId   = "";
    let districtName = "";

    const districtRef = userRecord.u_district;
    
    // ── Team users (District = empty) get ALL districts ──────────────────────
    if (!districtRef || (typeof districtRef === "object" && !districtRef.value)) {
      districtId   = "ALL";
      districtName = "All Districts";
    }
    // ── District users: fetch district details ──────────────────────────────
    else if (districtRef && typeof districtRef === "object" && districtRef.link) {
      try {
        const distRes = await axios.get(
          `${districtRef.link}?sysparm_fields=u_district_id,u_name`,
          {
            headers: { "Accept": "application/json", "Authorization": SN_AUTH },
            timeout: 10000,
          }
        );
        districtId   = distRes.data?.result?.u_district_id ?? "";
        districtName = distRes.data?.result?.u_name ?? districtRef.display_value ?? "";
      } catch {
        districtName = districtRef.display_value ?? "";
      }
    }

    // ── Super admin always sees all districts ───────────────────────────────
    if (role === "super_admin") {
      districtId   = "ALL";
      districtName = "All Districts";
    }

    const resolveField = (field) =>
      typeof field === "object" ? (field?.value ?? "") : (field ?? "");

    return res.json({
      success: true,
      user: {
        username:    resolveField(userRecord.u_username),
        displayName: resolveField(userRecord.u_username),
        role,
        sys_id:      userRecord.sys_id,
        districtId,
        districtName,
        phone:       resolveField(userRecord.u_phone),
      },
    });

  } catch (err) {
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err.message;
    console.error(`❌ [SN Proxy] POST /auth/login failed (${status}): ${message}`);
    res.status(status).json({ error: message });
  }
});

// ─── Route: Speech-to-Text (unchanged) ───────────────────────────────────────

app.post("/speech-to-text", upload.single("file"), async (req, res) => {
  const requestStart = Date.now();
  console.log("\n📱 [Server] === Speech-to-Text Request Started ===");

  try {
    if (!groqConfigured) {
      console.error("❌ [Server] GROQ_API_KEY missing.");
      return res.status(503).json({
        error:   "Voice service is not configured",
        code:    "configuration_error",
        details: "Add GROQ_API_KEY to backend/.env and restart.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error:   "No audio file provided",
        code:    "validation_error",
        details: "Please record audio and try again.",
      });
    }

    const mimeType   = req.file.mimetype || "unknown";
    const fileSizeKB = (req.file.size / 1024).toFixed(2);

    console.log(`🎙️ [Server] File: ${req.file.originalname || "voice-input.webm"}`);
    console.log(`📦 [Server] Size: ${fileSizeKB} KB`);
    console.log(`🎧 [Server] MIME: ${mimeType}`);
    console.log(`🔍 [Server] Buffer length: ${req.file.buffer.length}`);

    if (req.file.size <= 0) {
      console.error("❌ [Server] Received empty file (size=0)");
      return res.status(422).json({
        error:   "Empty audio recording",
        code:    "empty_audio",
        details: "No usable audio captured. Please try again.",
      });
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      console.error(`❌ [Server] Unsupported MIME type: ${mimeType}`);
      return res.status(415).json({
        error:   "Unsupported audio format",
        code:    "unsupported_audio",
        details: "Use audio/webm, audio/mp4, audio/mpeg, audio/wav, or audio/ogg.",
      });
    }

    const rawLanguage        = String(req.body?.language || "").trim().toLowerCase();
    const normalizedLanguage = rawLanguage && rawLanguage !== "auto" ? rawLanguage : "en";
    console.log(`🌐 [Server] Language: ${normalizedLanguage}`);

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename:    req.file.originalname || "voice-input.webm",
      contentType: mimeType,
      knownLength: req.file.size,
    });
    formData.append("model",           "whisper-large-v3");
    formData.append("temperature",     "0");
    formData.append("language",        normalizedLanguage);
    formData.append("response_format", "verbose_json");
    formData.append(
      "prompt",
      "This audio is from a disaster emergency response system. Common words include disaster, emergency, rescue, flood, fire, medical, response, system, help, evacuation. Preserve short, urgent speech and any mixed language speech if present."
    );

    const headers = { Authorization: `Bearer ${groqApiKey}`, ...formData.getHeaders() };
    const groqResponse = await transcribeWithRetry(formData, headers);
    const text = String(groqResponse?.text || "").trim();

    console.log(`🤖 [Server] Groq Response:`, JSON.stringify(groqResponse, null, 2).substring(0, 500));

    if (!text) {
      console.warn("⚠️ [Server] Groq returned empty transcript.");
      return res.status(422).json({
        error:   "No speech detected",
        code:    "empty_audio",
        details: "Could not detect clear speech. Speak louder and reduce background noise.",
      });
    }

    const totalDurationMs = Date.now() - requestStart;
    console.log(`✅ [Server] Transcription complete in ${totalDurationMs}ms`);
    console.log(`📝 [Server] Transcript: "${text}"`);

    return res.json({ text, durationMs: totalDurationMs, sizeKB: Number(fileSizeKB) });

  } catch (err) {
    const status  = err?.response?.status || 500;
    const details = getGroqErrorMessage(err);
    const code    = status >= 500 ? "server_error" : "transcription_error";

    console.error(`❌ [Server] Speech-to-text error (${status}):`, err.message);
    console.error(`📋 [Server] Details:`, details);
    if (err?.response?.data) {
      console.error(`📊 [Server] Response body:`, JSON.stringify(err.response.data).substring(0, 500));
    }
    return res.status(status).json({ error: "Error processing audio", code, details });

  } finally {
    console.log(`🏁 [Server] Request finished in ${Date.now() - requestStart}ms`);
    console.log("────────────────────────────────────────");
  }
});

// ─── Route: AI Classification (Groq LLAMA) ───────────────────────────────────

app.post("/api/sn/classify", async (req, res) => {
  console.log("\n🤖 [Server] === AI Classification Request ===");
  if (!classificationConfigured) {
    console.error("❌ [Server] Classification API key missing (LLAMA_API_KEY or GROQ_API_KEY)");
    return res.status(503).json({
      error: "Classification API not configured",
      details: "Add LLAMA_API_KEY or GROQ_API_KEY to environment and restart.",
    });
  }

  const { text, latitude, longitude } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({
      error: "No text to classify",
      details: "Provide 'text' field in request body",
    });
  }

  try {
    console.log(`📝 [Server] Input: "${text.substring(0, 100)}..."`);

    // Call Groq to classify the emergency
    const classificationPrompt = `You are an emergency classification AI for a disaster response system.

Classify this emergency report into one of: medical, fire, police, rescue, others.
Extract severity: Critical, High, Medium, Low.
Try to identify the district if mentioned.
Provide a concise summary of the emergency.

IMPORTANT: Look for keywords like:
- Medical: pain, injured, hurt, accident, hospital, sick, breathing, medical, health
- Fire: fire, burning, smoke, flames, explosion, gas leak
- Police: robbery, theft, crime, violence, assault, attack, threat, suspicious
- Rescue: flood, trapped, collapsed, drowning, earthquake, storm, rescue, landslide
- Others: any other emergency

Report: "${text}"
${latitude && longitude ? `Location: Latitude ${latitude}, Longitude ${longitude}` : ""}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "type": "medical|fire|police|rescue|others",
  "severity": "Critical|High|Medium|Low",
  "summary": "brief emergency description",
  "district": "district name if identifiable, otherwise null",
  "confidence": 0.0-1.0
}`;

    // Use classificationApiKey (prefers LLAMA_API_KEY if provided, otherwise GROQ_API_KEY)
    const classificationHeaders = { Authorization: `Bearer ${classificationApiKey}` };
    const classificationModel = "llama-3.1-8b-instant";
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: classificationModel,
        messages: [{ role: "user", content: classificationPrompt }],
        temperature: 0.3,
        max_tokens: 300,
      },
      {
        headers: classificationHeaders,
        timeout: 15000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || "{}";
    console.log(`📋 [Server] Groq response: ${content}`);

    // Parse JSON from response (handle markdown code blocks if present)
    let jsonContent = content.trim();
    if (jsonContent.includes("```json")) {
      jsonContent = jsonContent.split("```json")[1]?.split("```")[0]?.trim() || jsonContent;
    } else if (jsonContent.includes("```")) {
      jsonContent = jsonContent.split("```")[1]?.split("```")[0]?.trim() || jsonContent;
    }

    const classification = JSON.parse(jsonContent);

    // Validate required fields
    if (!classification.type || !classification.severity) {
      throw new Error("Invalid classification response structure");
    }

    console.log(`✅ [Server] Classified as: ${classification.type} / ${classification.severity} using ${classificationModel}`);
    res.json(classification);

  } catch (err) {
    console.error(`❌ [Server] Classification error: ${err.message}`);
    if (err?.response?.data) {
      console.error("📥 [Server] Classification API response body:", JSON.stringify(err.response.data).substring(0, 2000));
    }
    const details = err?.response?.data?.error?.message || err.message || JSON.stringify(err?.response?.data || err);
    res.status(500).json({
      error: "Classification failed",
      details,
    });
  }
});

// ─── Route: Health Check (unchanged) ─────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    status:        "healthy",
    service:       "ERS Backend Server",
    port:          Number(process.env.PORT || 5000),
    groqConfigured,
    snConfigured,
    timestamp:     new Date().toISOString(),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ ERS Backend running on port ${PORT}`);
  console.log(`📍 Speech-to-text : http://localhost:${PORT}/speech-to-text`);
  console.log(`🏥 SN Proxy       : http://localhost:${PORT}/api/sn/incident`);
  console.log(`💚 Health         : http://localhost:${PORT}/health`);
  console.log(`🎤 GROQ           : ${groqConfigured ? "✅" : "❌ missing"}`);
  console.log(`🏛️  ServiceNow     : ${snConfigured  ? "✅" : "❌ missing"}`);
  console.log(`${"=".repeat(50)}\n`);
});