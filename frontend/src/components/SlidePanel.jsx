import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function SlidePanel({ isOpen, onClose, title, children }) {
    const panelRef = useRef(null);

    // Close on Escape key press + lock body scroll
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Portal to document.body so fixed positioning is never affected
    // by overflow:auto / transform on any ancestor.
    return createPortal(
        <div
            style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }}
        >
            {/* Backdrop */}
            <div
                style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.30)", backdropFilter: "blur(4px)" }}
                className="animate-fade-in"
                onClick={onClose}
            />

            {/* Panel — flush right, full height, no gap */}
            <div
                ref={panelRef}
                style={{ position: "relative", width: "100%", maxWidth: "32rem", height: "100%", zIndex: 201 }}
                className="bg-white shadow-2xl flex flex-col animate-slide-in-right"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all focus:outline-none"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
