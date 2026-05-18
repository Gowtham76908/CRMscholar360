import { cn } from "../../lib/utils";

const variants = {
    default:   "bg-gray-100 text-gray-700 border-gray-200",
    hot:       "bg-red-100 text-red-700 border-red-200",
    warm:      "bg-amber-100 text-amber-700 border-amber-200",
    cold:      "bg-blue-100 text-blue-700 border-blue-200",
    success:   "bg-emerald-100 text-emerald-700 border-emerald-200",
    warning:   "bg-amber-100 text-amber-700 border-amber-200",
    error:     "bg-red-100 text-red-700 border-red-200",
    info:      "bg-blue-100 text-blue-700 border-blue-200",
    ai:        "bg-violet-100 text-violet-700 border-violet-200",
    indigo:    "bg-indigo-100 text-indigo-700 border-indigo-200",
    purple:    "bg-purple-100 text-purple-700 border-purple-200",
    orange:    "bg-orange-100 text-orange-700 border-orange-200",
    teal:      "bg-teal-100 text-teal-700 border-teal-200",
};

const sizes = {
    sm: "text-[10px] px-1.5 py-0.5 rounded",
    md: "text-xs px-2 py-0.5 rounded-md",
    lg: "text-sm px-2.5 py-1 rounded-md",
};

export default function Badge({ variant = "default", size = "md", className, children }) {
    return (
        <span
            className={cn(
                "inline-flex items-center font-medium border",
                variants[variant],
                sizes[size],
                className
            )}
        >
            {children}
        </span>
    );
}
