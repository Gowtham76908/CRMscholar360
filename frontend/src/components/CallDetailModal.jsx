import { useState, useEffect, useCallback, useRef } from "react";
import {
    X, Phone, Clock, Calendar, Play, Pause, FileText,
    Loader2, ChevronDown, ChevronUp, AlertCircle,
    Mic, MessageSquare, TrendingUp, Heart, Tag, ThumbsUp, RefreshCw,
    Upload, CheckCircle
} from "lucide-react";
import api from "../api/axios";
import { toast } from "sonner";

const BADGE_COLORS = {
    Good: "bg-green-100 text-green-800",
    Bad: "bg-red-100 text-red-800",
    Neutral: "bg-gray-100 text-gray-800",
    Professional: "bg-blue-100 text-blue-800",
    Casual: "bg-amber-100 text-amber-800",
    Frustrated: "bg-red-100 text-red-800",
    Polite: "bg-emerald-100 text-emerald-800",
    Aggressive: "bg-rose-100 text-rose-800",
    High: "bg-red-100 text-red-800",
    Medium: "bg-amber-100 text-amber-800",
    Low: "bg-green-100 text-green-800",
    Calm: "bg-blue-100 text-blue-800",
    Angry: "bg-red-100 text-red-800",
    Anxious: "bg-yellow-100 text-yellow-800",
    Happy: "bg-green-100 text-green-800",
    Sad: "bg-indigo-100 text-indigo-800",
    Complaint: "bg-red-100 text-red-800",
    Inquiry: "bg-blue-100 text-blue-800",
    "Follow-up": "bg-purple-100 text-purple-800",
    Sales: "bg-emerald-100 text-emerald-800",
    Support: "bg-amber-100 text-amber-800",
    General: "bg-gray-100 text-gray-800",
};

