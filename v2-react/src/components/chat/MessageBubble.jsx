import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const MessageBubble = React.memo(({ message, isOwner, searchQuery, onLongPress }) => {
    // Highlight Logic
    const highlightedText = useMemo(() => {
        if (!searchQuery || !message.text) return message.text;

        const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = message.text.split(regex);

        return parts.map((part, i) =>
            part.toLowerCase() === searchQuery.toLowerCase() ?
                <mark key={i} className="bg-yellow-300 text-black px-0.5 rounded text-sm font-semibold">{part}</mark> :
                part
        );
    }, [message.text, searchQuery]);

    const handleContextMenu = (e) => {
        e.preventDefault();
        onLongPress?.(message, e.clientX, e.clientY);
    };

    // Determine Bubble Style
    const bubbleClass = cn(
        "relative max-w-[85%] px-3 py-2 rounded-lg shadow-sm text-[15px] leading-[1.3] break-words",
        isOwner ? "bg-[#d9fdd3] dark:bg-[#005c4b] self-end rounded-tr-none ml-auto" : "bg-white dark:bg-[#202c33] self-start rounded-tl-none mr-auto",
        "mb-1"
    );

    return (
        <div
            className={cn("flex w-full px-[5%]", isOwner ? "justify-end" : "justify-start")}
            onContextMenu={handleContextMenu}
        >
            <div className={bubbleClass}>
                {/* Sender Name (if group and not me) */}
                {!isOwner && (
                    <div className="text-xs font-bold text-orange-500 mb-1 cursor-pointer hover:underline">
                        {message.sender}
                    </div>
                )}

                {/* Media Placeholder */}
                {message.mediaType && (
                    <div className="mb-2 p-2 bg-black/5 dark:bg-black/20 rounded flex items-center gap-2 text-sm italic text-gray-600 dark:text-gray-300">
                        {message.mediaType === 'photo' && '📷 Photo'}
                        {message.mediaType === 'video' && '🎥 Vidéo'}
                        {message.mediaType === 'audio' && '🎤 Audio'}
                        {message.mediaType === 'sticker' && '💟 Sticker'}
                        {!['photo', 'video', 'audio', 'sticker'].includes(message.mediaType) && '📎 Fichier'}
                    </div>
                )}

                {/* Text Content */}
                <div className="whitespace-pre-wrap dark:text-gray-100">
                    {highlightedText}
                </div>

                {/* Metadata */}
                <div className="flex justify-end items-center gap-1 mt-1 opacity-60">
                    {/* Star support placeholder */}
                    {message.isStarred && <span className="text-[10px]">⭐</span>}
                    <span className="text-[11px] min-w-fit">
                        {message.time}
                    </span>
                    {/* Read receipt checkmark dummy */}
                    {isOwner && <span className="text-[11px] text-blue-500">✓✓</span>}
                </div>
            </div>
        </div>
    );
});

export default MessageBubble;
