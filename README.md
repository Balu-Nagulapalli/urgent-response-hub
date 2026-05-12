# 🚨 Disaster Alert System — Emergency Response Automation Platform

> A ServiceNow-powered emergency response platform enabling citizens to report emergencies via voice or form, with AI classification, automatic district routing, and real-time SMS notifications.

**GitHub:** https://github.com/Balu-Nagulapalli/urgent-response-hub

---

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [System Architecture](#system-architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [ServiceNow Setup](#servicenow-setup)
- [Frontend Setup](#frontend-setup)
- [Backend Setup](#backend-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Team](#team)

---

## 🎯 Overview

Disaster Alert System is a **fully automated ServiceNow + React** emergency response platform that:

- Lets citizens report emergencies via **voice input** (Groq AI Whisper) or form
- **AI classifies** emergency type and severity using Groq LLAMA
- **Auto-routes** to the correct district manager and government department
- Sends **instant SMS acknowledgement** via TextBee (open-source)
- Translates resolution notes to the **citizen's preferred language** (4 languages)
- Provides **real-time dashboards** for 6 response teams (Control Room, Police, Medical, Fire, Rescue, General)

---

## ❌ Problem Statement

Citizens in rural districts lack a fast, reliable, and language-accessible channel to report emergencies. Government officers spend significant time manually triaging, routing, and following up on cases — leading to:

- Delayed emergency response
- Missed escalations
- Zero visibility for the citizen after submission
- Overburdened helplines that are language-limited

---

## ✅ Solution

A fully automated ServiceNow Flow Designer workflow that triggers on every new emergency case:

1. **Groq AI Whisper** transcribes optional voice input
2. **Groq LLAMA** classifies emergency type and severity
3. **District mapping** identifies the responsible manager
4. **TextBee** sends instant SMS acknowledgement
5. **Critical cases** trigger email escalation automatically
6. On **resolution**, notes are translated and final SMS is dispatched

The user sees these status messages because the ServiceNow flow sends SMS updates when the incident state changes:

- `Case INC0010050 is now IN PROGRESS. Our team is actively working on your emergency.`
- `Case INC0010050 has been RESOLVED. DONE Thank you. Stay safe.`

These messages are triggered automatically from the backend workflow, so the citizen gets a live progress update when the case moves to In Progress and a closure message when it is Resolved.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  React Frontend (Vite)  +  ServiceNow Service Portal (/sp)  │
│  • Emergency Report Form  • Voice Input  • Status Tracking  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    AUTOMATION LAYER                          │
│              ServiceNow Flow Designer                        │
│  Flow 1: Disaster Alert Automation (on record create)        │
│  Flow 2: EMR Send Resolution SMS (on state → Resolved)       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   INTEGRATION LAYER                          │
│  Groq Whisper │ Groq LLAMA │ TextBee SMS │ Open Source Trans│
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🎤 Voice Input (Groq AI Whisper)
- Citizens speak their emergency description
- Supports English, Hindi, Telugu, Kannada
- Transcription auto-populates the description field

### 🤖 AI Classification (Groq LLAMA)
- Classifies: Flood, Fire, Medical, Accident, Law & Order, Other
- Determines severity: Critical, High, Medium, Low
- Extracts village/district from free-text description

### 📍 Auto-Routing
- District manager lookup via District Mapping table
- Department assignment via Department Routing table
- Zero manual intervention required

### 📱 SMS Notifications (TextBee)
- Instant acknowledgement SMS in citizen's preferred language
- Resolution SMS with translated close notes
- Supports 4 languages
- State-based SMS alerts are sent automatically when the incident moves to `In Progress` and `Resolved`

### 🚨 Critical Escalation
- Auto-email to assignment group for Critical severity
- Includes: case ID, type, severity, location, AI summary

### 📊 Team Dashboards
- 6 role-based dashboards (Control Room, Police, Medical, Fire, Rescue, General)
- Real-time incident tracking with state management
- Work notes, activity history, priority control

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Platform | ServiceNow (PDI) |
| Voice AI | Groq AI Whisper API |
| Classification AI | Groq LLAMA |
| SMS | TextBee (Open-Source) |
| Translation | Open Source Translate |
| Auth | ServiceNow REST API + Custom user table |

---

## ⚙️ ServiceNow Setup

### Option 1 — Import Update Set (Recommended)

1. Log in to your ServiceNow PDI
2. Go to **System Update Sets → Retrieved Update Sets**
3. Click **Import Update Set from XML**
4. Upload `servicenow/servicenow_export.xml`
5. Click **Preview** → **Commit**

This imports:
- Custom tables (`u_ers_users`, `u_ers_districts`)
- Custom incident fields (`u_full_address`, `u_gps_latitude`, `u_gps_longitude`, etc.)
- CORS rules
- Role definitions

### Option 2 — Manual Setup

#### Custom Tables Required

**`u_ers_users`** — Team/District user accounts
| Field | Type | Description |
|---|---|---|
| u_username | String | Login username |
| u_password_hash | String | Plain text password |
| u_role | Choice | User role (100=super_admin, 200=police, etc.) |
| u_district | Reference | District reference |
| u_phone | String | Phone number |
| u_is_active | Boolean | Account active status |

**`u_ers_districts`** — District configuration
| Field | Type | Description |
|---|---|---|
| u_district_id | String | Unique district ID |
| u_name | String | District name |
| u_manager | String | District manager name |

#### Custom Incident Fields
Add these fields to the `incident` table:
- `u_full_address` (String) — Full location address
- `u_gps_latitude` (String) — GPS latitude
- `u_gps_longitude` (String) — GPS longitude
- `u_caller_phone` (String) — Caller phone number
- `u_caller_email` (String) — Caller email

#### CORS Rule Setup
1. Go to **System Web Services → REST → CORS Rules**
2. Click **New**
3. Set:
   - **Name:** `ERS Frontend`
   - **REST API:** `Table API`
   - **Domain:** `http://localhost:8080` (dev) or your Vercel URL (prod)
   - **HTTP Methods:** GET, POST, PUT, PATCH, DELETE
4. Click **Submit**

---

## 💻 Frontend Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Balu-Nagulapalli/urgent-response-hub.git
cd urgent-response-hub

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your values (see Environment Variables section)

# Start development server
npm run dev
```

Frontend runs at `http://localhost:8080`

---

## 🖥️ Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start backend server
node server.js
```

Backend runs at `http://localhost:5000`

---

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
# ServiceNow
VITE_SN_INSTANCE=https://your-instance.service-now.com
VITE_SN_USERNAME=admin
VITE_SN_PASSWORD=your_admin_password

# Backend API
VITE_BACKEND_URL=http://localhost:5000
```

Create a `.env` file in the `backend/` directory:

```env
# ServiceNow
SN_INSTANCE=https://your-instance.service-now.com
SN_USERNAME=admin
SN_PASSWORD=your_admin_password

# Groq AI
GROQ_API_KEY=your_groq_api_key

# Server
PORT=5000

# CORS (comma-separated if multiple frontend domains)
CORS_ORIGIN=http://localhost:8080
```

---

## 🔑 Default Login Credentials

### Team Users (Pre-configured)
| Username | Password | Role |
|---|---|---|
| `control_room` | `Admin@123` | Control Room — all incidents |
| `police_team` | `Admin@123` | Police — all incidents |
| `medical_team` | `Admin@123` | Medical — medical incidents only |
| `fire_team` | `Admin@123` | Fire — fire incidents only |
| `rescue_team` | `Admin@123` | Rescue — rescue incidents only |
| `general_team` | `Admin@123` | General — others only |

### District Users
Created via the `u_ers_users` table in ServiceNow with custom passwords.

---

## 🚀 Deployment

### Frontend — Vercel

```bash
# Build
npm run build

# Deploy
npx vercel

# Set environment variables in Vercel Dashboard:
# VITE_SN_INSTANCE, VITE_SN_USERNAME, VITE_SN_PASSWORD, VITE_BACKEND_URL
```

**After deploying:** Update your ServiceNow CORS rule to add your Vercel URL.

### Backend — Railway / Render

1. Push `backend/` folder to GitHub
2. Connect to Railway or Render
3. Set environment variables
4. Deploy

---

## 📁 Project Structure

```
urgent-response-hub/
├── src/
│   ├── pages/
│   │   ├── AdminLogin.tsx       # Premium login page
│   │   ├── TeamDashboard.tsx    # Role-based incident dashboard
│   │   ├── ReportIncident.tsx   # Emergency report form
│   │   └── Status.tsx           # Incident tracking page
│   ├── components/
│   │   ├── VoiceRecorder.tsx    # Groq Whisper voice input
│   │   └── Layout.tsx
│   ├── AuthContext.tsx           # Authentication context
│   └── services/
│       └── api.ts               # ServiceNow API calls
├── backend/
│   └── server.js                # Express backend (Groq proxy)
├── servicenow/
│   └── servicenow_export.xml    # ServiceNow update set export
├── .env.example
└── README.md
```

---

## 🎯 Key Differentiators

- **No backend dependency for core features** — directly calls ServiceNow REST API
- **Voice-first design** — Groq Whisper for multilingual voice input
- **Role-based access** — 6 distinct team dashboards with filtered views
- **Real-time activity history** — full audit trail of work notes
- **Priority control** — control room can escalate/de-escalate priorities
- **GPS integration** — auto-captures location via browser geolocation

---

## 👥 Team

**Project:** Disaster Alert System  
**Type:** Government-SaaS / Civic-Tech Automation Platform  
**Platform:** ServiceNow + React