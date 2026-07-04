import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Strip markdown so TTS reads "rupees 47 50 000" instead of "asterisk asterisk rupees…"
const stripMarkdown = (text) =>
    String(text)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // [label](url) → label
        .replace(/\*\*([^*]+)\*\*/g, "$1")        // **bold**
        .replace(/\*([^*]+)\*/g, "$1")            // *italic*
        .replace(/`([^`]+)`/g, "$1")              // `code`
        .replace(/^\s*[-*]\s+/gm, "")             // - bullet
        .replace(/^\s*#{1,6}\s+/gm, "")           // # heading
        .replace(/₹/g, "rupees ")                 // pronounce currency symbol
        .replace(/\s+/g, " ")
        .trim();

export function useSpeechRecognition({ onResult, onError } = {}) {
    const SR = useMemo(
        () => (typeof window !== "undefined") && (window.SpeechRecognition || window.webkitSpeechRecognition),
        [],
    );
    const supported = Boolean(SR);
    const [listening, setListening] = useState(false);
    const recRef = useRef(null);
    const retriedRef = useRef(false); // one silent retry per session for transient "network" errors
    const startRef = useRef(null);    // holds latest start() so the retry can re-invoke it

    // Keep latest callbacks in refs so start() stays stable
    const onResultRef = useRef(onResult);
    const onErrorRef  = useRef(onError);
    useEffect(() => { onResultRef.current = onResult; onErrorRef.current = onError; });

    const start = useCallback(() => {
        if (!supported || listening) return;
        const rec = new SR();
        rec.continuous     = false;
        rec.interimResults = true;
        rec.lang           = "en-IN"; // bias to Indian English; falls back to default if unsupported

        rec.onresult = (e) => {
            retriedRef.current = false; // recognition is working; allow future retries
            let interim = "", final = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) final += r[0].transcript;
                else           interim += r[0].transcript;
            }
            onResultRef.current?.({ interim, final });
        };
        rec.onerror = (e) => {
            const err = e.error || "unknown";
            // The Web Speech backend occasionally drops the first connection. Retry
            // once transparently before bubbling the error up to the user.
            if (err === "network" && !retriedRef.current) {
                retriedRef.current = true;
                recRef.current = null;
                setListening(false);
                setTimeout(() => startRef.current?.(), 400);
                return;
            }
            onErrorRef.current?.(err);
        };
        rec.onend   = () => setListening(false);

        try {
            rec.start();
            recRef.current = rec;
            setListening(true);
        } catch (err) {
            onErrorRef.current?.(err.message || "failed-to-start");
        }
    }, [SR, supported, listening]);

    useEffect(() => { startRef.current = start; }, [start]);

    const stop = useCallback(() => {
        recRef.current?.stop();
        recRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => () => { recRef.current?.stop(); }, []);

    return { supported, listening, start, stop };
}

// Server-side dictation: record the mic with MediaRecorder and hand the audio
// blob to the caller (which uploads it to /assistant/transcribe → Whisper).
// Unlike Web Speech, this works in every browser and doesn't need Google's
// speech backend — only microphone permission.
export function useVoiceRecorder({ onAudio, onError } = {}) {
    const supported = typeof window !== "undefined"
        && !!navigator.mediaDevices?.getUserMedia
        && typeof window.MediaRecorder !== "undefined";

    const [recording, setRecording] = useState(false);
    const recorderRef = useRef(null);
    const chunksRef   = useRef([]);
    const streamRef   = useRef(null);

    const onAudioRef = useRef(onAudio);
    const onErrorRef = useRef(onError);
    useEffect(() => { onAudioRef.current = onAudio; onErrorRef.current = onError; });

    const stop = useCallback(() => {
        try { recorderRef.current?.state !== "inactive" && recorderRef.current?.stop(); }
        catch { /* already stopped */ }
    }, []);

    const start = useCallback(async () => {
        if (!supported || recording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const rec = new MediaRecorder(stream);
            chunksRef.current = [];

            rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
            rec.onstop = () => {
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                setRecording(false);
                const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
                chunksRef.current = [];
                if (blob.size) onAudioRef.current?.(blob);
            };

            rec.start();
            recorderRef.current = rec;
            setRecording(true);
        } catch (err) {
            const name = err?.name === "NotAllowedError" ? "not-allowed" : (err?.message || "failed-to-start");
            onErrorRef.current?.(name);
        }
    }, [supported, recording]);

    // Cleanup on unmount
    useEffect(() => () => {
        try { recorderRef.current?.stop(); } catch { /* noop */ }
        streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    return { supported, recording, start, stop };
}

export function useSpeechSynthesis() {
    const supported = typeof window !== "undefined" && "speechSynthesis" in window;
    const [speaking, setSpeaking] = useState(false);

    const speak = useCallback((text) => {
        if (!supported || !text) return;
        const cleaned = stripMarkdown(text);
        if (!cleaned) return;

        window.speechSynthesis.cancel(); // interrupt any prior utterance
        const utter   = new SpeechSynthesisUtterance(cleaned);
        utter.lang    = "en-IN";
        utter.rate    = 1.0;
        utter.pitch   = 1.0;
        utter.onstart = () => setSpeaking(true);
        utter.onend   = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utter);
    }, [supported]);

    const cancel = useCallback(() => {
        if (!supported) return;
        window.speechSynthesis.cancel();
        setSpeaking(false);
    }, [supported]);

    // Cancel any in-flight utterance when the consumer unmounts
    useEffect(() => () => {
        if (supported) window.speechSynthesis.cancel();
    }, [supported]);

    return { supported, speaking, speak, cancel };
}
