import { useState, useEffect } from "react";
import {
    StreamVideo,
    StreamVideoClient,
    StreamCall,
    StreamTheme,
    SpeakerLayout,
    CallControls,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Loader2 } from "lucide-react";

// Self-contained video-call surface. Lazy-loaded from Messages so the heavy
// Stream *video* SDK (and its CSS) only downloads when a user actually starts a
// call — the chat experience no longer pays for it on page open.
const VideoCall = ({ creds, callId, onLeave }) => {
    // Build the video client once, at mount (this component only mounts when a
    // call is actually starting).
    const [client] = useState(() => new StreamVideoClient({ apiKey: creds.apiKey, user: creds.user, token: creds.token }));
    const [call, setCall] = useState(null);
    const [err, setErr]   = useState(null);

    useEffect(() => {
        const theCall = client.call("default", callId);
        theCall.join({ create: true }).then(() => setCall(theCall)).catch((e) => {
            console.error(e);
            setErr("Failed to connect to call.");
        });
        return () => { theCall.leave().catch(() => {}); };
    }, [client, callId]);

    useEffect(() => () => { client.disconnectUser().catch(() => {}); }, [client]);

    if (err) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-4">
            <p className="text-red-400">{err}</p>
            <button onClick={onLeave} className="bg-red-600 px-4 py-2 rounded-xl">Go Back</button>
        </div>
    );
    if (!call) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-white gap-3">
            <Loader2 className="animate-spin h-8 w-8 text-[#F97316]" />
            <p className="text-gray-400 text-sm">Connecting…</p>
        </div>
    );

    return (
        <StreamVideo client={client}>
            <StreamCall call={call}>
                <div className="w-full h-full flex flex-col bg-gray-950 relative">
                    <div className="absolute top-4 left-4 z-50">
                        <button onClick={onLeave}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg transition-colors text-sm">
                            End Call
                        </button>
                    </div>
                    <StreamTheme>
                        <SpeakerLayout />
                        <CallControls onLeave={onLeave} />
                    </StreamTheme>
                </div>
            </StreamCall>
        </StreamVideo>
    );
};

export default VideoCall;
