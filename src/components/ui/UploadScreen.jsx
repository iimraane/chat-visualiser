import React, { useState, useRef } from 'react';
import { Upload, Lock, FileText, FolderPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatParser } from '../../hooks/useChatParser';
import { useChatStore } from '../../stores/useChatStore';

export default function UploadScreen() {
    const fileInputRef = useRef(null);
    const mediaInputRef = useRef(null);
    const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { parseChat, loading: parsing } = useChatParser();
    const { setChatData, setScreen } = useChatStore();

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const { messages, participants } = await parseChat(text);

        if (messages.length > 0) {
            setChatData(messages, participants);
        }
    };

    const handleSecretSubmit = (e) => {
        e.preventDefault();
        // Mock password check
        if (password === '1234' || password.toLowerCase() === 'amour') {
            // Load mock data or fetch predefined
            // For now, we simulate a load
            alert("Chargement du chat secret...");
            // Logic to fetch predefined chat would go here
            // fetch('/_chat.txt').then(...)
            setPasswordModalOpen(false);
        } else {
            setError("Mot de passe incorrect 🔒");
        }
    };

    return (
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600 p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"
            >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl">💬</span>
                </div>

                <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">
                    WhatsApp Visualizer
                </h1>
                <p className="text-gray-500 mb-8">
                    La meilleure façon de revivre vos souvenirs.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-3"
                    >
                        <FileText size={20} />
                        {parsing ? 'Analyse en cours...' : 'Choisir le fichier _chat.txt'}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".txt"
                        className="hidden"
                    />

                    <button
                        onClick={() => mediaInputRef.current?.click()}
                        className="w-full py-3 px-6 border-2 border-green-500 text-green-600 dark:text-green-400 rounded-xl font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-3"
                    >
                        <FolderPlus size={20} />
                        Ajouter le dossier de médias
                    </button>
                    <input
                        type="file"
                        ref={mediaInputRef}
                        webkitdirectory=""
                        directory=""
                        className="hidden"
                    />
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setPasswordModalOpen(true)}
                        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center justify-center gap-2 mx-auto transition-colors"
                    >
                        <Lock size={14} />
                        Accéder à la conversation secrète
                    </button>
                </div>
            </motion.div>

            {/* Password Modal */}
            <AnimatePresence>
                {isPasswordModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                        onClick={() => setPasswordModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-xl relative"
                        >
                            <button
                                onClick={() => setPasswordModalOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>

                            <h3 className="text-xl font-bold mb-4 text-center dark:text-white">Zone Secrète 🔒</h3>
                            <form onSubmit={handleSecretSubmit}>
                                <input
                                    type="password"
                                    autoFocus
                                    placeholder="Mot de passe..."
                                    className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-center text-lg mb-4 outline-none focus:ring-2 ring-green-500"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-bold shadow-lg transform active:scale-95 transition-all"
                                >
                                    Déverrouiller ❤️
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