const Badge = ({ label, value }) => {
    if (!value || value === "Neutral") return null;
    const color = BADGE_COLORS[value] || "bg-gray-100 text-gray-800";
    return (
        <div className="flex flex-col">
            <span className="text-xs text-gray-500 mb-1">{label}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color} inline-block w-fit`}>
                {value}
            </span>
        </div>
    );
};

const CallDetailModal = ({ lead, callLogs: propCallLogs, onClose, onUpdate }) => {
    const [expandedCallId, setExpandedCallId] = useState(null);
    const [transcribingId, setTranscribingId] = useState(null);
    const [callDetails, setCallDetails] = useState({});
    const [showTranscript, setShowTranscript] = useState(null);

    // Fetch call logs from the API
    const [fetchedCallLogs, setFetchedCallLogs] = useState(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    // Upload recording state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const fileInputRef = useRef(null);

    const fetchCallLogs = useCallback(async () => {
        if (!lead?.id) return;
        setIsLoadingLogs(true);
        setFetchError(null);
        try {
            const res = await api.get(`/calls/${lead.id}`);
            setFetchedCallLogs(res.data);
        } catch (error) {
            console.error("Error fetching call logs:", error);
            setFetchError(error.response?.data?.error?.message || error.response?.data?.message || "Failed to fetch call logs");
            setFetchedCallLogs(null);
        } finally {
            setIsLoadingLogs(false);
        }
    }, [lead?.id]);

    useEffect(() => {
        fetchCallLogs();
    }, [fetchCallLogs]);

    const callLogs = fetchedCallLogs || propCallLogs || [];

    const formatDuration = (seconds) => {
        if (!seconds) return "0s";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const formatDate = (date) => {
        if (!date) return "-";
        return new Date(date).toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    };

    const handleTranscribe = async (callLog) => {
        if (!callLog.recordingUrl) {
            toast.warning("No recording available for this call.");
            return;
        }

        setTranscribingId(callLog.id);
        try {
            const res = await api.post(`/calls/transcribe/${callLog.id}`);
            setCallDetails((prev) => ({
                ...prev,
                [callLog.id]: res.data.callLog,
            }));
            await fetchCallLogs();
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Transcription failed");
        } finally {
            setTranscribingId(null);
        }
    };

    const handleUploadRecording = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = "";

        setIsUploading(true);
        setUploadSuccess(false);
        try {
            const formData = new FormData();
            formData.append("recording", file);
            formData.append("leadId", lead.id);

            await api.post("/calls/upload-recording", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setUploadSuccess(true);
            setTimeout(() => setUploadSuccess(false), 3000);
            await fetchCallLogs();
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Failed to upload recording");
        } finally {
            setIsUploading(false);
        }
    };

    const getCallData = (callLog) => {
        return callDetails[callLog.id] || callLog;
    };

    const statusColor = (status) => {
        switch (status) {
            case "COMPLETED": return "text-green-600";
            case "FAILED": return "text-red-600";
            case "INITIATED": case "RINGING": return "text-amber-600";
            default: return "text-gray-600";
        }
    };

    const statusBg = (status) => {
        switch (status) {
            case "COMPLETED": return "bg-green-50 border-green-200";
            case "FAILED": return "bg-red-50 border-red-200";
            case "INITIATED": case "RINGING": return "bg-amber-50 border-amber-200";
            default: return "bg-gray-50 border-gray-200";
        }
    };

    // Build audio src — handle local paths by prefixing backend URL
    const getAudioSrc = (url) => {
        if (!url) return "";
        if (url.startsWith("/uploads/")) {
            const baseUrl = import.meta.env.VITE_API_BASE_URL;
            return `${baseUrl}${url}`;
        }
        return url;
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 py-6">
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

                <div className="relative bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all w-full max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 rounded-full p-2">
                                    <Phone className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{lead.name}</h3>
                                    <p className="text-indigo-200 text-sm">{lead.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={fetchCallLogs}
                                    className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                                    title="Refresh call logs"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={onClose} className="text-white/80 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        {!isLoadingLogs && callLogs.length > 0 && (
                            <div className="mt-3 flex items-center gap-4 text-indigo-200 text-xs">
                                <span>{callLogs.length} call{callLogs.length !== 1 ? 's' : ''} total</span>
                                <span>•</span>
                                <span>{callLogs.filter(c => c.callStatus === 'COMPLETED').length} completed</span>
                                <span>•</span>
                                <span>{callLogs.filter(c => c.recordingUrl).length} with recording</span>
                                <span>•</span>
                                <span>{callLogs.filter(c => c.isTranscribed).length} transcribed</span>
                            </div>
                        )}
                    </div>

                    {/* Upload Recording Bar */}
                    <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-indigo-700">
                            <Upload className="h-4 w-4" />
                            <span className="font-medium">Upload a call recording for this lead</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {uploadSuccess && (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                    <CheckCircle className="h-3.5 w-3.5" /> Uploaded!
                                </span>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".mp3,.wav,.m4a,.aac,.ogg,.webm"
                                className="hidden"
                                onChange={handleUploadRecording}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-3.5 w-3.5" />
                                        Choose File
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Call list */}
                    <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                        {isLoadingLogs ? (
                            <div className="text-center py-10">
                                <Loader2 className="h-8 w-8 mx-auto mb-3 text-indigo-500 animate-spin" />
                                <p className="font-medium text-gray-700">Loading call logs...</p>
                                <p className="text-sm text-gray-500">Fetching call history for this lead</p>
                            </div>
                        ) : fetchError && callLogs.length === 0 ? (
                            <div className="text-center py-10">
                                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-400" />
                                <p className="font-medium text-red-600">Error loading call logs</p>
                                <p className="text-sm text-gray-500 mt-1">{fetchError}</p>
                                <button
                                    onClick={fetchCallLogs}
                                    className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    <RefreshCw className="h-4 w-4 inline mr-1" /> Try Again
                                </button>
                            </div>
                        ) : (!callLogs || callLogs.length === 0) ? (
                            <div className="text-center py-10 text-gray-500">
                                <Phone className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                <p className="font-medium">No calls recorded</p>
                                <p className="text-sm">Upload a recording above or make a call to get started.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {callLogs.map((cl) => {
                                    const call = getCallData(cl);
                                    const isExpanded = expandedCallId === call.id;

                                    return (
                                        <div key={call.id} className={`border rounded-lg overflow-hidden ${statusBg(call.callStatus)}`}>
                                            {/* Call summary row */}
                                            <div
                                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                                            >
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <div className={`flex items-center gap-1.5 text-sm font-medium ${statusColor(call.callStatus)}`}>
                                                        <Phone className="h-3.5 w-3.5" />
                                                        {call.callType || "OUTBOUND"}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {formatDuration(call.duration)}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {formatDate(call.callDate || call.createdAt)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {call.isTranscribed && (
                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                                            Transcribed
                                                        </span>
                                                    )}
                                                    {call.recordingUrl && (
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                                            Recording
                                                        </span>
                                                    )}
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                        call.callStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                        call.callStatus === 'FAILED' ? 'bg-red-100 text-red-700' :
                                                        call.callStatus === 'INITIATED' || call.callStatus === 'RINGING' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {call.callStatus || "Unknown"}
                                                    </span>
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded details */}
                                            {isExpanded && (
                                                <div className="px-4 py-4 border-t border-gray-200 space-y-4 bg-white">
                                                    {/* Call info grid */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                                        <div>
                                                            <span className="text-gray-500 text-xs">Status</span>
                                                            <p className={`font-medium ${statusColor(call.callStatus)}`}>
                                                                {call.callStatus || "Unknown"}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs">Duration</span>
                                                            <p className="font-medium text-gray-900">{formatDuration(call.duration)}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs">Agent</span>
                                                            <p className="font-medium text-gray-900">{call.agentNumber || "-"}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs">Date</span>
                                                            <p className="font-medium text-gray-900">{formatDate(call.callDate || call.createdAt)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Recording player */}
                                                    {call.recordingUrl && (
                                                        <div className="bg-gray-50 rounded-lg p-3">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Mic className="h-4 w-4 text-indigo-600" />
                                                                <span className="text-sm font-medium text-gray-700">Call Recording</span>
                                                            </div>
                                                            <audio
                                                                controls
                                                                className="w-full h-10"
                                                                src={getAudioSrc(call.recordingUrl)}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Transcribe button */}
                                                    {call.recordingUrl && !call.isTranscribed && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleTranscribe(call);
                                                            }}
                                                            disabled={transcribingId === call.id}
                                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                                                        >
                                                            {transcribingId === call.id ? (
                                                                <>
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    <span>Transcribing with AI... (this may take a minute)</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FileText className="h-4 w-4" />
                                                                    <span>Transcribe Call with AI</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* No recording warning */}
                                                    {!call.recordingUrl && (
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                                                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                            <span>No recording available. Upload one above or wait for the call provider to send it.</span>
                                                        </div>
                                                    )}

                                                    {/* Transcription results */}
                                                    {call.isTranscribed && (
                                                        <div className="space-y-4">
                                                            {/* AI Analysis badges */}
                                                            <div className="bg-indigo-50 rounded-lg p-4">
                                                                <h4 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                                                                    <TrendingUp className="h-4 w-4" />
                                                                    AI Analysis
                                                                </h4>
                                                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                                                    <Badge label="Sentiment" value={call.sentiment} />
                                                                    <Badge label="Tone" value={call.tone} />
                                                                    <Badge label="Urgency" value={call.urgency} />
                                                                    <Badge label="Emotion" value={call.emotion} />
                                                                    <Badge label="Category" value={call.callCategory} />
                                                                </div>
                                                            </div>

                                                            {/* Summary */}
                                                            {call.summary && (
                                                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                                        <MessageSquare className="h-4 w-4 text-indigo-600" />
                                                                        Summary
                                                                    </h4>
                                                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                                        {call.summary}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Feedback & Conclusion */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {call.feedback && (
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                                        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                                            <ThumbsUp className="h-4 w-4 text-emerald-600" />
                                                                            Feedback
                                                                        </h4>
                                                                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{call.feedback}</p>
                                                                    </div>
                                                                )}
                                                                {call.conclusion && (
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                                        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                                            <Heart className="h-4 w-4 text-rose-500" />
                                                                            Conclusion
                                                                        </h4>
                                                                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{call.conclusion}</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Full transcript toggle */}
                                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShowTranscript(showTranscript === call.id ? null : call.id);
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <FileText className="h-4 w-4 text-indigo-600" />
                                                                        Full Transcript
                                                                    </span>
                                                                    {showTranscript === call.id ? (
                                                                        <ChevronUp className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    )}
                                                                </button>
                                                                {showTranscript === call.id && (
                                                                    <div className="px-4 py-3 max-h-64 overflow-y-auto bg-white">
                                                                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                                                                            {call.transcription || call.plainText}
                                                                        </pre>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-6 py-3 flex justify-end border-t">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallDetailModal;
