import { useEffect, useRef, useState } from "react";

// Animated number that counts up from 0 to `value` on mount (and whenever
// `value` changes). Uses requestAnimationFrame with an ease-out curve so the
// figure decelerates as it lands. Respects prefers-reduced-motion.
export default function CountUp({ value = 0, duration = 1000, className }) {
    const [display, setDisplay] = useState(0);
    const fromRef = useRef(0);
    const rafRef = useRef(null);

    useEffect(() => {
        const target = Number(value) || 0;
        const from = fromRef.current;

        // Honor reduced-motion preferences — jump straight to the value.
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduce || duration <= 0 || from === target) {
            fromRef.current = target;
            setDisplay(target);
            return;
        }

        const start = performance.now();
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);

        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const current = from + (target - from) * easeOut(t);
            setDisplay(current);
            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                fromRef.current = target;
                setDisplay(target);
            }
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [value, duration]);

    return <span className={className}>{Math.round(display).toLocaleString("en-IN")}</span>;
}
