import { useEffect, useRef } from "react";
import { X, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import Button from "./Button";

/**
 * Accessible confirmation dialog — replaces window.confirm().
 *
 * Usage:
 *   const [dialog, setDialog] = useState(null);
 *
 *   <Dialog
 *     open={!!dialog}
 *     title={dialog?.title}
 *     description={dialog?.description}
 *     confirmLabel={dialog?.confirmLabel}
 *     variant={dialog?.variant}      // "danger" | "warning" | "info"
 *     onConfirm={() => { dialog?.onConfirm(); setDialog(null); }}
 *     onCancel={() => setDialog(null)}
 *   />
 */

const icons = {
    danger:  { Icon: AlertTriangle, bg: "bg-red-100",    icon: "text-red-600" },
    warning: { Icon: AlertTriangle, bg: "bg-amber-100",  icon: "text-amber-600" },
    info:    { Icon: Info,          bg: "bg-indigo-100", icon: "text-indigo-600" },
    success: { Icon: CheckCircle,   bg: "bg-emerald-100",icon: "text-emerald-600" },
};

export default function Dialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel  = "Cancel",
    variant      = "danger",
    loading      = false,
    onConfirm,
    onCancel,
}) {
    const confirmRef = useRef(null);

    useEffect(() => {
        if (open) confirmRef.current?.focus();
    }, [open]);

    useEffect(() => {
        const handle = (e) => { if (e.key === "Escape" && open) onCancel?.(); };
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, [open, onCancel]);

    if (!open) return null;

    const { Icon, bg, icon } = icons[variant] ?? icons.danger;
    const confirmVariant = variant === "danger" ? "danger" : variant === "warning" ? "primary" : "primary";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Panel */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-4">
                    <div className={cn("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", bg)}>
                        <Icon className={cn("h-5 w-5", icon)} />
                    </div>
                    <div className="flex-1 pt-0.5">
                        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                        {description && (
                            <p className="mt-1 text-sm text-gray-500">{description}</p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="secondary" size="md" onClick={onCancel} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        ref={confirmRef}
                        variant={confirmVariant}
                        size="md"
                        loading={loading}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
