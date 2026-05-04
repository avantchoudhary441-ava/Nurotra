import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Widget from './Widget';
import '../../styles/dashboard/DashboardRenderer.css';

/**
 * DashboardRenderer
 * Renders a dynamic, grid-based dashboard from AI-generated JSON.
 */
const DashboardRenderer = ({ dashboard, onUpdateWidget }) => {
    if (!dashboard || !dashboard.widgets) {
        return (
            <div className="dashboard-empty-state">
                <p>Generating your visual intelligence board...</p>
            </div>
        );
    }

    const { title, widgets } = dashboard;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="dashboard-title"
                >
                    {title}
                </motion.h1>
                <div className="dashboard-meta">
                    <span className="live-indicator">● LIVE ANALYTICS</span>
                </div>
            </header>

            <motion.div
                className="dashboard-grid"
                layout
            >
                <AnimatePresence>
                    {widgets.map((widget, index) => (
                        <Widget
                            key={`${widget.type}-${index}`}
                            widget={widget}
                            index={index}
                            theme={dashboard.theme || 'default'}
                        />
                    ))}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default DashboardRenderer;
