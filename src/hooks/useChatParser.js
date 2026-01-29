import { useState, useCallback } from 'react';

export function useChatParser() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);

    const detectMediaType = (text) => {
        const t = text.toLowerCase();
        if (t.includes('image') || t.includes('photo')) return 'photo';
        if (t.includes('vidéo') || t.includes('video')) return 'video';
        if (t.includes('audio') || t.includes('vocal') || t.includes('ptt') || t.includes('message vocal') || t.includes('voice message') || t.includes('.opus')) return 'audio';
        if (t.includes('sticker') || t.includes('gif animé')) return 'sticker';
        return null; // text
    };

    const parseChat = useCallback(async (fileText) => {
        setLoading(true);
        setError(null);
        setProgress(0);

        return new Promise((resolve, reject) => {
            try {
                // Use setTimeout to unblock main thread for initial render if needed
                setTimeout(() => {
                    const allMessages = [];
                    const participantSet = new Set();

                    const patterns = [
                        /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*([^:]+):\s*(.*)$/,
                        /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.*)$/,
                        /^[\u200e\u200f]*\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*[-–]?\s*([^:]+):\s*(.*)$/
                    ];

                    const lines = fileText.split('\n');
                    let currentMessage = null;

                    for (let i = 0; i < lines.length; i++) {
                        let line = lines[i];
                        // Remove LTR/RTL marks
                        line = line.replace(/[\u200e\u200f\u202a\u202c]/g, '').trim();
                        if (!line) continue;

                        let match = null;
                        for (let p of patterns) {
                            match = line.match(p);
                            if (match) break;
                        }

                        if (match) {
                            if (currentMessage) allMessages.push(currentMessage);

                            const sender = match[3].trim();
                            participantSet.add(sender);

                            let msgText = match[4].replace(/<Ce message a été modifié>/g, '').trim();

                            // Determine if media
                            const isMediaOmitted = /omis|omitted|absente?|<média|<media/i.test(msgText);
                            const mediaType = isMediaOmitted ? detectMediaType(msgText) : null;

                            currentMessage = {
                                id: i, // Simple index ID
                                date: match[1],
                                time: match[2],
                                sender,
                                text: msgText,
                                media: null,
                                mediaType: mediaType,
                                isMediaOmitted
                            };
                        } else if (currentMessage) {
                            let clean = line.replace(/<Ce message a été modifié>/g, '').trim();
                            if (clean) currentMessage.text += '\n' + clean;
                        }

                        // Optional: Update progress every 1000 lines
                        if (i % 1000 === 0) {
                            setProgress(Math.round((i / lines.length) * 100));
                        }
                    }

                    if (currentMessage) allMessages.push(currentMessage);

                    const participants = Array.from(participantSet);

                    setLoading(false);
                    setProgress(100);
                    resolve({ messages: allMessages, participants });
                }, 50);
            } catch (err) {
                setError(err.message);
                setLoading(false);
                reject(err);
            }
        });
    }, []);

    return { parseChat, loading, error, progress };
}
