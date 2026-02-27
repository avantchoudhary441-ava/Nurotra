import React, { useState, useEffect } from 'react';
import {
    ChevronDown,
    ChevronRight,
    FileText,
    Download,
    FolderOpen,
    File,
    RefreshCw,
    Copy,
    Edit3,
    Search,
    Settings,
    Grid3X3,
    MoreVertical
} from 'lucide-react';
import { docsAgentService } from '../../../services/docsAgentService';
import DocEditModal from './DocEditModal';

const ProjectsDocs = ({
    projects,
    standaloneDocs,
    onOpenDoc,
    onOpenProject,
    onUpdateDoc,
    isSyncing,
    activeDocId,
    activeProjectId,
    currentWorkspace,
    onPickWorkspace
}) => {
    const [expandedFolders, setExpandedFolders] = useState({});
    const [workspaceTree, setWorkspaceTree] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (currentWorkspace) {
            loadTree();
        }
    }, [currentWorkspace]);

    const loadTree = async () => {
        setLoading(true);
        try {
            const tree = await docsAgentService.getWorkspaceTree(currentWorkspace);
            setWorkspaceTree(tree);
        } catch (error) {
            console.error("Sidebar: Failed to load tree:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleFolder = (path) => {
        setExpandedFolders(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'word': return <FileText size={14} className="text-blue-400" />;
            case 'excel': return <Grid3X3 size={14} className="text-emerald-400" />;
            case 'ppt': return <File size={14} className="text-orange-400" />;
            default: return <File size={14} className="text-gray-400" />;
        }
    };

    const renderTree = (nodes) => {
        return nodes
            .filter(node => node.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((node) => {
                if (node.type === 'folder') {
                    const isOpen = expandedFolders[node.path];
                    return (
                        <div key={node.path} className="tree-node folder-node">
                            <div className="node-content" onClick={() => toggleFolder(node.path)}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <FolderOpen size={14} className="text-amber-400 opacity-80" />
                                <span className="node-name">{node.name}</span>
                            </div>
                            {isOpen && <div className="node-children">{renderTree(node.children)}</div>}
                        </div>
                    );
                } else {
                    const isActive = activeDocId === node.path;
                    return (
                        <div
                            key={node.path}
                            className={`tree-node file-node ${isActive ? 'active' : ''}`}
                            onClick={() => onOpenDoc({ id: node.path, name: node.name, type: node.type })}
                        >
                            <div className="node-content">
                                <span className="node-icon">{getFileIcon(node.type)}</span>
                                <span className="node-name">{node.name}</span>
                            </div>
                        </div>
                    );
                }
            });
    };

    return (
        <div className="projects-docs-panel explorer-mode">
            {/* Explorer Header */}
            <div className="panel-header">
                <div className="title-group">
                    <span className="explorer-label">EXPLORER</span>
                </div>
                <div className="header-controls">
                    <button className="new-project-btn" onClick={loadTree} title="Refresh Tree">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="new-project-btn" onClick={onPickWorkspace} title="Switch Workspace">
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {/* Path Breadcrumb (Mini) */}
            <div className="workspace-breadcrumb">
                <FolderOpen size={12} className="opacity-50" />
                <span>{currentWorkspace?.split('\\').pop() || 'No Workspace'}</span>
            </div>

            {/* Search Explorer */}
            <div className="explorer-search">
                <Search size={12} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* File Tree */}
            <div className="explorer-tree-container">
                {currentWorkspace ? (
                    loading && workspaceTree.length === 0 ? (
                        <div className="tree-loading">Scanning...</div>
                    ) : (
                        <div className="tree-content">
                            {renderTree(workspaceTree)}
                        </div>
                    )
                ) : (
                    <div className="no-workspace-state">
                        <FolderOpen size={32} className="opacity-20 mb-2" />
                        <p>No workspace opened</p>
                        <button onClick={onPickWorkspace} className="open-ws-btn">Open Folder</button>
                    </div>
                )}
            </div>

            {/* Sidebar Bottom Actions */}
            <div className="sidebar-footer">
                <div className="footer-action" onClick={() => docsAgentService.openWorkspace()}>
                    <FolderOpen size={14} />
                    <span>Open in OS</span>
                </div>
            </div>

            {/* Doc Edit Modal (Legacy Support) */}
            {editingDoc && (
                <DocEditModal
                    doc={editingDoc}
                    onSave={async (docId, metadata) => {
                        const updated = await docsAgentService.updateDocumentMetadata(docId, metadata);
                        if (onUpdateDoc) onUpdateDoc(updated);
                    }}
                    onClose={() => setEditingDoc(null)}
                />
            )}
        </div>
    );
};

export default ProjectsDocs;
