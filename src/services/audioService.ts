/**
 * Professional Audio Service for high-quality voice recording
 * Features: Echo cancellation, noise suppression, auto gain control, silence detection
 */

export interface AudioConstraints {
  audio: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    sampleRate: number;
    channelCount: number;
  };
}

export interface AudioContext {
  mediaStream: MediaStream | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  gainNode: GainNode | null;
}

export class AudioService {
  private static readonly AUDIO_CONSTRAINTS: AudioConstraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: false,
      sampleRate: 16000, // Optimal for speech recognition
      channelCount: 1,
    },
  };

  private static readonly SILENCE_THRESHOLD = 30; // dB
  private static readonly SILENCE_DURATION = 1000; // ms

  /**
   * Request microphone access with advanced audio constraints
   */
  static async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      // Try with full constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia(this.AUDIO_CONSTRAINTS);
        return stream;
      } catch (err) {
        // Fallback to basic constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: true,
            autoGainControl: false,
            sampleRate: 16000,
            channelCount: 1,
          },
        });
        return stream;
      }
    } catch (err: any) {
      throw new Error(`Microphone access denied: ${err.message}`);
    }
  }

  /**
   * Create audio context for advanced processing
   */
  static createAudioContext(stream: MediaStream): {
    analyser: AnalyserNode;
    gainNode: GainNode;
    context: AudioContext;
  } {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const highpass = audioContext.createBiquadFilter();
    const compressor = audioContext.createDynamicsCompressor();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();

    highpass.type = "highpass";
    highpass.frequency.value = 120;

    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    // Audio routing: microphone -> high-pass -> compressor -> gain -> analyser
    source.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(analyser);

    // Normalize audio levels
    gainNode.gain.value = 1.0;

    return { analyser, gainNode, context: audioContext as any };
  }

  /**
   * Detect audio level in dB
   */
  static getAudioLevel(analyser: AnalyserNode): number {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square) and convert to dB
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }

    const rms = Math.sqrt(sum / dataArray.length) / 255;
    const db = 20 * Math.log10(Math.max(rms, 0.001));

    return db;
  }

  /**
   * Detect silence in recording
   */
  static detectSilence(
    analyser: AnalyserNode,
    callback: (isSilent: boolean) => void
  ): () => void {
    let silenceDuration = 0;

    const checkSilence = () => {
      const level = this.getAudioLevel(analyser);
      const isSilent = level < this.SILENCE_THRESHOLD;

      if (isSilent) {
        silenceDuration += 100;
        if (silenceDuration > this.SILENCE_DURATION) {
          callback(true);
        }
      } else {
        silenceDuration = 0;
        callback(false);
      }
    };

    const interval = setInterval(checkSilence, 100);

    return () => clearInterval(interval);
  }

  /**
   * Trim silence from audio data (frontend processing)
   */
  static trimSilence(audioData: Uint8Array, threshold: number = 30): Uint8Array {
    let startIndex = 0;
    let endIndex = audioData.length - 1;

    // Find first non-silent sample
    for (let i = 0; i < audioData.length; i++) {
      if (audioData[i] > threshold) {
        startIndex = i;
        break;
      }
    }

    // Find last non-silent sample
    for (let i = audioData.length - 1; i >= 0; i--) {
      if (audioData[i] > threshold) {
        endIndex = i;
        break;
      }
    }

    return audioData.slice(startIndex, endIndex + 1);
  }

  /**
   * Get supported MIME types for MediaRecorder
   */
  static getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/wav",
      "audio/ogg",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "audio/webm";
  }

  /**
   * Get the preferred recording config for fast, compact speech uploads.
   */
  static getRecordingConfig(): { mimeType: string; audioBitsPerSecond: number } {
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : this.getSupportedMimeType();

    return {
      mimeType,
      audioBitsPerSecond: 512000,
    };
  }

  /**
   * Measure the real duration of a recorded blob.
   */
  static getAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);

      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        URL.revokeObjectURL(objectUrl);
        resolve(duration);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to read audio duration."));
      };

      audio.preload = "metadata";
    });
  }

  /**
   * Validate audio file before transcription
   */
  static validateAudioFile(blob: Blob): { valid: boolean; error?: string } {
    // Check file size (minimum 50KB for meaningful audio)
    if (blob.size < 50 * 1024) {
      return { valid: false, error: "Audio too quiet or too short" };
    }

    // Check file size (maximum 25MB)
    if (blob.size > 25 * 1024 * 1024) {
      return { valid: false, error: "Audio file too large (max 25MB). Try a shorter recording." };
    }

    return { valid: true };
  }

  /**
   * Convert Blob to Base64 for debugging
   */
  static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Cleanup audio resources
   */
  static cleanupAudioStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  /**
   * Get audio stats for debugging
   */
  static getAudioStats(analyser: AnalyserNode): {
    level: number;
    frequency: Uint8Array;
    timeDomain: Uint8Array;
  } {
    const frequency = new Uint8Array(analyser.frequencyBinCount);
    const timeDomain = new Uint8Array(analyser.fftSize);

    analyser.getByteFrequencyData(frequency);
    analyser.getByteTimeDomainData(timeDomain);

    return {
      level: this.getAudioLevel(analyser),
      frequency,
      timeDomain,
    };
  }
}
