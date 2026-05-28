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
            let interim = "", final = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) final += r[0].transcript;
                else           interim += r[0].transcript;
            }
            onResultRef.current?.({ interim, final });
        };
        rec.onerror = (e) => onErrorRef.current?.(e.error || "unknown");
        rec.onend   = () => setListening(false);

        try {
            rec.start();
            recRef.current = rec;
            setListening(true);
        } catch (err) {
            onErrorRef.current?.(err.message || "failed-to-start");
        }
    }, [SR, supported, listening]);

    const stop = useCallback(() => {
        recRef.current?.stop();
        recRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => () => { recRef.current?.stop(); }, []);

    return { supported, listening, start, stop };
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
