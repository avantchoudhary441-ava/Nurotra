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

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

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
        <button className="new-chat-btn">
          <Plus size={18} />
          <span>New chat</span>
        </button>
        
        <div className="history-list">
          <div className="history-item">
            <MessageSquare size={14} style={{ display: 'inline', marginRight: '8px', opacity: 0.6 }} /> 
            Initial Orchestrator Setup
          </div>
          <div className="history-item">
            <MessageSquare size={14} style={{ display: 'inline', marginRight: '8px', opacity: 0.6 }} /> 
            Marketing strategy docs
          </div>
          <div className="history-item">
            <MessageSquare size={14} style={{ display: 'inline', marginRight: '8px', opacity: 0.6 }} /> 
            Automated workflow review
          </div>
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
            style={{ cursor: 'pointer' }}
          >
            👤
          </div>
        </div>

        {/* Chat Interface */}
        <OrchestratorChat />

      </div>
    </div>
  );
};

export default OrchestratorLayout;

