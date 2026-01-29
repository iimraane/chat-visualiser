import { create } from 'zustand';

export const useChatStore = create((set) => ({
    // Chat Data
    messages: [],
    participants: [],
    currentUser: '', // 'owner' of the archive

    // UI State
    screen: 'upload', // 'upload', 'chat'
    loading: false,
    error: null,

    // Search
    searchQuery: '',
    searchResults: [],
    currentMatchIndex: -1,

    // Love System
    activePopup: null,
    loveStats: { total: 0, amour: 0, mdr: 0, jetaime: 0 },

    // Preferences
    isDark: localStorage.getItem('chat-theme') === 'dark',
    background: localStorage.getItem('chat-background') || null,

    // Actions
    setChatData: (messages, participants) => set({ messages, participants, screen: 'chat' }),
    setScreen: (screen) => set({ screen }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchResults: (results) => set({ searchResults: results }),
    setCurrentMatchIndex: (index) => set({ currentMatchIndex: index }),

    setActivePopup: (popup) => set({ activePopup: popup }),
    setLoveStats: (stats) => set({ loveStats: stats }),

    toggleTheme: () => set((state) => {
        const newTheme = !state.isDark;
        localStorage.setItem('chat-theme', newTheme ? 'dark' : 'light');
        if (newTheme) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        return { isDark: newTheme };
    }),

    setBackground: (bg) => {
        localStorage.setItem('chat-background', bg);
        set({ background: bg });
    }
}));
