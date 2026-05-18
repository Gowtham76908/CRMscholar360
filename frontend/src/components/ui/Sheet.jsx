import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Slide-over Sheet — replaces centered modals for forms and detail panels.
 *
 * Usage:
 *   <Sheet open={open} onClose={() => setOpen(false)} title="New Lead">
 *     <Sheet.Body> ... form content ... </Sheet.Body>
 *     <Sheet.Footer>
 *       <Button onClick={handleSubmit}>Save</Button>
 *     </Sheet.Footer>
 *   </Sheet>
 */

const widths = {
    sm:   "max-w-md",
    md:   "max-w-lg",
    lg:   "max-w-2xl",
    xl:   "max-w-3xl",
    full: "max-w-full",
};

function Sheet({ open, onClose, title, description, size = "md", className, children }) {
    useEffect(() => {
        const handle = (e) => { if (e.key === "Escape" && open) onClose?.(); };
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, [open, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl transition-transform duration-200 ease-out w-full",
                    widths[size],
                    open ? "translate-x-0" : "translate-x-full",
                    className
                )}
                aria-modal="true"
                role="dialog"
            >
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 shrink-0">
                    <div>
                        {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
                        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body + Footer from children */}
                {children}
            </div>
        </>
    );
}

function SheetBody({ className, children }) {
    return (
        <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)}>
            {children}
        </div>
    );
}

function SheetFooter({ className, children }) {
    return (
        <div className={cn("shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50", className)}>
            {children}
        </div>
    );
}

Sheet.Body   = SheetBody;
Sheet.Footer = SheetFooter;

export default Sheet;
