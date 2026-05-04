import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Menu } from 'lucide-react';
import OrchestratorChat from './OrchestratorChat';
import { useAuth } from '../../context/AuthContext';
import '../../styles/orchestrator.css'; 
import '../../styles/header.css';

const OrchestratorLayout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const fetchHistory = async () => {
    if (!user || !user.token) return;
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/orchestrator/history', {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const handleNewChat = () => {
    setActiveChatId(null);
    closeSidebar();
  };

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    closeSidebar();
  };

  // Sync theme: Orchestrator is always dark, so set data-theme to dark
  // This ensures login/profile pages opened from here also render in dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  return (
    <div className="orchestrator-shell">
      {/* Sidebar */}
      <div className={`orchestrator-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <button className="new-chat-btn" onClick={handleNewChat}>
          <Plus size={18} />
          <span>New chat</span>
        </button>
        
        <div className="history-list">
          {chats.length === 0 ? (
            <div className="history-empty">No previous chats</div>
          ) : (
            chats.map(chat => (
              <div 
                key={chat._id} 
                className={`history-item ${activeChatId === chat._id ? 'active' : ''}`}
                onClick={() => handleSelectChat(chat._id)}
              >
                <MessageSquare size={14} style={{ display: 'inline', marginRight: '8px', opacity: 0.6 }} /> 
                {chat.chatName || "New Orchestration"}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="orchestrator-main">
        {/* Thin Header */}
        <div className="orchestrator-header">
          <button className="hamburger-btn" onClick={toggleSidebar} title="Open Menu">
            <Menu size={24} />
          </button>

          <button 
            className="operate-agents-btn"
            onClick={() => navigate('/agents')}
          >
            Operate agents separately
          </button>
          
          <div
            className="header-profile-icon"
            title={user ? `Signed in as ${user.name}` : 'Click to Log In'}
            onClick={() => navigate(user ? '/profile' : '/login')}
            style={{ 
              cursor: 'pointer',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: '700',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '2px solid rgba(255,255,255,0.1)'
            }}
          >
            {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'AC'}
          </div>
        </div>

        {/* Chat Interface */}
        <OrchestratorChat 
          activeChatId={activeChatId} 
          setActiveChatId={setActiveChatId}
          onChatCreated={fetchHistory}
        />

      </div>
    </div>
  );
};

export default OrchestratorLayout;

