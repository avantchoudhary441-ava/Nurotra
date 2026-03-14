import React, { useState } from 'react';
import { LayoutGrid, FilePlus, Sparkles, Target, Zap, ArrowRight, Activity } from 'lucide-react';

const EntryPoint = ({ onCreateProject, onCreateSingleDoc }) => {
    const [view, setView] = useState('selection'); // selection, project-form

    const [projectData, setProjectData] = useState({
        name: '',
        motive: '',
        keywords: ''
    });

    if (view === 'project-form') {
        return (
            <div className="entry-form-container">
                <button className="back-btn" onClick={() => setView('selection')}>← Back</button>
                <div className="entry-header">
                    <Target className="entry-icon pulse-blue" size={40} />
                    <h2>Establish Context</h2>
                    <p>Building a context boundary for your future automation.</p>
                </div>

                <div className="form-group">
                    <label>Project Name</label>
                    <input
                        type="text"
                        placeholder="e.g. PhD Research – 2026"
                        value={projectData.name}
                        onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>Motive / Goal</label>
                    <textarea
                        placeholder="What is the ultimate objective of this project?"
                        value={projectData.motive}
                        onChange={(e) => setProjectData({ ...projectData, motive: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>Keywords (Comma separated)</label>
                    <input
                        type="text"
                        placeholder="Legal, Compliance, ABC Corp"
                        value={projectData.keywords}
                        onChange={(e) => setProjectData({ ...projectData, keywords: e.target.value })}
                    />
                </div>

                <button className="create-submit-btn" onClick={() => onCreateProject(projectData)}>
                    Launch Project <ArrowRight size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="entry-point-container">
            <div className="welcome-section">
                <h1 className="glow-text">System Ready.</h1>
                <p>Establishing document execution environment.</p>
            </div>

            <div className="action-cards">
                <div className="action-card project-card" onClick={() => setView('project-form')}>
                    <div className="card-badge">LONG-TERM</div>
                    <div className="card-icon-wrapper">
                        <LayoutGrid size={32} />
                    </div>
                    <h3>Create a Project</h3>
                    <p>Context boundary. Memory container. Future automation hub.</p>
                    <ul className="card-features">
                        <li><Sparkles size={14} /> Smart Memory</li>
                        <li><Target size={14} /> Expert Standards</li>
                        <li><Zap size={14} /> Connected History</li>
                    </ul>
                    <div className="card-footer">
                        <span className="cta-text">Launch Project</span>
                        <ArrowRight size={16} />
                    </div>
                </div>

                <div className="action-card document-card" onClick={onCreateSingleDoc}>
                    <div className="card-badge">FAST TRACK</div>
                    <div className="card-icon-wrapper">
                        <FilePlus size={32} />
                    </div>
                    <h3>Single Document</h3>
                    <p>Fast action. Smart details. Simple and quick.</p>
                    <ul className="card-features">
                        <li><Zap size={14} /> Quick start</li>
                        <li><Sparkles size={14} /> Smart details</li>
                        <li><Target size={14} /> Connects to projects</li>
                    </ul>
                    <div className="card-footer">
                        <span className="cta-text">Start Execution</span>
                        <ArrowRight size={16} />
                    </div>
                </div>

            </div>

            <div className="execution-philosophy">
                <span>NOT A CHAT TOOL</span>
                <span className="dot"></span>
                <span>DOCUMENT EXECUTION SYSTEM</span>
            </div>
        </div>
    );
};

export default EntryPoint;
