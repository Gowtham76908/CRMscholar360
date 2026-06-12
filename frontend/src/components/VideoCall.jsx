import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Loader2 } from "lucide-react";

// Lazy-loaded from Messages — only downloads LiveKit when a call actually starts.
const VideoCall = ({ token, url, onLeave }) => {
    if (!token || !url) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-4">
            <p className="text-red-400 text-sm text-center px-6">
                LiveKit is not configured.<br />Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL to the backend.
            </p>
            <button onClick={onLeave} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                Go Back
            </button>
        </div>
    );

    return (
        <LiveKitRoom
            data-lk-theme="default"
            token={token}
            serverUrl={url}
            connect={true}
            video={true}
            audio={true}
            onDisconnected={onLeave}
            style={{ height: "100%", background: "#030712" }}
        >
            <VideoConference />
        </LiveKitRoom>
    );
};

export default VideoCall;
