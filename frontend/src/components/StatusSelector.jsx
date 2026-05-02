import { useState, useRef, useEffect } from "react";
import { Wifi, Coffee, WifiOff, ChevronDown } from "lucide-react";
import StatusDot from "./StatusDot";

const OPTIONS = [
    { value: "ONLINE",  label: "Online",   icon: Wifi,    dot: "bg-green-500", text: "text-green-700", bg: "hover:bg-green-50" },
    { value: "BREAK",   label: "On Break", icon: Coffee,  dot: "bg-yellow-400", text: "text-yellow-700", bg: "hover:bg-yellow-50" },
    { value: "OFFLINE", label: "Offline",  icon: WifiOff, dot: "bg-red-500",  text: "text-red-700",  bg: "hover:bg-red-50" },
];

const StatusSelector = ({ currentStatus = "OFFLINE", onSelect, loading = false }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const current = OPTIONS.find(o => o.value === currentStatus) || OPTIONS[2];

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-60"
            >
                <StatusDot status={currentStatus} size="sm" />
                <span>{current.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    {OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const isActive = opt.value === currentStatus;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => { onSelect(opt.value); setOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${opt.bg} ${isActive ? "font-semibold " + opt.text : "text-gray-700"}`}
                            >
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                                {opt.label}
                                {isActive && <span className="ml-auto text-xs">✓</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StatusSelector;
