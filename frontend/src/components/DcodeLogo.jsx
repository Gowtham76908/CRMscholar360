export default function DcodeLogo({ size = "md", showText = true }) {
    const sizes = {
        sm: { icon: 18, text: "text-sm", gap: "gap-1.5" },
        md: { icon: 24, text: "text-base", gap: "gap-2" },
        lg: { icon: 32, text: "text-xl", gap: "gap-2.5" },
    };
    const s = sizes[size] ?? sizes.md;

    return (
        <div className={`flex items-center ${s.gap} select-none`}>
            {/* Icon mark */}
            <svg width={s.icon} height={s.icon} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Glow filter */}
                <defs>
                    <filter id="glow-orange" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="glow-blue" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <linearGradient id="orange-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF8C00" />
                        <stop offset="100%" stopColor="#FF4500" />
                    </linearGradient>
                </defs>
                {/* < bracket */}
                <path
                    d="M10 10 L4 16 L10 22"
                    stroke="url(#orange-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow-orange)"
                />
                {/* / slash */}
                <path
                    d="M13 22 L19 10"
                    stroke="#3B82F6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    filter="url(#glow-blue)"
                />
                {/* > bracket */}
                <path
                    d="M22 10 L28 16 L22 22"
                    stroke="url(#orange-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow-orange)"
                />
            </svg>

            {/* Word mark */}
            {showText && (
                <span className={`font-black tracking-tight text-gray-900 ${s.text}`}>
                    D<span className="text-gray-500 font-semibold">code</span>
                </span>
            )}
        </div>
    );
}
