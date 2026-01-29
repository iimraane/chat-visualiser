import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/useChatStore';

export function useScrollTriggers(scrollerRef) {
    const setActivePopup = useChatStore(state => state.setActivePopup);
    const scrollSpeedRef = useRef({ lastPosition: 0, lastTime: 0, speed: 0 });
    const hasScrolledToTopRef = useRef(false);
    const lastTriggerTime = useRef(0);
    const TRIGGER_COOLDOWN = 10000;

    useEffect(() => {
        const element = scrollerRef.current;
        if (!element) return;

        let scrollTimer = null;

        const handleScroll = () => {
            const now = Date.now();

            // Rate limit speed tracking (100ms)
            if (now - scrollSpeedRef.current.lastTime >= 100) {
                const currentPos = element.scrollTop;
                const timeDiff = now - scrollSpeedRef.current.lastTime;
                const posDiff = Math.abs(currentPos - scrollSpeedRef.current.lastPosition);

                scrollSpeedRef.current.speed = timeDiff > 0 ? posDiff / timeDiff : 0;
                scrollSpeedRef.current.lastPosition = currentPos;
                scrollSpeedRef.current.lastTime = now;
            }

            // Flash McQueen Trigger
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                if (scrollSpeedRef.current.speed > 5 && now - lastTriggerTime.current > TRIGGER_COOLDOWN) {
                    lastTriggerTime.current = now;
                    setActivePopup({
                        emoji: '🏎️',
                        text: "Wow doucement Flash McQueen !",
                        subtext: "Tu revisses toute notre vie en accéléré ? 😂",
                        buttons: [{ label: "Je cherche une pépite 💎", action: 'close' }]
                    });
                }
            }, 500);

            // Big Bang Trigger
            if (element.scrollTop < 50 && !hasScrolledToTopRef.current && now - lastTriggerTime.current > TRIGGER_COOLDOWN) {
                hasScrolledToTopRef.current = true;
                lastTriggerTime.current = now;
                setTimeout(() => {
                    setActivePopup({
                        emoji: '💥',
                        text: "Le Big Bang de notre relation !",
                        subtext: "Tout a commencé ici... ✨",
                        confetti: true
                    });
                }, 1000);
            }
        };

        element.addEventListener('scroll', handleScroll, { passive: true });
        return () => element.removeEventListener('scroll', handleScroll);
    }, [scrollerRef, setActivePopup]);
}
