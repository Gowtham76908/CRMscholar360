const STATUS_CONFIG = {
    ONLINE: { color: "bg-green-500", label: "Online" },
    BREAK:  { color: "bg-yellow-400", label: "On Break" },
    OFFLINE: { color: "bg-red-500", label: "Offline" },
};

const SIZES = {
    xs: "w-2 h-2",
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-3.5 h-3.5",
};

const StatusDot = ({ status = "OFFLINE", size = "md", showLabel = false, className = "" }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OFFLINE;
    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <span className={`${SIZES[size]} rounded-full flex-shrink-0 ${cfg.color} ${status === "ONLINE" ? "ring-2 ring-green-200" : ""}`} />
            {showLabel && (
                <span className="text-xs text-gray-600 font-medium">{cfg.label}</span>
            )}
        </span>
    );
};

export default StatusDot;
export { STATUS_CONFIG };
