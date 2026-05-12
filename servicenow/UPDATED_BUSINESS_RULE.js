/**
 * UPDATED: EMR Incident Auto-Routing Business Rule
 * 
 * STEP 1: Call backend /api/sn/classify for Groq LLAMA AI classification
 * STEP 2: Write AI results back to incident
 * STEP 3: Route to correct officer based on type + district
 * 
 * How to apply:
 * 1. Go to ServiceNow → System Definitions → Business Rules
 * 2. Find "EMR Incident Auto-Routing" 
 * 3. Replace the script section with this code
 * 4. Save and test
 */

(function executeRule(current, previous) {
  try {
    gs.info("🤖 EMR: Starting AI classification for " + current.number);

    // ─── STEP 1: Call backend /api/sn/classify endpoint ──────────────────
    
    var voiceText = current.u_voice_input ? current.u_voice_input.toString() : "";
    var shortDesc = current.short_description ? current.short_description.toString() : "";
    var textToClassify = voiceText || shortDesc;

    if (!textToClassify.trim()) {
      gs.warn("EMR: No text to classify for " + current.number);
      return;
    }

    var latitude  = current.u_gps_latitude  ? current.u_gps_latitude.toString()  : "";
    var longitude = current.u_gps_longitude ? current.u_gps_longitude.toString() : "";

    var request = new GlideHTTPClient();
    request.setTimeoutMS(20000);
    request.setContentType("application/json");

    var backendUrl = gs.getProperty("ers.backend.url") || "http://localhost:5000";
    var endpoint = backendUrl + "/api/sn/classify";

    var payload = {
      text: textToClassify,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined
    };

    gs.info("📤 EMR: Calling " + endpoint + " with text: '" + textToClassify.substring(0, 80) + "...'");

    request.post(endpoint, JSON.stringify(payload));

    var status = request.getStatusCode();
    var response = request.getResponseBody();

    if (status !== 200) {
      gs.error("❌ EMR: Backend returned " + status + ": " + response);
      return;
    }

    var classification = {};
    try {
      classification = JSON.parse(response);
    } catch (e) {
      gs.error("❌ EMR: Failed to parse classification response: " + e.message);
      return;
    }

    gs.info("✅ EMR: Groq classified as: " + classification.type + " / " + classification.severity);

    // ─── STEP 2: Write AI results back to the incident ──────────────────

    if (classification.type) {
      current.u_emergency_type = classification.type;
    }

    if (classification.severity) {
      current.u_severity = classification.severity;
    }

    if (classification.summary) {
      current.u_ai_summary = classification.summary;
    }

    current.u_ai_classification = JSON.stringify(classification);

    if (classification.district) {
      current.u_district = classification.district;
    }

    // Map severity to priority
    var priorityMap = {
      "Critical": 1,
      "High": 2,
      "Medium": 3,
      "Low": 4
    };
    current.priority = priorityMap[classification.severity] || 3;

    current.update();

    // ─── STEP 3: Route to correct officer ────────────────────────────────

    gs.info("📍 EMR: " + current.number +
            " → Type: " + classification.type +
            " | Severity: " + classification.severity +
            " | District: " + (classification.district || "Not specified"));

  } catch (err) {
    gs.error("❌ EMR Error: " + err.message + " (at line " + err.lineNumber + ")");
  }

})(current, previous);
