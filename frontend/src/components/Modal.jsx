import { X } from "lucide-react";

export const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
            <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-lg mx-auto my-6 bg-white rounded-lg shadow-lg outline-none focus:outline-none z-50">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-solid border-gray-200 rounded-t">
                    <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                    <button
                        className="p-1 ml-auto bg-transparent border-0 text-black opacity-50 float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
                        onClick={onClose}
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>
                {/* Body */}
                <div className="relative p-6 flex-auto max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">{children}</div>
            </div>
        </div>
    );
};
