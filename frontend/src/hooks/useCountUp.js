import { useState, useEffect } from "react";

export default function useCountUp(target, duration = 1800, trigger = false) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!trigger) return;
        const startTime = performance.now();
        let rafId;
        const tick = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            setCount(Math.round(progress * target));
            if (progress < 1) rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [trigger, target, duration]);
    return count;
}
