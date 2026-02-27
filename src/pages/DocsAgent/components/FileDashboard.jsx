import React, { useState, useEffect } from 'react';
import {
    Clock,
    Folder,
    Plus,
    Search,
    FileText,
    ChevronRight,
    LayoutGrid,
    Star,
    ArrowUpRight,
    ExternalLink
} from 'lucide-react';
import { docsAgentService } from '../../../services/docsAgentService';

const FileDashboard = ({ onOpenFile, onCreateNew, currentWorkspace }) => {
    const [recentFiles, setRecentFiles] = useState([]);
    const [pinnedFolders, setPinnedFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (currentWorkspace) {
            loadRecentFiles();
            // Mock pinned folders for now
            setPinnedFolders([
                { name: 'Legal Documents', path: `${currentWorkspace}/Legal` },
                { name: 'Marketing Research', path: `${currentWorkspace}/Marketing` }
            ]);
        }
    }, [currentWorkspace]);

    const loadRecentFiles = async () => {
        setLoading(true);
        try {
            const files = await docsAgentService.getRecentWorkspaceFiles(currentWorkspace);
            setRecentFiles(files);
        } catch (error) {
            console.error("Dashboard: Failed to load recent files:", error);
        } finally {
            setLoading(false);
        }
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'word': return <FileText className="text-blue-400" size={20} />;
            case 'excel': return <LayoutGrid className="text-emerald-400" size={20} />;
            case 'ppt': return <ArrowUpRight className="text-orange-400" size={20} />;
            default: return <FileText className="text-gray-400" size={20} />;
        }
    };

    const formatDate = (date) => {
        const d = new Date(date);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filteredFiles = recentFiles.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="file-dashboard">
            <div className="dashboard-header">
                <div>
                    <h1>Document Execution Workspace</h1>
                    <p className="workspace-path">
                        <Folder size={14} className="inline mr-1 opacity-60" />
                        {currentWorkspace || 'No workspace selected'}
                    </p>
                </div>
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search files in workspace..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="dashboard-grid">
                <section className="dashboard-section recent-files">
                    <div className="section-header">
                        <div className="title-wrapper">
                            <Clock size={16} />
                            <h2>Recent Files</h2>
                        </div>
                        <button className="view-all">View All</button>
                    </div>

                    <div className="file-list">
                        {loading ? (
                            <div className="dashboard-loader">Scanning filesystem...</div>
                        ) : filteredFiles.length > 0 ? (
                            filteredFiles.map((file, idx) => (
                                <div
                                    key={idx}
                                    className="dashboard-file-card"
                                    onClick={() => onOpenFile(file)}
                                >
                                    <div className="file-main">
                                        <div className="file-icon-bg">
                                            {getFileIcon(file.type)}
                                        </div>
                                        <div className="file-info">
                                            <span className="file-name">{file.name}</span>
                                            <span className="file-meta">{formatDate(file.updatedAt)}</span>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="open-icon" />
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No recent files found in this workspace.</div>
                        )}
                    </div>
                </section>

                <div className="dashboard-sidebar-panels">
                    <section className="dashboard-section quick-actions">
                        <h2>Quick Actions</h2>
                        <div className="action-buttons">
                            <button className="dash-btn primary" onClick={onCreateNew}>
                                <Plus size={18} />
                                <span>Create New Document</span>
                            </button>
                            <button className="dash-btn secondary">
                                <Plus size={18} />
                                <span>New Spreadsheet</span>
                            </button>
                        </div>
                    </section>

                    <section className="dashboard-section pinned-folders">
                        <div className="section-header">
                            <div className="title-wrapper">
                                <Star size={16} />
                                <h2>Pinned Folders</h2>
                            </div>
                        </div>
                        <div className="folder-list">
                            {pinnedFolders.map((folder, idx) => (
                                <div key={idx} className="pinned-folder-item">
                                    <Folder size={16} className="text-blue-400" />
                                    <span>{folder.name}</span>
                                    <ChevronRight size={14} className="ml-auto opacity-40" />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default FileDashboard;
