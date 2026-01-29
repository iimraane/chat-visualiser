import React from 'react';
import { Search, Moon, Sun, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';

export default function Header() {
    const {
        isDark, toggleTheme,
        messages,
        searchQuery, setSearchQuery,
        searchResults, currentMatchIndex, setCurrentMatchIndex
    } = useChatStore();

    return (
        <header className="h-[60px] glass dark:glass-dark flex items-center justify-between px-4 z-50 fixed top-0 w-full">
            {/* Left: Info */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold">
                    <span className="text-xl">💬</span>
                </div>
                <div>
                    <h1 className="font-bold text-sm text-gray-800 dark:text-gray-100 leading-tight">
                        WhatsApp Visualizer
                    </h1>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {messages.length.toLocaleString()} messages
                    </span>
                </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative group">
                    <div className={
                        `flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5 transition-all duration-300 ${searchQuery ? 'w-64' : 'w-10 group-hover:w-64'}`
                    }>
                        <Search size={18} className="text-gray-500 min-w-[18px]" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            className={`bg-transparent border-none outline-none text-sm ml-2 w-full text-gray-700 dark:text-gray-200 ${!searchQuery && 'hidden group-hover:block'}`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="bg-gray-200 dark:bg-gray-700 rounded-full p-0.5 ml-1">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Search Navigation */}
                    {searchResults.length > 0 && (
                        <div className="absolute top-10 right-0 glass dark:glass-dark p-2 rounded-lg flex items-center gap-2 text-xs shadow-lg">
                            <span>
                                {currentMatchIndex + 1} / {searchResults.length}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setCurrentMatchIndex((currentMatchIndex - 1 + searchResults.length) % searchResults.length)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    onClick={() => setCurrentMatchIndex((currentMatchIndex + 1) % searchResults.length)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                >
                                    <ChevronDown size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                    {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
                </button>
            </div>
        </header>
    );
}
