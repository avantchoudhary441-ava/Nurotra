import React from 'react';
import { Play, FileText, Zap } from 'lucide-react';

const ExecutionHub = () => {
    return (
        <div className="docs-panel execution-hub">
            <div className="panel-header">
                <h2>Execution & Live Work</h2>
                <div className="badge flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400">
                    <Zap size={10} /> LIVE
                </div>
            </div>

            <div className="panel-content">
                <div className="execution-steps space-y-4">
                    <div className="step-item opacity-50 flex gap-3">
                        <div className="step-num text-xs font-mono border border-white/20 w-5 h-5 flex items-center justify-center rounded">1</div>
                        <div className="step-info">
                            <p className="text-sm">Ready to begin...</p>
                        </div>
                    </div>

                    <div className="doc-preview mt-8 aspect-[3/4] rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5" />
                        <div className="text-center z-10">
                            <FileText className="mx-auto mb-2 text-white/20" size={48} />
                            <p className="text-sm text-white/30">Document workspace active</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutionHub;
