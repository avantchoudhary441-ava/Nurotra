import React from 'react';
import DynamicGraph from './DynamicGraph';
import {
    FiActivity, FiArrowUpRight, FiArrowDownRight,
    FiBarChart2, FiPieChart, FiTrendingUp, FiTable
} from 'react-icons/fi';

const DashboardHub = ({ data }) => {
    if (!data || !data.dashboard) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                <FiActivity size={48} className="mb-4 opacity-50" />
                <p className="text-xl font-medium">No dashboard data generated yet.</p>
                <p className="text-sm mt-2 max-w-md">
                    Ask the agent to "create a marketing dashboard" or "visualize user metrics" based on your project files.
                </p>
            </div>
        );
    }

    const { dashboard } = data;
    const { title, kpis, widgets, drillDownTable } = dashboard;

    return (
        <div className="dashboard-hub-container h-full overflow-y-auto p-6 bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FiBarChart2 className="text-blue-500" />
                        {title || 'Management Dashboard'}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Nurotra Intelligence · Real-time Analytics</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors border border-gray-700">
                        Export Report
                    </button>
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-gray-900/40 p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">{kpi.label}</span>
                            <div className={`p-2 rounded-lg ${kpi.status === 'success' ? 'bg-green-500/10 text-green-500' :
                                    kpi.status === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                                        'bg-red-500/10 text-red-500'
                                }`}>
                                {kpi.trend?.startsWith('+') ? <FiArrowUpRight /> : <FiArrowDownRight />}
                            </div>
                        </div>
                        <div className="flex items-end gap-3">
                            <h2 className="text-3xl font-bold text-white">{kpi.value}</h2>
                            <span className={`text-xs font-semibold mb-1 ${kpi.trend?.startsWith('+') ? 'text-green-500' : 'text-red-500'
                                }`}>
                                {kpi.trend}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* WIDGET GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {widgets.map((widget, idx) => (
                    <div key={idx} className="bg-gray-900/40 rounded-2xl border border-gray-800 p-1 flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                {widget.type === 'pie' ? <FiPieChart className="text-purple-400" /> : <FiTrendingUp className="text-blue-400" />}
                                {widget.title}
                            </h3>
                        </div>
                        <div className="flex-1">
                            <DynamicGraph config={{ ...widget.config, type: widget.type }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* DRILL DOWN TABLE */}
            {drillDownTable && (
                <div className="bg-gray-900/40 rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="p-5 border-b border-gray-800 flex items-center gap-2">
                        <FiTable className="text-green-400" />
                        <h3 className="font-semibold text-white">Full Dataset Drill-down</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-800/30 text-gray-400 uppercase tracking-tighter text-[10px] font-bold">
                                <tr>
                                    {drillDownTable.headers.map((header, idx) => (
                                        <th key={idx} className="px-6 py-4">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {drillDownTable.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                        {row.map((cell, cidx) => (
                                            <td key={cidx} className="px-6 py-4 text-gray-300 font-medium">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardHub;
