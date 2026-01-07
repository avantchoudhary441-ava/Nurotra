import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { motion } from 'framer-motion';

const data = [
    { subject: 'Profile Quality', A: 120, B: 110, fullMark: 150 },
    { subject: 'Professionalism', A: 98, B: 130, fullMark: 150 },
    { subject: 'Collab Performance', A: 86, B: 130, fullMark: 150 },
    { subject: 'Reliability', A: 99, B: 100, fullMark: 150 },
    { subject: 'Growth Potential', A: 85, B: 90, fullMark: 150 },
];

export default function PentagonGraph({ userData, averageData }) {
    // Merge data for the chart
    // Expected structure: { profile: 80, professionalism: 90, ... }

    const chartData = [
        { subject: 'Profile Quality', user: userData.profile || 0, avg: averageData.profile || 60, fullMark: 100 },
        { subject: 'Professionalism', user: userData.professionalism || 0, avg: averageData.professionalism || 70, fullMark: 100 },
        { subject: 'Collab Performance', user: userData.collab || 0, avg: averageData.collab || 65, fullMark: 100 },
        { subject: 'Reliability', user: userData.reliability || 0, avg: averageData.reliability || 75, fullMark: 100 },
        { subject: 'Growth Potential', user: userData.growth || 0, avg: averageData.growth || 50, fullMark: 100 },
    ];

    return (
        <div style={{ width: '100%', height: '400px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    {/* Platform Average (Silent Comparison) */}
                    <Radar
                        name="Platform Avg"
                        dataKey="avg"
                        stroke="rgba(255,255,255,0.3)"
                        strokeDasharray="4 4"
                        fill="rgba(255,255,255,0.05)"
                        fillOpacity={0.3}
                    />

                    {/* User Data (DNA) */}
                    <Radar
                        name="Your DNA"
                        dataKey="user"
                        stroke="#8b5cf6" // Violet/Purple accent
                        strokeWidth={3}
                        fill="#8b5cf6"
                        fillOpacity={0.5}
                    />
                    <Legend iconType="circle" wrapperStyle={{ color: 'rgba(255,255,255,0.6)' }} />
                </RadarChart>
            </ResponsiveContainer>

            {/* Center Label/Icon if needed */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 0.1,
                pointerEvents: 'none'
            }}>
                <span style={{ fontSize: '4rem' }}>🧬</span>
            </div>
        </div>
    );
}
