import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../stores/useChatStore';

export function useLoveSystem() {
    const {
        messages,
        participants,
        setLoveStats,
        setActivePopup,
        loveStats,
        searchQuery
    } = useChatStore();

    const timersRef = useRef([]);

    // Calculate Stats
    useEffect(() => {
        if (!messages.length) return;

        let amourCount = 0;
        let mdrCount = 0;
        let jetaimeCount = 0;

        messages.forEach(msg => {
            const text = msg.text.toLowerCase();
            if (text.includes('amour')) amourCount++;
            if (text.match(/mdr|lol|haha|😂|🤣/)) mdrCount++;
            if (text.match(/je t'?aime|jtm|i love you/)) jetaimeCount++;
        });

        setLoveStats({
            total: messages.length,
            amour: amourCount,
            mdr: mdrCount,
            jetaime: jetaimeCount
        });

    }, [messages, setLoveStats]);

    // Check for Special Chat (Imrane/Habhoub)
    useEffect(() => {
        if (!participants.length) return;

        const p = participants.map(name => name.toLowerCase());
        const isSpecial = p.some(n => n.includes('imrane') || n.includes('imran')) &&
            p.some(n => n.includes('habhoub') || n.includes('habib') || n.includes('houb'));

        if (isSpecial) {
            // Start Random Timer
            startRandomTimer();
            // Check Time based
            checkTimeBasedPopups();
        }

        return () => clearTimers();
    }, [participants]);

    // Search Easter Eggs
    useEffect(() => {
        if (!searchQuery) return;

        const query = searchQuery.toLowerCase();
        const SEARCH_TRIGGERS = {
            'mariage': { emoji: '💍', text: "Un jour...", confetti: true },
            'enfant': { emoji: '👶', text: "Un jour peut-être... 🥹", confetti: true },
            'je t\'aime': { emoji: '💖', text: "Moi aussi je t'aime ! 💕", confetti: true },
            'coquine': { emoji: '😳', effect: 'flashRed' }, // Handled by UI class
            'faim': { emoji: '🍕', effect: 'foodRain' },
            'bisou': { emoji: '💋', text: "Un bisou pour toi ! 💋", confetti: true },
        };

        for (const [trigger, config] of Object.entries(SEARCH_TRIGGERS)) {
            if (query.includes(trigger)) {
                setActivePopup(config);
                break;
            }
        }
    }, [searchQuery, setActivePopup]);

    // Logic for timers
    const startRandomTimer = useCallback(() => {
        const randomDelay = () => Math.floor(Math.random() * (15 - 5 + 1) + 5) * 60 * 1000;

        const schedule = () => {
            const delay = randomDelay();
            const timer = setTimeout(() => {
                // Trigger random popup from list
                const POPUPS = [
                    { emoji: '🎯', text: "Alerte ! Tu manques à l'appel !", subtext: "Reviens vite ❤️" },
                    { emoji: '📊', text: `Déjà ${loveStats.total} messages !`, subtext: "C'est énorme !" },
                ];
                const popup = POPUPS[Math.floor(Math.random() * POPUPS.length)];
                setActivePopup(popup);
                schedule();
            }, delay);
            timersRef.current.push(timer);
        };
        schedule();
    }, [loveStats, setActivePopup]);

    const checkTimeBasedPopups = useCallback(() => {
        const hour = new Date().getHours();
        if (hour >= 23) {
            setActivePopup({ emoji: '🌙', text: "Il est tard...", subtext: "Va dormir mon amour ❤️" });
        }
    }, [setActivePopup]);

    const clearTimers = () => {
        timersRef.current.forEach(t => clearTimeout(t));
        timersRef.current = [];
    };
}
