import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useChatStore } from '../../stores/useChatStore';

export default function LovePopup() {
    const { activePopup, setActivePopup } = useChatStore();

    useEffect(() => {
        if (activePopup?.confetti) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                zIndex: 9999
            });
        }

        // Handling special effects like 'foodRain' or 'flashRed' could go here specific to the popup type
        // For 'flashRed', we might need a global overlay, but we'll stick to simple confetti/styles for now.
    }, [activePopup]);

    if (!activePopup) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] pointer-events-none">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.5, opacity: 0, y: 50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border-4 border-pink-100 dark:border-pink-900 pointer-events-auto"
                >
                    <div className="text-6xl mb-4 animate-[bounce_1s_infinite]">
                        {activePopup.emoji || '💖'}
                    </div>

                    <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-2">
                        {activePopup.text}
                    </h2>

                    {activePopup.subtext && (
                        <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium">
                            {activePopup.subtext}
                        </p>
                    )}

                    <div className="flex flex-col gap-2">
                        {(activePopup.buttons || [{ label: "C'est mignon 🥰", action: 'close' }]).map((btn, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (btn.action === 'close') setActivePopup(null);
                                    // Handle other actions if needed
                                }}
                                className={`w-full py-3 rounded-xl font-bold transition-transform active:scale-95 ${btn.secondary
                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                                        : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30'
                                    }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
