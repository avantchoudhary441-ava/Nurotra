import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'default', // or 'dark', 'neutral', 'forest'
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
});

const MermaidDiagram = ({ definition, id = 'mermaid-diagram' }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        const renderDiagram = async () => {
            if (containerRef.current && definition) {
                try {
                    // Clear previous content
                    containerRef.current.innerHTML = '';

                    // Use a unique ID for each render to avoid conflicts
                    const uniqueId = `${id}-${Math.floor(Math.random() * 10000)}`;

                    const { svg } = await mermaid.render(uniqueId, definition);
                    containerRef.current.innerHTML = svg;

                    // Optional: add some styling to the SVG
                    const svgElement = containerRef.current.querySelector('svg');
                    if (svgElement) {
                        svgElement.style.maxWidth = '100%';
                        svgElement.style.height = 'auto';
                    }
                } catch (error) {
                    console.error('Mermaid rendering failed:', error);
                    containerRef.current.innerHTML = `<div style="color: red; padding: 10px; border: 1px solid red;">
            Failed to render diagram. Please check syntax.
          </div>`;
                }
            }
        };

        renderDiagram();
    }, [definition, id]);

    return (
        <div
            className="mermaid-container"
            ref={containerRef}
            style={{ overflowX: 'auto', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}
        />
    );
};

export default MermaidDiagram;
