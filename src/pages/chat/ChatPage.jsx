import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { chatService, aiService } from "../../services/apiService";
import "../../styles/chat.css";
import BackgroundEffects from "../../components/BackgroundEffects";
import GrowthPathModal from "../../components/GrowthPathModal";
import { useNavigate, useLocation } from "react-router-dom";
import { Paperclip, Sun, Moon, CheckCircle, XCircle, Wand2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // AI State
    const [suggestions, setSuggestions] = useState([]);
    const [enhancedText, setEnhancedText] = useState(null);
    const [isThinking, setIsThinking] = useState(false);

    // State
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");

    // UI State
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [showGrowthPathCTA, setShowGrowthPathCTA] = useState(false);
    const [growthPathType, setGrowthPathType] = useState(null); // 'success' or 'failure'
    const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);

    // Refs
    const scrollRef = useRef();
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    // Fetch My Chats
    const fetchChats = async () => {
        try {
            const data = await chatService.fetchChats();
            setChats(data);
        } catch (error) {
            console.error("Failed to load chats", error);
        }
    };


    const fetchMessages = async () => {
        if (!selectedChat) return;
        try {
            const data = await chatService.fetchMessages(selectedChat._id);
            setMessages(data);
            scrollToBottom();

            // Trigger Smart Replies if last message is NOT from me
            if (data.length > 0 && data[data.length - 1].sender._id !== user._id) {
                fetchSmartReplies(selectedChat._id);
            }
        } catch (error) {
            console.error("Failed to load messages", error);
        }
    };

    // AI: Fetch Smart Replies
    const fetchSmartReplies = async (chatId) => {
        try {
            const replies = await aiService.suggestReplies(chatId);
            setSuggestions(replies);
        } catch (error) {
            console.error("AI Reply Error", error);
        }
    };

    // AI: Generate Opener if New Match
    useEffect(() => {
        const initNegotiation = async () => {
            if (location.state?.startNegotiation && location.state?.matchContext && !newMessage) {
                setIsThinking(true);
                try {
                    const opener = await aiService.generateOpener(location.state.matchContext);
                    setNewMessage(opener);
                    // Clear state so it doesn't re-trigger on refresh
                    window.history.replaceState({}, document.title);
                } catch (error) {
                    console.error("Opener Error", error);
                }
                setIsThinking(false);
            }
        };
        initNegotiation();
    }, [location.state]);

    // AI: Enhance Text
    const handleEnhanceText = async () => {
        if (!newMessage.trim()) return;
        setIsThinking(true);
        try {
            const improved = await aiService.enhanceText(newMessage);
            setEnhancedText(improved);
        } catch (error) {
            console.error("Enhance Error", error);
        }
        setIsThinking(false);
    };

    // Send Message
    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        try {
            const contentToSend = newMessage;
            setNewMessage("");
            setSuggestions([]); // Clear suggestions
            setEnhancedText(null); // Clear enhanced text
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }

            const data = await chatService.sendMessage(contentToSend, selectedChat._id);
            setMessages([...messages, data]);
            scrollToBottom();
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleInput = (e) => {
        setNewMessage(e.target.value);
        setEnhancedText(null); // Hide enhanced suggestion if user types
        // Auto-expand
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // 1. Upload
            const uploadRes = await chatService.uploadFile(file);
            const fileUrl = uploadRes.url;

            // 2. Determine type
            const type = file.type.startsWith("image/") ? "image" : "file";

            // 3. Send Message
            const data = await chatService.sendMessage(type === 'image' ? "Sent an image" : "Sent a file", selectedChat._id, [fileUrl], type);
            setMessages([...messages, data]);
            scrollToBottom();
        } catch (error) {
            console.error("File Upload Error:", error);
        }
    };


    const applySuggestion = (text) => {
        setNewMessage(text);
        setSuggestions([]);
        if (textareaRef.current) textareaRef.current.focus();
    };

    const handleCollaborationTrigger = (type) => {
        setGrowthPathType(type);
        setShowGrowthPathCTA(true);
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    useEffect(() => {
        const init = async () => {
            await fetchChats();
        };
        init();
    }, [user]);

    useEffect(() => {
        const initMessages = async () => {
            await fetchMessages();
        };
        initMessages();
        // Polling for simple real-time effect (every 3s)
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [selectedChat]);

    // Cleanup triggers when chat changes
    useEffect(() => {
        setShowGrowthPathCTA(false);
    }, [selectedChat]);

    // Helpers to get other user name
    const getSender = (loggedUser, users) => {
        if (!users || users.length < 2) return "Unknown User";
        return users[0]._id === loggedUser._id ? users[1].name : users[0].name;
    };

    const getSenderImg = (loggedUser, users) => {
        if (!users || users.length < 2) return "https://via.placeholder.com/150";
        return users[0]._id === loggedUser._id ? users[1].profileImg : users[0].profileImg;
    };

    return (
        <div className={`chat-page-container ${isDarkMode ? "dark-theme" : "light-theme"}`}>
            <BackgroundEffects />

            {/* Growth Path Modal */}
            <GrowthPathModal
                isOpen={isGrowthModalOpen}
                onClose={() => setIsGrowthModalOpen(false)}
                initialType={growthPathType}
            />

            {/* Overlay Gradient */}
            <div className="chat-overlay">
                <div className="chat-window">

                    {/* SIDEBAR */}
                    <div className="chat-sidebar">
                        <div className="sidebar-header">
                            <h2>Chats</h2>
                            <button className="back-btn" onClick={() => navigate(-1)}>⬅ Back</button>
                        </div>

                        <div className="chat-list">
                            {chats.map((chat) => (
                                <div
                                    key={chat._id}
                                    className={`chat-item ${selectedChat?._id === chat._id ? "active" : ""}`}
                                    onClick={() => setSelectedChat(chat)}
                                >
                                    <img
                                        src={getSenderImg(user, chat.users) || "https://via.placeholder.com/150"}
                                        alt="usr"
                                        className="chat-avatar"
                                    />
                                    <div className="chat-info">
                                        <div className="chat-name">{getSender(user, chat.users)}</div>
                                        <div className="chat-last-msg">
                                            {chat.latestMessage ? (
                                                chat.latestMessage.content.length > 30
                                                    ? chat.latestMessage.content.substring(0, 30) + "..."
                                                    : chat.latestMessage.content
                                            ) : "Start chatting..."}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MAIN CHAT AREA */}
                    <div className="chat-main">
                        {!selectedChat ? (
                            <div className="welcome-screen">
                                <h1 className="welcome-title">Welcome, {user?.name}</h1>
                                <p className="welcome-quote">"Collaboration is the key to unlocking potential."</p>
                                <div className="start-prompt">Select a chat to start messaging</div>
                            </div>
                        ) : (
                            <>
                                <div className="chat-header">
                                    <div className="header-left">
                                        <img
                                            src={getSenderImg(user, selectedChat.users) || "https://via.placeholder.com/150"}
                                            alt="Current"
                                            className="header-avatar"
                                        />
                                        <div className="header-details">
                                            <h3>{getSender(user, selectedChat.users)}</h3>
                                        </div>
                                    </div>

                                    {/* Toggle Check */}
                                    <button
                                        className="theme-toggle-btn"
                                        onClick={() => setIsDarkMode(!isDarkMode)}
                                        title="Toggle Theme"
                                    >
                                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                                    </button>
                                </div>

                                <div className="messages-box">
                                    {messages.map((m, i) => (
                                        <div
                                            key={i}
                                            className={`message-row ${m.sender._id === user._id ? "my-message" : "other-message"}`}
                                        >
                                            <div className="message-bubble">
                                                {m.type === 'image' && m.attachments?.length > 0 ? (
                                                    <div className="msg-attachment">
                                                        <img
                                                            src={m.attachments[0]}
                                                            alt="sent"
                                                            className="chat-msg-img"
                                                            style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
                                                            onClick={() => window.open(m.attachments[0], '_blank')}
                                                        />
                                                    </div>
                                                ) : m.type === 'file' && m.attachments?.length > 0 ? (
                                                    <div
                                                        className="msg-file-card"
                                                        style={{
                                                            background: 'rgba(0,0,0,0.2)',
                                                            padding: '10px',
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            maxWidth: '250px',
                                                            cursor: 'pointer',
                                                            border: '1px solid rgba(255,255,255,0.1)'
                                                        }}
                                                        onClick={() => window.open(m.attachments[0], '_blank')}
                                                    >
                                                        <div style={{ background: '#3b82f6', padding: '8px', borderRadius: '50%', display: 'flex', minWidth: '36px', justifyContent: 'center' }}>
                                                            <Paperclip size={20} color="white" />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {m.attachments[0].split('/').pop()}
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Click to open</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    m.content
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={scrollRef}></div>
                                </div>

                                <div className="input-area-container">
                                    {/* Show Growth Path CTA above input if triggered */}
                                    <AnimatePresence>
                                        {showGrowthPathCTA && (
                                            <motion.div
                                                className="cta-container"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end' }}
                                            >
                                                <button
                                                    className="sgp-cta-btn"
                                                    onClick={() => setIsGrowthModalOpen(true)}
                                                >
                                                    ✨ Show Growth Path
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* AI Smart Reply Chips */}
                                    {suggestions.length > 0 && (
                                        <div className="smart-replies-container">
                                            <div className="smart-chips-scroll">
                                                {suggestions.map((reply, idx) => (
                                                    <button
                                                        key={idx}
                                                        className="smart-chip"
                                                        onClick={() => applySuggestion(reply)}
                                                    >
                                                        ✨ {reply}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Enhanced Text Bubble */}
                                    {enhancedText && (
                                        <motion.div
                                            className="enhanced-bubble"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                        >
                                            <div className="enhanced-label">
                                                <Sparkles size={14} color="#8b5cf6" /> Nurotra AI Suggestion:
                                            </div>
                                            <div className="enhanced-content nurotra-ai-glow">"{enhancedText}"</div>
                                            <div className="enhanced-actions">
                                                <button onClick={() => { setNewMessage(enhancedText); setEnhancedText(null); }}>Apply</button>
                                                <button onClick={() => setEnhancedText(null)} className="dismiss">Dismiss</button>
                                            </div>
                                        </motion.div>
                                    )}

                                    <div className="input-area-wrapper">
                                        {/* File Upload Icon */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: "none" }}
                                            onChange={handleFileUpload}
                                        />
                                        <button
                                            className="icon-btn upload-btn"
                                            title="Upload File"
                                            onClick={() => fileInputRef.current.click()}
                                        >
                                            <Paperclip size={20} />
                                        </button>

                                        {/* Magic Sparkles Enhance (Nurotra Theme) */}
                                        <button
                                            className={`icon-btn magic-btn ${isThinking ? "thinking" : ""}`}
                                            title="Enhance Text w/ AI"
                                            onClick={handleEnhanceText}
                                            disabled={!newMessage.trim()}
                                        >
                                            <Sparkles size={20} color={newMessage.trim() ? "#8b5cf6" : "currentColor"} />
                                        </button>

                                        {/* Auto-expanding Input */}
                                        <textarea
                                            ref={textareaRef}
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={handleInput}
                                            onKeyDown={handleKeyDown}
                                            rows={1}
                                            className="chat-textarea"
                                        />

                                        {/* Send Button */}
                                        <button className="icon-btn send-btn" onClick={sendMessage}>➤</button>
                                    </div>

                                    {/* Collaboration Status Icons - Lower Right */}
                                    <div className="collab-icons">
                                        <div
                                            className="collab-icon-group"
                                            title="Collaboration Successful"
                                            onClick={() => handleCollaborationTrigger('success')}
                                        >
                                            <CheckCircle size={18} className="collab-success" />
                                        </div>
                                        <div
                                            className="collab-icon-group"
                                            title="Collaboration Unsuccessful"
                                            onClick={() => handleCollaborationTrigger('failure')}
                                        >
                                            <XCircle size={18} className="collab-failure" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

