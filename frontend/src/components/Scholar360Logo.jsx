export default function Scholar360Logo({ size = "md", showText = true }) {
    const sizes = {
        sm: { icon: 18, text: "text-sm", gap: "gap-1.5" },
        md: { icon: 24, text: "text-base", gap: "gap-2" },
        lg: { icon: 32, text: "text-xl", gap: "gap-2.5" },
    };
    const s = sizes[size] ?? sizes.md;

    return (
        <div className={`flex items-center ${s.gap} select-none`}>
            {/* Icon mark */}
            <img
                src="/SCHOLAR360.PNG"
                alt="scholar360"
                style={{ width: s.icon, height: s.icon }}
                className="object-contain"
            />

            {/* Word mark */}
            {showText && (
                <span className={`font-black tracking-tight text-gray-900 ${s.text}`}>
                    scholar<span className="text-indigo-600 font-black">360</span>
                </span>
            )}
        </div>
    );
}
