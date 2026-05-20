import { useRef, useState, useEffect } from "react";

export default function useInView(threshold = 0.15) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        let obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                    obs = null;
                }
            },
            { threshold }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs?.disconnect();
    }, [threshold]);
    return [ref, visible];
}
