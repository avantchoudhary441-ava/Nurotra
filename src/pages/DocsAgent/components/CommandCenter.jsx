import React from 'react';
import { Files, Mic, Send, Pause, RotateCcw, CheckCircle } from 'lucide-react';

const CommandCenter = () => {
    return (
        <div className="docs-panel command-center">
            <div className="panel-header">
                <h2>Command Center</h2>
            </div>

            <div className="panel-content">
                <div className="memory-section">
                    <p className="text-sm text-gray-400 mb-2">Context Memory</p>
                    <div className="glass-card p-3 rounded-lg border border-white/5 bg-white/5">
                        <p className="text-xs text-gray-500 italic">Initiate a project to begin building context...</p>
                    </div>
                </div>
            </div>

            <div className="input-container">
                <div className="control-bar">
                    <button className="glass-btn">
                        <Pause size={14} /> Pause
                    </button>
                    <button className="glass-btn">
                        <RotateCcw size={14} /> Undo
                    </button>
                    <button className="glass-btn primary">
                        <CheckCircle size={14} /> Approve
                    </button>
                </div>

                <div className="typing-box-wrapper">
                    <textarea
                        className="typing-box"
                        placeholder="Ask anything..."
                    />
                    <div className="action-row">
                        <div className="action-group">
                            <button className="icon-btn" title="Add files">
                                <Files size={18} />
                            </button>
                            <button className="icon-btn" title="Voice command">
                                <Mic size={18} />
                            </button>
                        </div>
                        <button className="send-btn">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandCenter;
