"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { normalizeVoiceTranscript } from "@/lib/voice-transcript";

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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.2" y="1.6" width="5.6" height="8.1" rx="2.8" stroke="currentColor" strokeWidth="1.35" />
      <path d="M3.45 7.6A4.55 4.55 0 0 0 12.55 7.6M8 12.15V14M5.7 14h4.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="4" y="4" width="8" height="8" rx="1.7" fill="currentColor" />
    </svg>
  );
}

export function VoiceInput({ value, onChange, onListeningChange, onVoiceUsed, disabled = false }: Props) {
  const reducedMotion = useReducedMotion();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const wantsToListenRef = useRef(false);
  const fatalErrorRef = useRef(false);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const voiceUsedRef = useRef(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [language, setLanguage] = useState("auto");
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
    recognition.lang = language === "auto" ? navigator.language || "en-US" : language;

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

      const rawCaptured = appendTranscript(finalTranscriptRef.current, interimChunk);
      const formattedCaptured = normalizeVoiceTranscript(rawCaptured);
      onChange(appendTranscript(baseTextRef.current, formattedCaptured));
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
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <motion.button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : "Start dictation"}
        whileHover={reducedMotion || disabled ? undefined : { y: -1.5, scale: 1.015 }}
        whileTap={reducedMotion || disabled ? undefined : { y: 0, scale: 0.965 }}
        transition={{ type: "spring", stiffness: 430, damping: 28, mass: 0.6 }}
        className={`liquid-action relative inline-flex h-9 shrink-0 items-center gap-2.5 overflow-hidden rounded-xl px-3.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
          listening ? "liquid-action-recording text-accent-hover" : "text-muted"
        }`}
      >
        <span className="relative grid h-5 w-5 place-items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={listening ? "stop" : "mic"}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.65, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.65, rotate: 8 }}
              transition={{ duration: 0.14 }}
              className="absolute inset-0 grid place-items-center"
            >
              {listening ? <StopIcon /> : <MicIcon />}
            </motion.span>
          </AnimatePresence>

          {listening && (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-full border border-accent/35"
              animate={reducedMotion ? { opacity: 0 } : { scale: [1, 1.7], opacity: [0.6, 0] }}
              transition={{ duration: 1.35, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </span>

        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={listening ? "stop-label" : "dictate-label"}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            {listening ? "Stop" : "Dictate"}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {!listening && (
        <label className="flex items-center gap-1.5 text-xs text-faint">
          <span className="sr-only">Speech language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            disabled={disabled}
            className="glass-select h-9 rounded-xl px-2.5 text-xs text-subtle outline-none disabled:opacity-40"
            title="Speech language hint"
          >
            <option value="auto">Language: Auto</option>
            <option value="en-NG">English (Nigeria)</option>
            <option value="en-GB">English (UK)</option>
            <option value="en-US">English (US)</option>
          </select>
        </label>
      )}

      <AnimatePresence initial={false}>
        {listening && (
          <motion.span
            initial={reducedMotion ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
            className="flex min-w-0 items-center gap-2 text-xs text-subtle"
            aria-live="polite"
          >
            <motion.span
              className="h-2 w-2 shrink-0 rounded-full bg-accent"
              animate={reducedMotion ? undefined : { opacity: [0.4, 1, 0.4], scale: [0.92, 1.08, 0.92] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span>Listening</span>
            <span className="font-mono text-faint">{formatDuration(elapsed)}</span>
          </motion.span>
        )}
      </AnimatePresence>

      {error && <span className="min-w-0 text-xs leading-5 text-warning">{error}</span>}
    </div>
  );
}
