import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useChatStore } from '../../stores/useChatStore';
import MessageBubble from './MessageBubble';
import { useScrollTriggers } from '../../hooks/useScrollTriggers';

export default function ChatList() {
    const { messages, currentUser, searchQuery, activePopup } = useChatStore();
    const virtusoRef = useRef(null);
    const [currentDate, setCurrentDate] = useState('');

    // Flatten messages with Date separators
    const { items, indices } = useMemo(() => {
        const res = [];
        const indicesMap = {}; // Maps original message index to virtual item index
        let lastDate = null;

        messages.forEach((msg, idx) => {
            if (msg.date !== lastDate) {
                res.push({ type: 'date', date: msg.date });
                lastDate = msg.date;
            }
            indicesMap[idx] = res.length;
            res.push({ type: 'message', data: msg, index: idx });
        });
        return { items: res, indices: indicesMap };
    }, [messages]);

    // Attach scroll triggers (Big Bang, Flash McQueen)
    // We need to access the scroller element from Virtuoso.
    const scrollerRef = useRef(null);
    useScrollTriggers(scrollerRef);

    // Update floating date on scroll
    const handleRangeChanged = (range) => {
        if (items.length > 0 && range.startIndex < items.length) {
            const item = items[range.startIndex];
            const date = item.type === 'date' ? item.date : item.data.date;
            setCurrentDate(date);
        }
    };

    return (
        <div className="h-full relative bg-[#efe7dd] dark:bg-[#0b141a]">
            {/* Floating Date Pill */}
            {currentDate && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-200/90 dark:bg-[#1f2c34]/90 backdrop-blur text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full text-xs font-medium shadow-sm transition-opacity duration-300">
                    {currentDate}
                </div>
            )}

            <Virtuoso
                ref={virtusoRef}
                style={{ height: '100%' }}
                data={items}
                scrollerRef={(ref) => scrollerRef.current = ref}
                rangeChanged={handleRangeChanged}
                itemContent={(index, item) => {
                    if (item.type === 'date') {
                        return (
                            <div className="flex justify-center my-4 sticky top-2 z-0">
                                <span className="bg-[#e1f3fb] dark:bg-[#1f2c34] text-gray-800 dark:text-gray-200 px-3 py-1 rounded-lg text-xs shadow-sm uppercase">
                                    {item.date}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <MessageBubble
                            message={item.data}
                            isOwner={item.data.sender === currentUser}
                            searchQuery={searchQuery}
                            onLongPress={() => console.log('Long press', item.data.id)}
                        />
                    );
                }}
            />
        </div>
    );
}
