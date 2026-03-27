import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Menu } from 'lucide-react';
import OrchestratorChat from './OrchestratorChat';
import '../../styles/orchestrator.css'; 

const OrchestratorLayout = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

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
          
          <div className="orchestrator-profile" title="Signed in as Avant Choudhary">
            AC
          </div>
        </div>

        {/* Chat Interface */}
        <OrchestratorChat />

      </div>
    </div>
  );
};

export default OrchestratorLayout;
