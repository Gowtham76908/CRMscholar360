import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const variants = {
    primary:   "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-400",
    ghost:     "bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400",
    danger:    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
    outline:   "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400",
};

const sizes = {
    sm:   "h-7 px-3 text-xs rounded-md gap-1.5",
    md:   "h-9 px-4 text-sm rounded-lg gap-2",
    lg:   "h-11 px-5 text-sm rounded-lg gap-2",
    icon: "h-9 w-9 rounded-lg",
};

const Button = forwardRef(function Button(
    { variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
    ref
) {
    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                "inline-flex items-center justify-center font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                "disabled:opacity-50 disabled:pointer-events-none",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
            {children}
        </button>
    );
});

export default Button;
