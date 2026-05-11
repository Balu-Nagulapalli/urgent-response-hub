/**
 * useVoiceInput - Professional React hook for voice recording with GROQ transcription
 * Features: Advanced audio processing, error handling, retry logic, debugging
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { AudioService } from "@/services/audioService";
import { isRetryableTranscriptionError, mapTranscriptionError, transcribeAudio } from "@/services/transcriptionService";

export interface VoiceInputState {
  isRecording: boolean;
  isProcessing: boolean;
  processingStage: "idle" | "uploading" | "transcribing";
  recordingTime: number;
  transcript: string;
  error: string;
  audioLevel: number;
  isSilent: boolean;
  recordingSizeKB: number;
  processingTimeMs: number;
}

export interface VoiceInputActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearTranscript: () => void;
  reset: () => void;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // ms
const MAX_RECORDING_TIME = 30000; // 30 seconds
const RECORDING_TIMESLICE_MS = 1000;
const DEBUG_PLAY_RAW_AUDIO = false;

async function playRawAudioPreview(audioBlob: Blob): Promise<void> {
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  audio.onended = () => {
    URL.revokeObjectURL(audioUrl);
  };

  audio.onerror = () => {
    URL.revokeObjectURL(audioUrl);
  };

  try {
    await audio.play();
  } catch (error) {
    URL.revokeObjectURL(audioUrl);
  }
}

export function useVoiceInput(): VoiceInputState & VoiceInputActions {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<"idle" | "uploading" | "transcribing">("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSilent, setIsSilent] = useState(false);
  const [recordingSizeKB, setRecordingSizeKB] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState(0);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBytesRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceDetectorRef = useRef<(() => void) | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderReadyRef = useRef<Promise<void> | null>(null);
  const stopResolveRef = useRef<((blob: Blob) => void) | null>(null);
  const stopRejectRef = useRef<((error: Error) => void) | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const processingStartedAtRef = useRef<number>(0);
  const isStoppingRef = useRef(false);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const initializeMicrophone = useCallback(async () => {
    if (mediaRecorderRef.current) {
      return;
    }

    const stream = await AudioService.requestMicrophoneAccess();
    mediaStreamRef.current = stream;

    const recordingConfig = AudioService.getRecordingConfig();
    const recorder = new MediaRecorder(stream, recordingConfig);

    recorder.onstart = () => {
      audioChunksRef.current = [];
      recordedBytesRef.current = 0;
      setIsRecording(true);
      setRecordingTime(0);
      setError("");
      setTranscript("");
      setAudioLevel(0);
      setRecordingSizeKB(0);
      setProcessingTimeMs(0);
      setProcessingStage("idle");
      setIsSilent(false);
      recordingStartTimeRef.current = Date.now();

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }

      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_TIME);
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
        recordedBytesRef.current += event.data.size;
        setRecordingSizeKB(recordedBytesRef.current / 1024);
      }
    };

    recorder.onstop = () => {
      setIsRecording(false);

      if (silenceDetectorRef.current) {
        silenceDetectorRef.current();
        silenceDetectorRef.current = null;
      }

      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      const mimeType = AudioService.getRecordingConfig().mimeType;
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      const resolveStop = stopResolveRef.current;
      const rejectStop = stopRejectRef.current;
      stopResolveRef.current = null;
      stopRejectRef.current = null;

      if (resolveStop) {
        resolveStop(audioBlob);
      } else if (rejectStop) {
        rejectStop(new Error("Recording stop promise was not initialized."));
      }
    };

    recorder.onerror = (event) => {
      setError(`Recording error: ${event.error}`);
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;

    try {
      const { analyser } = AudioService.createAudioContext(stream);
      analyserRef.current = analyser;
    } catch (err) {
      // Audio analysis failed, but recording can still proceed
    }
  }, []);

  // ─── Initialize Microphone ─────────────────────────────────────────────
  useEffect(() => {
    // Cleanup
    return () => {
      if (mediaStreamRef.current) {
        AudioService.cleanupAudioStream(mediaStreamRef.current);
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (transcriptionAbortRef.current) {
        transcriptionAbortRef.current.abort();
      }
    };
  }, []);

  // ─── Recording Timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // ─── Start Recording ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing || isStoppingRef.current) {
      return;
    }

    try {
      await initializeMicrophone();

      if (!mediaRecorderRef.current) {
        setError("Microphone not initialized. Please refresh the page.");
        return;
      }

      console.log("▶️ [useVoiceInput] Starting recording...");
      audioChunksRef.current = [];
      recordedBytesRef.current = 0;
      setRecordingSizeKB(0);
      setProcessingStage("idle");
      setProcessingTimeMs(0);
      setError("");

      // Setup silence detection
      if (analyserRef.current) {
        silenceDetectorRef.current = AudioService.detectSilence(
          analyserRef.current,
          (isSilent) => {
            setIsSilent(isSilent);
            if (isSilent && recordingTime > 2) {
              console.warn("🔇 [useVoiceInput] Silence detected after 2 seconds of recording");
            }
          }
        );
      }

      mediaRecorderRef.current.start(RECORDING_TIMESLICE_MS);
    } catch (err: any) {
      console.error("❌ [useVoiceInput] Failed to start recording:", err.message);
      setError(`Failed to start recording: ${err.message}`);
    }
  }, [initializeMicrophone, isProcessing, isRecording]);

  // ─── Transcribe with GROQ (with retry logic) ──────────────────────────
  const transcribeWithGROQ = useCallback(
    async (audioBlob: Blob, attempt: number = 1): Promise<string> => {
      try {
        console.log(`📤 [useVoiceInput] Transcribing audio (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})...`);

        const validation = AudioService.validateAudioFile(audioBlob);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        console.log(`📊 [useVoiceInput] Recording duration: ${Date.now() - (recordingStartTimeRef.current ?? Date.now())}ms`);
        console.log(`📊 [useVoiceInput] Audio blob size: ${audioBlob.size} bytes`);

        transcriptionAbortRef.current?.abort();
        transcriptionAbortRef.current = new AbortController();

        const result = await transcribeAudio(audioBlob, {
          signal: transcriptionAbortRef.current.signal,
          onStageChange: (stage) => setProcessingStage(stage),
        });

        console.log(`✅ [useVoiceInput] Transcription successful: "${result.text}"`);
        return result.text;
      } catch (err: any) {
        console.error(
          `❌ [useVoiceInput] Transcription failed (attempt ${attempt}):`,
          err.message
        );

        if (attempt < MAX_RETRY_ATTEMPTS && isRetryableTranscriptionError(err)) {
          console.log(
            `⏳ [useVoiceInput] Retrying in ${RETRY_DELAY}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return transcribeWithGROQ(audioBlob, attempt + 1);
        }

        throw err;
      }
    },
    []
  );

  // ─── Stop Recording ───────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || (!isRecording && !isStoppingRef.current)) {
      return;
    }

    try {
      if (isStoppingRef.current) {
        return;
      }

      console.log("⏹️ [useVoiceInput] Stopping recording...");
      isStoppingRef.current = true;
      setIsProcessing(true);
      setProcessingStage("uploading");
      processingStartedAtRef.current = performance.now();
      setError("");

      const stopPromise = new Promise<Blob>((resolve, reject) => {
        stopResolveRef.current = resolve;
        stopRejectRef.current = reject;
      });

      mediaRecorderRef.current.stop();
      const stopGracePromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });

      await stopGracePromise;
      const audioBlob = await stopPromise;

      const recordingDurationMs = Date.now() - (recordingStartTimeRef.current ?? Date.now());


      const realDurationSeconds = await AudioService.getAudioDuration(audioBlob).catch(() => 0);
      const safeDurationSeconds = realDurationSeconds > 0 ? realDurationSeconds : recordingDurationMs / 1000;

      if (realDurationSeconds <= 0) {
        console.warn(
          `⚠️ [useVoiceInput] Browser metadata reported ${realDurationSeconds.toFixed(2)}s; using recording timer fallback.`
        );
      }

      console.log(`📏 [useVoiceInput] Real audio duration: ${safeDurationSeconds.toFixed(2)}s`);
      console.log(`📦 [useVoiceInput] Audio blob size: ${audioBlob.size} bytes`);

      if (DEBUG_PLAY_RAW_AUDIO) {
        void playRawAudioPreview(audioBlob);
      }

      const uploadStart = performance.now();
      setProcessingStage("transcribing");

      console.log(
        `🚀 [useVoiceInput] Upload starting. Size: ${(audioBlob.size / 1024).toFixed(2)} KB`
      );

      const uploadDuration = performance.now() - uploadStart;
      console.log(`📤 [useVoiceInput] Upload stage completed in ${uploadDuration.toFixed(0)}ms`);

      const transcriptionStart = performance.now();
      const transcribedText = await transcribeWithGROQ(audioBlob);
      setTranscript(transcribedText);
      setProcessingTimeMs(performance.now() - processingStartedAtRef.current);

      console.log(
        `✅ [useVoiceInput] Recording and transcription complete in ${(performance.now() - processingStartedAtRef.current).toFixed(0)}ms`
      );
      console.log(
        `📊 [useVoiceInput] Groq transcription duration: ${(performance.now() - transcriptionStart).toFixed(0)}ms`
      );
    } catch (err: any) {
      const message = mapTranscriptionError(err);

      console.error("❌ [useVoiceInput] Error stopping recording:", message);
      setError(message);
    } finally {
      setIsProcessing(false);
      setProcessingStage("idle");
      isStoppingRef.current = false;
      setProcessingTimeMs(performance.now() - processingStartedAtRef.current);
      transcriptionAbortRef.current = null;
    }
  }, [isRecording, transcribeWithGROQ]);

  // ─── Clear Transcript ────────────────────────────────────────────────
  const clearTranscript = useCallback(() => {
    console.log("🧹 [useVoiceInput] Clearing transcript");
    setTranscript("");
    setError("");
  }, []);

  // ─── Reset All State ────────────────────────────────────────────────
  const reset = useCallback(() => {
    console.log("🔄 [useVoiceInput] Resetting all state");
    transcriptionAbortRef.current?.abort();
    setIsRecording(false);
    setIsProcessing(false);
    setProcessingStage("idle");
    setRecordingTime(0);
    setTranscript("");
    setError("");
    setAudioLevel(0);
    setIsSilent(false);
    setRecordingSizeKB(0);
    setProcessingTimeMs(0);
    audioChunksRef.current = [];
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  return {
    // State
    isRecording,
    isProcessing,
    processingStage,
    recordingTime,
    transcript,
    error,
    audioLevel,
    isSilent,
    recordingSizeKB,
    processingTimeMs,
    // Actions
    startRecording,
    stopRecording,
    clearTranscript,
    reset,
  };
}
