import React from 'react';
import { Folder, File, Share2, Plus } from 'lucide-react';

const ProjectWorkspace = () => {
    return (
        <div className="docs-panel project-workspace">
            <div className="panel-header">
                <h2>Projects & Outputs</h2>
                <button className="icon-btn hover:bg-white/10" title="New Project">
                    <Plus size={18} />
                </button>
            </div>

            <div className="panel-content">
                <div className="project-list space-y-2">
                    <div className="project-item active flex items-center justify-between p-2 rounded bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2">
                            <Folder size={16} className="text-cyan-400" />
                            <span className="text-sm">Global Strategy</span>
                        </div>
                    </div>
                    <div className="project-item flex items-center justify-between p-2 rounded hover:bg-white/5 border border-transparent transition-all">
                        <div className="flex items-center gap-2">
                            <Folder size={16} className="text-gray-500" />
                            <span className="text-sm">Marketing Deck</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Connections</p>
                    <div className="connections-grid grid grid-cols-2 gap-2">
                        <div className="conn-card p-2 rounded border border-white/5 bg-white/[0.02] text-center">
                            <Share2 size={12} className="mx-auto mb-1 opacity-40" />
                            <span className="text-[10px] opacity-60">Sync App</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectWorkspace;
