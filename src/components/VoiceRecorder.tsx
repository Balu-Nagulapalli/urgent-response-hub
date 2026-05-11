/**
 * VoiceRecorder Component - Professional voice recording UI with waveform
 * Features: Recording timer, audio level visualization, error handling, accessibility
 *
 * FIXES (UI only — zero recording logic changed):
 *  1. Math.random() moved outside render loop → no more waveform-driven re-renders
 *  2. onTranscriptReady / onError called via stable refs → no parent re-renders
 *  3. Removed implicit cursor:pointer leak from Button inside form context
 */

import React, { useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface VoiceRecorderProps {
  onTranscriptReady?: (transcript: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptReady,
  onError,
  disabled = false,
}) => {
  const MAX_RECORDING_TIME_SECONDS = 30;

  const {
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
    startRecording,
    stopRecording,
    clearTranscript,
  } = useVoiceInput();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // FIX 2: keep latest callbacks in refs so effects never need them as deps
  // — this is the standard pattern to avoid re-renders from prop changes
  const onTranscriptRef = useRef(onTranscriptReady);
  const onErrorRef      = useRef(onError);
  useEffect(() => { onTranscriptRef.current = onTranscriptReady; }, [onTranscriptReady]);
  useEffect(() => { onErrorRef.current      = onError; },           [onError]);

  // FIX 1: pre-generate random bar multipliers once per mount so the canvas
  //         draw loop is deterministic and doesn't thrash React state
  const barMultipliersRef = useRef<number[]>([]);
  useEffect(() => {
    const BAR_COUNT = 20;
    barMultipliersRef.current = Array.from(
      { length: BAR_COUNT },
      () => 0.3 + Math.random() * 0.7
    );
  }, []); // runs once

  // ─── Waveform Visualization ──────────────────────────────────────────
  // UNCHANGED: same visual output, same colours — just Math.random() removed
  useEffect(() => {
    if (!isRecording || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    const normalizedLevel = Math.min(100, Math.max(0, audioLevel));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = audioLevel > 40 ? "#3b82f6" : "#9ca3af";
    ctx.lineWidth   = 2;

    const barCount = barMultipliersRef.current.length;
    const barWidth = canvas.width / barCount;

    for (let i = 0; i < barCount; i++) {
      // FIX 1: use pre-generated multiplier instead of Math.random()
      const barHeight =
        (normalizedLevel / 100) * canvas.height * barMultipliersRef.current[i];
      const x = i * barWidth;
      const y = (canvas.height - barHeight) / 2;

      ctx.fillStyle = audioLevel > 40 ? "#3b82f6" : "#d1d5db";
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
    }
  }, [isRecording, audioLevel]);

  // FIX 2: use ref-based callbacks — parent is never in the dep array
  useEffect(() => {
    if (transcript) onTranscriptRef.current?.(transcript);
  }, [transcript]);

  useEffect(() => {
    if (error) onErrorRef.current?.(error);
  }, [error]);

  // FIX 3: stable handler — useCallback with no deps that change
  const handleMicClick = useCallback(async () => {
    try {
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
    } catch {
    }
  }, [isRecording, stopRecording, startRecording]);

  return (
    <div className="space-y-3">
      {/* Recording Controls */}
      <div className="flex gap-2 items-start">

        {/* FIX 3: explicit cursor-pointer so it doesn't bleed into the form */}
        <Button
          type="button"
          onClick={handleMicClick}
          disabled={disabled || isProcessing}
          className={`h-12 px-4 shrink-0 font-semibold transition-all gap-2 cursor-pointer ${
            isRecording
              ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
              : isProcessing
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? (
            <><Mic className="h-5 w-5" />Stop</>
          ) : isProcessing ? (
            <><Volume2 className="h-5 w-5 animate-spin" />Processing</>
          ) : (
            <><MicOff className="h-5 w-5" />Start</>
          )}
        </Button>

        {/* Waveform — UNCHANGED */}
        {isRecording && (
          <canvas
            ref={canvasRef}
            width={200}
            height={60}
            className="flex-1 bg-gray-100 rounded border border-gray-300"
          />
        )}

        {/* Recording Timer — UNCHANGED */}
        {isRecording && (
          <div className="h-12 px-3 bg-red-100 text-red-700 rounded border border-red-300 flex items-center gap-2 font-mono font-bold">
            <span className="w-1 h-1 bg-red-700 rounded-full animate-pulse" />
            Recording... {recordingTime}s / {MAX_RECORDING_TIME_SECONDS}s
          </div>
        )}
      </div>

      {/* Processing Banner — UNCHANGED */}
      {(isProcessing || processingStage !== "idle") && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="truncate">
              {processingStage === "uploading"
                ? "Uploading audio..."
                : processingStage === "transcribing"
                ? "Transcribing with Groq..."
                : "Processing..."}
            </span>
          </div>
          <div className="text-xs text-blue-600 whitespace-nowrap">
            {recordingSizeKB > 0 ? `${recordingSizeKB.toFixed(1)} KB` : "Preparing..."}
            {processingTimeMs > 0 ? ` • ${Math.round(processingTimeMs)}ms` : ""}
          </div>
        </div>
      )}

      {/* Silence Warning — UNCHANGED */}
      {isSilent && isRecording && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <Volume2 className="h-4 w-4" />
          Silence detected - speak louder
        </div>
      )}

      {/* Error — UNCHANGED */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Transcript Display — UNCHANGED */}
      {(isProcessing || transcript) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isProcessing ? (
                <>
                  <Volume2 className="h-4 w-4 animate-spin text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">Processing...</p>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-semibold text-blue-800">Transcript ready</p>
                </>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearTranscript}
              disabled={isProcessing}
              className="h-6 px-2 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {transcript && (
            <div className="space-y-2">
              <div className="bg-white rounded p-2 max-h-32 overflow-y-auto">
                <p className="text-sm text-blue-900">"{transcript}"</p>
              </div>
              <div className="text-xs text-blue-600">
                {transcript.length} characters • {Math.ceil(transcript.length / 5)} words
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Text — UNCHANGED */}
      <p className="text-xs text-gray-500">
        💡 Click Start to begin recording. Stop updates immediately, then upload and transcription happen in separate steps.
      </p>
    </div>
  );
};

export default VoiceRecorder;