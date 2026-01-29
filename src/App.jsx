import React, { useEffect } from 'react';
import { useChatStore } from './stores/useChatStore';
import { useLoveSystem } from './hooks/useLoveSystem';
import Header from './components/layout/Header';
import ChatList from './components/chat/ChatList';
import UploadScreen from './components/ui/UploadScreen';
import LovePopup from './components/ui/LovePopup';

function App() {
  const { screen, isDark, background } = useChatStore();

  // Initialize Love System (Global Listeners)
  useLoveSystem();

  // Initialize Theme
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
  }, [isDark]);

  return (
    <div className={`h-screen w-full overflow-hidden ${isDark ? 'dark' : ''}`}>
      {/* Background Image / Color */}
      {background && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none opacity-40"
          style={{ backgroundImage: `url(${background})` }}
        />
      )}

      <main className="h-full relative z-10 flex flex-col">
        {screen === 'upload' ? (
          <UploadScreen />
        ) : (
          <>
            <Header />
            <div className="flex-1 overflow-hidden pt-[60px]">
              <ChatList />
            </div>
          </>
        )}
      </main>

      {/* Global Overlays */}
      <LovePopup />
    </div>
  );
}

export default App;
