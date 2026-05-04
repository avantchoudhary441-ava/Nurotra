import React from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ComposedChart, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, Users, DollarSign, Activity,
    ArrowUpRight, ArrowDownRight, MoreHorizontal, Globe, Shield, Zap, Target,
    MapPin
} from 'lucide-react';

const THEMES = {
    'Midnight Gold': ['#FFD700', '#B8860B', '#DAA520', '#FFEC8B', '#FFD700'],
    'Cyber Teal': ['#00d2d3', '#01a3a4', '#48dbfb', '#222f3e', '#1dd1a1'],
    'Executive Blue': ['#54a0ff', '#2e86de', '#0984e3', '#74b9ff', '#0097e6'],
    'Modern': ['#5f27cd', '#341f97', '#9b59b6', '#8e44ad', '#a29bfe'],
    'Luxury': ['#ee5253', '#ff6b6b', '#ff9f43', '#f368e0', '#ff9ff3'],
    'Vibrant': ['#ff9f43', '#feca57', '#ff6b6b', '#ee5253', '#54a0ff'],
    'default': ['#00d2d3', '#54a0ff', '#5f27cd', '#ff9f43', '#ee5253']
};

const getThemeColors = (themeName) => THEMES[themeName] || THEMES.default;

/**
 * Widget Component
 * Dispatches to specific visualizers based on widget type.
 */
const Widget = ({ widget, index, theme = 'default' }) => {
    const COLORS = getThemeColors(theme);

    const renderKPI = () => {
        const Icon = {
            DollarSign: DollarSign,
            TrendingUp: TrendingUp,
            Package: Globe,
            AlertTriangle: Shield,
            Truck: Zap,
            Users: Users,
            Activity: Activity,
            Target: Target
        }[widget.icon] || Activity;

        return (
            <div className="widget-kpi">
                <div className="kpi-header">
                    <span className="kpi-title">{widget.title}</span>
                    <div className={`kpi-icon-wrapper ${widget.trend}`} style={{ color: COLORS[0], backgroundColor: `${COLORS[0]}20` }}>
                        <Icon size={16} />
                    </div>
                </div>
                <div className="kpi-value">{widget.value}</div>
                <div className={`kpi-change ${widget.trend}`}>
                    {widget.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {widget.change}
                    <span className="kpi-label">vs last period</span>
                </div>
            </div>
        );
    };

    const renderChart = () => {
        const { chartType, data, title, description } = widget;

        const ChartComponent = {
            bar: BarChart,
            line: LineChart,
            pie: PieChart,
            area: AreaChart,
            radar: RadarChart,
            composed: ComposedChart
        }[chartType] || BarChart;

        return (
            <div className="widget-chart-container">
                <div className="chart-info">
                    <h3 className="chart-title">{title}</h3>
                    <p className="chart-description">{description}</p>
                </div>
                <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={240}>
                        {chartType === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={data}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        ) : chartType === 'radar' ? (
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                <PolarAngleAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                <Radar
                                    name={title}
                                    dataKey="value"
                                    stroke={COLORS[0]}
                                    fill={COLORS[0]}
                                    fillOpacity={0.6}
                                />
                                <Tooltip />
                            </RadarChart>
                        ) : (
                            <ChartComponent data={data}>
                                <defs>
                                    <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" hide />
                                <YAxis hide />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1a1a1a',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                    }}
                                />
                                {chartType === 'line' && (
                                    <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={4} dot={{ r: 4, fill: COLORS[0], strokeWidth: 2, stroke: '#fff' }} />
                                )}
                                {chartType === 'bar' && (
                                    <Bar dataKey="value" fill={COLORS[0]} radius={[6, 6, 0, 0]}>
                                        {data.map((entry, idx) => (
                                            <Cell key={`cell-${idx}`} fill={idx === data.length - 1 ? COLORS[0] : `${COLORS[0]}80`} />
                                        ))}
                                    </Bar>
                                )}
                                {chartType === 'area' && (
                                    <Area type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={3} fillOpacity={1} fill={`url(#grad-${index})`} />
                                )}
                                {chartType === 'composed' && (
                                    <>
                                        <Bar dataKey="value" name="Primary" fill={`${COLORS[0]}60`} radius={[4, 4, 0, 0]} />
                                        {data.some(d => d.valueSecondary !== undefined) ? (
                                            <Line type="monotone" dataKey="valueSecondary" name="Secondary" stroke={COLORS[1]} strokeWidth={3} dot={{ r: 4, fill: COLORS[1] }} />
                                        ) : (
                                            <Line type="monotone" dataKey="value" name="Trend" stroke={COLORS[0]} strokeWidth={3} dot={{ r: 4 }} />
                                        )}
                                    </>
                                )}
                                <Legend iconType="circle" />
                            </ChartComponent>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const renderTable = () => (
        <div className="widget-table-container">
            <h3 className="table-title">{widget.title}</h3>
            <div className="table-wrapper">
                <table className="dashboard-table">
                    <thead>
                        <tr>
                            {widget.headers.map(h => <th key={h}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {widget.rows.map((row, ripple) => (
                            <tr key={ripple}>
                                {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderMap = () => {
        const { data, title, description } = widget;
        const mapData = data || [];
        const maxVal = Math.max(...mapData.map(d => d.value || 0), 1);

        return (
            <div className="widget-map-container">
                <div className="chart-info">
                    <h3 className="chart-title">{title}</h3>
                    <p className="chart-description">{description}</p>
                </div>
                <div className="map-grid">
                    {mapData.map((item, idx) => {
                        const regionName = item.region || item.name || 'Unknown';
                        const intensity = Math.max(0.3, (item.value || 0) / maxVal);
                        return (
                            <motion.div
                                key={idx}
                                className="map-region-bubble"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: idx * 0.08, type: 'spring' }}
                                style={{
                                    backgroundColor: `${COLORS[idx % COLORS.length]}${Math.round(intensity * 40).toString(16).padStart(2, '0')}`,
                                    borderColor: COLORS[idx % COLORS.length]
                                }}
                            >
                                <MapPin size={16} style={{ color: COLORS[idx % COLORS.length] }} />
                                <span className="map-region-name">{regionName}</span>
                                <span className="map-region-value" style={{ color: COLORS[idx % COLORS.length] }}>{item.label || item.value}</span>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.1 }}
            className={`dashboard-widget ${widget.type} ${widget.chartType || ''}`}
        >
            <div className="widget-actions">
                <MoreHorizontal size={16} />
            </div>
            {widget.type === 'kpi' && renderKPI()}
            {widget.type === 'chart' && widget.chartType !== 'map' && renderChart()}
            {widget.type === 'chart' && widget.chartType === 'map' && renderMap()}
            {widget.type === 'table' && renderTable()}
            {widget.type === 'map' && renderMap()}
        </motion.div>
    );
};

export default Widget;
