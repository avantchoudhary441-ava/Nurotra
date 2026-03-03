import React from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const DynamicGraph = ({ config }) => {
    if (!config || !config.data || !Array.isArray(config.data)) {
        return <div className="p-4 text-gray-400 italic">No graph data provided</div>;
    }

    const { type = 'bar', title = 'Chart', data, xAxisName, yAxisName } = config;

    const renderChart = () => {
        switch (type.toLowerCase()) {
            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                );
            case 'line':
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" label={{ value: xAxisName, position: 'insideBottom', offset: -5 }} stroke="#888" />
                        <YAxis label={{ value: yAxisName, angle: -90, position: 'insideLeft' }} stroke="#888" />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} />
                    </LineChart>
                );
            case 'bar':
            default:
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" label={{ value: xAxisName, position: 'insideBottom', offset: -5 }} stroke="#888" />
                        <YAxis label={{ value: yAxisName, angle: -90, position: 'insideLeft' }} stroke="#888" />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                        <Legend />
                        <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                );
        }
    };

    return (
        <div className="dynamic-graph-container p-6 bg-gray-900/50 rounded-xl border border-gray-800 my-4">
            <h3 className="text-lg font-semibold mb-6 text-white text-center">{title}</h3>
            <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DynamicGraph;
