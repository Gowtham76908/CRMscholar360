import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { Bot, X, Send, AlertCircle, Sparkles, Mic, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSpeechRecognition, useSpeechSynthesis } from "../hooks/useVoice";
import { cn } from "../lib/utils";

// Internal entity link schemes the LLM emits — clicking them navigates inside the SPA.
const ENTITY_HREF  = /^#(lead|deal|task)\/([a-zA-Z0-9_-]+)$/;
const ENTITY_PATHS = { lead: "/leads", deal: "/deals", task: "/tasks" };

const WELCOME = {
    role:    "assistant",
    content: "Hi! I can look up leads, tasks, and pipeline data. What would you like to know?",
};

const FRIENDLY_ERROR = {
    TIMEOUT:           "The assistant took too long to respond. Try again.",
    RATE_LIMITED:      "Too many requests. Please wait a moment.",
    PROVIDER_DOWN:     "The AI service is temporarily unavailable.",
    DISABLED:          "The assistant is currently disabled.",
    VALIDATION_ERROR:  "Please enter a message.",
};

export default function AssistantWidget() {
    const { user }      = useAuth();
    const { pathname }  = useLocation();
    const [open, setOpen]         = useState(false);
    const [messages, setMessages] = useState([WELCOME]);
    const [input, setInput]       = useState("");
    const [sending, setSending]   = useState(false);
    const [voiceOut, setVoiceOut] = useState(() => localStorage.getItem("asst-voice-out") === "true");
    const scrollRef = useRef(null);
    const inputRef  = useRef(null);
    // Tracks whether the *current* draft was dictated; reset on manual typing or send.
    const usedVoiceForCurrentDraft = useRef(false);

    // Voice input: append finalised transcript to whatever's already in the input
    const mic = useSpeechRecognition({
        onResult: ({ final }) => {
            if (final) {
                usedVoiceForCurrentDraft.current = true;
                setInput(prev => (prev ? `${prev.trim()} ${final}`.trim() : final.trim()));
            }
        },
        onError:  (err) => {
            if (err === "not-allowed") toast.error("Microphone access denied. Check browser permissions.");
            else if (err !== "aborted") toast.error(`Voice input failed: ${err}`);
        },
    });

    const tts = useSpeechSynthesis();

    // Auto-scroll on new message or while a reply is streaming in
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, sending]);

    // Focus the input when the panel opens
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    // Close on Esc while open
    useEffect(() => {
        if (!open) return;
        const handle = (e) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, [open]);

    // Stop in-flight speech if the widget closes or voice output is toggled off
    useEffect(() => {
        if (!open || !voiceOut) tts.cancel();
    }, [open, voiceOut, tts]);

    const toggleVoiceOut = () => {
        setVoiceOut(prev => {
            const next = !prev;
            localStorage.setItem("asst-voice-out", String(next));
            return next;
        });
    };

    if (!user) return null;

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || sending) return;

        if (mic.listening) mic.stop();
        tts.cancel(); // user starting a new turn — don't keep talking over them

        setMessages(m => [...m, { role: "user", content: trimmed }]);
        setInput("");
        setSending(true);

        try {
            const inputMode = usedVoiceForCurrentDraft.current ? "voice" : "chat";
            usedVoiceForCurrentDraft.current = false;
            const res = await api.post("/assistant/chat", {
                message:     trimmed,
                currentPage: pathname,
                inputMode,
            });
            const reply = res.data?.reply || "I didn't get a response. Try rephrasing.";
            setMessages(m => [...m, { role: "assistant", content: reply }]);
            if (voiceOut) tts.speak(reply);
        } catch (err) {
            const type        = err.response?.data?.error?.type;
            const fallback    = err.response?.data?.error?.message || "Something went wrong.";
            const retryAfter  = err.response?.headers?.["retry-after"];
            let   content     = FRIENDLY_ERROR[type] || fallback;
            if (type === "RATE_LIMITED" && retryAfter) {
                content = `Too many requests. Try again in ${retryAfter}s.`;
            }
            setMessages(m => [...m, { role: "assistant", content, error: true }]);
        } finally {
            setSending(false);
        }
    };

    const handleMicClick = () => {
        if (mic.listening) mic.stop();
        else               mic.start();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    aria-label="Open scholar360 assistant"
                    className="fixed bottom-6 right-6 z-[90] h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
                >
                    <Bot className="h-6 w-6" />
                </button>
            )}

            {open && (
                <div
                    role="dialog"
                    aria-label="scholar360 assistant"
                    className="fixed bottom-6 right-6 z-[90] w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-indigo-700">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">scholar360 Assistant</p>
                                <p className="text-[11px] text-white/70 truncate">Ask about leads, tasks, pipeline</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {tts.supported && (
                                <button
                                    onClick={toggleVoiceOut}
                                    aria-label={voiceOut ? "Mute assistant voice" : "Read replies aloud"}
                                    title={voiceOut ? "Voice on — click to mute" : "Voice off — click to read replies aloud"}
                                    className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                        voiceOut ? "bg-white/20 hover:bg-white/30" : "hover:bg-white/10",
                                    )}
                                >
                                    {voiceOut
                                        ? <Volume2 className={cn("h-4 w-4 text-white", tts.speaking && "animate-pulse")} />
                                        : <VolumeX className="h-4 w-4 text-white/70" />}
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                aria-label="Close assistant"
                                className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <X className="h-4 w-4 text-white" />
                            </button>
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
                        {messages.map((m, i) => (
                            <MessageBubble key={i} message={m} />
                        ))}
                        {sending && <TypingIndicator />}
                    </div>

                    <div className="border-t border-gray-100 bg-white p-3">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => {
                                    usedVoiceForCurrentDraft.current = false;
                                    setInput(e.target.value);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={mic.listening ? "Listening…" : "Ask anything…"}
                                rows={1}
                                disabled={sending}
                                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500 max-h-32"
                            />
                            {mic.supported && (
                                <button
                                    onClick={handleMicClick}
                                    disabled={sending}
                                    aria-label={mic.listening ? "Stop listening" : "Speak your message"}
                                    title={mic.listening ? "Listening — click to stop" : "Click to speak"}
                                    className={cn(
                                        "h-9 w-9 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:cursor-not-allowed",
                                        mic.listening
                                            ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400",
                                    )}
                                >
                                    <Mic className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || sending}
                                aria-label="Send message"
                                className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                            Enter to send · Shift+Enter for new line{mic.supported && " · 🎙 to speak"}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}

function MessageBubble({ message }) {
    const isUser = message.role === "user";
    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words",
                    isUser
                        ? "bg-indigo-600 text-white rounded-br-md whitespace-pre-wrap"
                        : message.error
                            ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-md whitespace-pre-wrap"
                            : "bg-white text-gray-900 border border-gray-200 rounded-bl-md",
                )}
            >
                {message.error && <AlertCircle className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
                {isUser || message.error
                    ? message.content
                    : <MarkdownContent content={message.content} />}
            </div>
        </div>
    );
}

function MarkdownContent({ content }) {
    return (
        <div className="prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children }) => {
                        const m = href?.match(ENTITY_HREF);
                        if (m) {
                            const [, kind, id] = m;
                            return (
                                <Link
                                    to={`${ENTITY_PATHS[kind]}/${id}`}
                                    className="text-indigo-600 font-medium underline decoration-indigo-300 hover:decoration-indigo-600"
                                >
                                    {children}
                                </Link>
                            );
                        }
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-indigo-600 underline decoration-indigo-300 hover:decoration-indigo-600"
                            >
                                {children}
                            </a>
                        );
                    },
                    p:      ({ children }) => <p className="mb-1.5">{children}</p>,
                    ul:     ({ children }) => <ul className="list-disc ml-4 mb-1.5 space-y-0.5">{children}</ul>,
                    ol:     ({ children }) => <ol className="list-decimal ml-4 mb-1.5 space-y-0.5">{children}</ol>,
                    li:     ({ children }) => <li className="leading-snug">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                    em:     ({ children }) => <em className="italic">{children}</em>,
                    code:   ({ inline, children }) => inline
                        ? <code className="bg-gray-100 rounded px-1 py-0.5 text-[0.85em] font-mono">{children}</code>
                        : <pre className="bg-gray-100 rounded-lg p-2 my-1.5 overflow-x-auto text-xs"><code>{children}</code></pre>,
                    table:  ({ children }) => <div className="overflow-x-auto my-1.5"><table className="text-xs border-collapse">{children}</table></div>,
                    th:     ({ children }) => <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">{children}</th>,
                    td:     ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
                    hr:     () => <hr className="my-2 border-gray-200" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms"   }} />
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
            </div>
        </div>
    );
}
