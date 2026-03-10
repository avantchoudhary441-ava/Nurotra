import React, { useState } from 'react';
import { FiDatabase, FiExternalLink, FiLock, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { SiPowerbi } from 'react-icons/si';

const PowerBIEmbed = ({ config }) => {
    const [status, setStatus] = useState(config?.status || 'CONNECTION_PENDING');

    const handleConnect = () => {
        // Simulate OAuth flow
        setStatus('CONNECTING');
        setTimeout(() => setStatus('CONNECTED'), 2000);
    };

    if (status === 'CONNECTED') {
        return (
            <div className="flex flex-col h-full bg-[#1a1c2e]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <SiPowerbi className="text-[#F2C811] text-2xl" />
                        <div>
                            <h2 className="text-white font-bold text-lg leading-none">Marketing Intelligence Report</h2>
                            <p className="text-gray-400 text-[10px] mt-1 flex items-center gap-1">
                                <FiCheckCircle className="text-green-500" /> Connected to Microsoft Power BI
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-white text-[10px] uppercase font-bold tracking-widest">Live</span>
                        </div>
                        <button className="text-gray-400 hover:text-white transition-colors">
                            <FiExternalLink size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 relative overflow-hidden flex items-center justify-center group">
                    {/* Mock Power BI iFrame */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#121421] to-[#1a1c2e] flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-full h-full border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center bg-black/20">
                            <SiPowerbi className="text-[120px] text-gray-800 mb-6 opacity-20" />
                            <h3 className="text-gray-600 text-xl font-medium">Power BI Interactive Report</h3>
                            <p className="text-gray-700 text-sm mt-4 max-w-sm">
                                [ Live Embed Container ]
                                <br />
                                iFrame source: https://app.powerbi.com/reportEmbed?reportId=...
                            </p>

                            <div className="mt-8 px-6 py-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center gap-3 animate-pulse">
                                <FiInfo />
                                <span className="text-sm font-medium">Retrieving real-time workspace datasets...</span>
                            </div>
                        </div>
                    </div>

                    {/* Overlay for Premium Look */}
                    <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl max-w-xs shadow-2xl opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                        <p className="text-white text-xs font-medium leading-relaxed">
                            This report is connected to the <span className="text-blue-400 font-bold">Nurotra Marketing</span> dataset via Microsoft Graph.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] p-12 text-center">
            <div className="w-24 h-24 bg-[#F2C811]/10 rounded-3xl flex items-center justify-center mb-8 border border-[#F2C811]/20 shadow-[0_0_50px_rgba(242,200,17,0.1)]">
                <SiPowerbi className="text-[#F2C811] text-5xl" />
            </div>

            <h1 className="text-3xl font-bold text-white mb-4">Integrate Microsoft Power BI</h1>
            <p className="text-gray-400 max-w-md mb-10 leading-relaxed text-lg">
                Connect your business intelligence ecosystem to Nurotra and visualize your enterprise data directly within the agent workspace.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-12">
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left">
                    <FiLock className="text-blue-400 text-2xl mb-3" />
                    <h3 className="text-white font-semibold mb-1">Secure Integration</h3>
                    <p className="text-gray-500 text-xs">OAuth 2.0 based secure connection to your Microsoft Azure workspace.</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left">
                    <FiDatabase className="text-purple-400 text-2xl mb-3" />
                    <h3 className="text-white font-semibold mb-1">Dataset Sync</h3>
                    <p className="text-gray-500 text-xs">Automatically cross-reference project files with live BI datasets.</p>
                </div>
            </div>

            <button
                onClick={handleConnect}
                disabled={status === 'CONNECTING'}
                className={`px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${status === 'CONNECTING'
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-[#F2C811] text-black hover:bg-[#ffda3d] hover:shadow-[#F2C811]/20'
                    }`}
            >
                {status === 'CONNECTING' ? (
                    <>
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        Connecting...
                    </>
                ) : (
                    <>
                        <SiPowerbi />
                        Connect Power BI Workspace
                    </>
                )}
            </button>
            <p className="mt-6 text-gray-600 text-xs uppercase font-bold tracking-widest">Powered by Azure Active Directory</p>
        </div>
    );
};

export default PowerBIEmbed;
