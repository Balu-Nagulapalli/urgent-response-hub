const BACKEND_URL = "http://localhost:5000";
const TRANSCRIPTION_TIMEOUT_MS = 30000;

export type TranscriptionStage = "uploading" | "transcribing";

export interface TranscriptionResult {
  text: string;
  durationMs?: number;
  sizeKB?: number;
}

export interface TranscriptionServiceOptions {
  signal?: AbortSignal;
  onStageChange?: (stage: TranscriptionStage) => void;
}

export interface TranscriptionFailure extends Error {
  code?: string;
  status?: number;
  retryable?: boolean;
}

function createFailure(message: string, code?: string, status?: number, retryable = false): TranscriptionFailure {
  const error = new Error(message) as TranscriptionFailure;
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  return error;
}

function extractMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const value = payload as Record<string, unknown>;
  return String(
    value.details || value.message || value.error || value.title || ""
  ).trim();
}

export function isRetryableTranscriptionError(error: unknown): boolean {
  const failure = error as TranscriptionFailure;

  if (failure?.retryable !== undefined) {
    return Boolean(failure.retryable);
  }

  if (failure?.code === "configuration_error") {
    return false;
  }

  if (failure?.code === "validation_error" || failure?.code === "unsupported_audio" || failure?.code === "empty_audio") {
    return false;
  }

  if (failure?.status && failure.status >= 400 && failure.status < 500 && failure.status !== 429) {
    return false;
  }

  if (failure?.message?.includes("Voice service is not configured")) {
    return false;
  }

  return true;
}

export function mapTranscriptionError(error: unknown): string {
  const failure = error as TranscriptionFailure;
  const message = failure?.message || "";

  if (failure?.name === "AbortError" || message.toLowerCase().includes("timeout")) {
    return "Transcription timeout";
  }

  if (failure?.code === "configuration_error" || message.includes("Voice service is not configured")) {
    return "Voice service is not configured";
  }

  if (failure?.code === "unsupported_audio") {
    return "Audio recording failed";
  }

  if (failure?.code === "empty_audio" || failure?.code === "validation_error") {
    return message || "Audio recording failed";
  }

  if (failure?.status === 503) {
    return "Server unavailable";
  }

  if (failure?.status === 500) {
    return "Server unavailable";
  }

  if (message.toLowerCase().includes("network") || message.toLowerCase().includes("failed to fetch")) {
    return "Server unavailable";
  }

  return message || "Audio recording failed";
}

export async function transcribeAudio(
  audioBlob: Blob,
  options: TranscriptionServiceOptions = {}
): Promise<TranscriptionResult> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  const timeoutId = window.setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);

  const formData = new FormData();
  formData.append("file", audioBlob, "voice-input.webm");
  formData.append("language", "en");

  options.onStageChange?.("uploading");

  try {
    const response = await fetch(`${BACKEND_URL}/speech-to-text`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    options.onStageChange?.("transcribing");

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const details = extractMessage(payload);
      const code = typeof payload === "object" && payload ? String((payload as Record<string, unknown>).code || "") : "";
      const retryable = Boolean((payload as Record<string, unknown>)?.retryable);
      throw createFailure(
        details || `API error: ${response.status}`,
        code || (response.status === 503 ? "configuration_error" : "http_error"),
        response.status,
        retryable || response.status === 429 || response.status >= 500
      );
    }

    const data = (await response.json()) as TranscriptionResult & { error?: string; details?: string };
    const text = (data.text || "").trim();

    if (!text) {
      throw createFailure("Audio recording failed", "empty_audio", 422, false);
    }

    return {
      text,
      durationMs: data.durationMs,
      sizeKB: data.sizeKB,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw createFailure("Transcription timeout", "timeout", 408, true);
    }

    if (error instanceof Error) {
      throw createFailure(error.message, (error as TranscriptionFailure).code, (error as TranscriptionFailure).status, (error as TranscriptionFailure).retryable ?? false);
    }

    throw createFailure("Audio recording failed", "unknown_error", undefined, false);
  } finally {
    window.clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener("abort", abortFromCaller);
    }
  }
}
