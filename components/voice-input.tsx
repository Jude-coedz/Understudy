"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onVoiceUsed?: () => void;
  disabled?: boolean;
};

function appendTranscript(base: string, speech: string) {
  const left = base.trimEnd();
  const right = speech.trim();
  if (!right) return left;
  return left ? `${left} ${right}` : right;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.25" y="1.75" width="5.5" height="8" rx="2.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M3.5 7.75A4.5 4.5 0 0 0 12.5 7.75M8 12.25V14M5.75 14h4.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function VoiceInput({ value, onChange, onListeningChange, onVoiceUsed, disabled = false }: Props) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const wantsToListenRef = useRef(false);
  const fatalErrorRef = useRef(false);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const voiceUsedRef = useRef(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  function publishListening(next: boolean) {
    setListening(next);
    onListeningChange?.(next);
  }

  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));

    return () => {
      wantsToListenRef.current = false;
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
      }
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      onListeningChange?.(false);
    };
  }, []);

  useEffect(() => {
    if (!listening) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  function stop() {
    wantsToListenRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    publishListening(false);
  }

  function startRecognition(recognition: SpeechRecognitionLike) {
    try {
      recognition.start();
      publishListening(true);
    } catch {
      wantsToListenRef.current = false;
      recognitionRef.current = null;
      publishListening(false);
      setError("Voice transcription could not start. You can keep typing or try again.");
    }
  }

  function start() {
    if (disabled || listening) return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    baseTextRef.current = value;
    finalTranscriptRef.current = "";
    voiceUsedRef.current = false;
    wantsToListenRef.current = true;
    fatalErrorRef.current = false;
    setElapsed(0);
    setError("");

    recognition.onresult = (event) => {
      setError("");
      let finalChunk = "";
      let interimChunk = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;

        if (!voiceUsedRef.current) {
          voiceUsedRef.current = true;
          onVoiceUsed?.();
        }

        if (result.isFinal) {
          finalChunk = appendTranscript(finalChunk, transcript);
        } else {
          interimChunk = appendTranscript(interimChunk, transcript);
        }
      }

      if (finalChunk) {
        finalTranscriptRef.current = appendTranscript(finalTranscriptRef.current, finalChunk);
      }

      const captured = appendTranscript(finalTranscriptRef.current, interimChunk);
      onChange(appendTranscript(baseTextRef.current, captured));
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;

      const fatal =
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture";

      fatalErrorRef.current = fatal;
      if (fatal) wantsToListenRef.current = false;

      const message =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was blocked. Allow microphone access in your browser and try again."
          : event.error === "audio-capture"
            ? "Understudy could not access a microphone. Check your input device and try again."
            : event.error === "no-speech"
              ? "No speech was detected. Keep speaking or stop when you are done."
              : event.error === "network"
                ? "Voice transcription lost its connection. Understudy will try to resume."
                : "Voice transcription paused unexpectedly. Understudy will try to resume.";

      setError(message);

      if (fatal) {
        publishListening(false);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      if (!wantsToListenRef.current || fatalErrorRef.current) {
        publishListening(false);
        return;
      }

      restartTimerRef.current = window.setTimeout(() => {
        if (!wantsToListenRef.current) return;
        recognitionRef.current = recognition;
        startRecognition(recognition);
      }, 250);
    };

    recognitionRef.current = recognition;
    startRecognition(recognition);
  }

  if (supported === null) {
    return <span className="text-xs text-faint">Checking voice input…</span>;
  }

  if (!supported) {
    return (
      <span className="text-xs text-faint" title="Voice input depends on browser speech recognition support.">
        Voice input is not available in this browser
      </span>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          listening
            ? "border-accent/30 bg-accent/10 text-accent"
            : "border-border bg-card text-muted hover:border-border-strong hover:bg-card-hover"
        }`}
      >
        {listening ? <StopIcon /> : <MicIcon />}
        {listening ? "Stop" : "Speak answer"}
      </button>

      {listening && (
        <span className="flex min-w-0 items-center gap-2 text-xs text-subtle" aria-live="polite">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
          <span>Listening</span>
          <span className="font-mono text-faint">{formatDuration(elapsed)}</span>
        </span>
      )}

      {error && <span className="min-w-0 text-xs leading-5 text-warning">{error}</span>}
    </div>
  );
}
