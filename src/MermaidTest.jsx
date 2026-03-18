import React from 'react';
import MermaidDiagram from './components/MermaidDiagram';

const MermaidTest = () => {
    const chart1 = `
    graph TD;
      A[Start] --> B(Process);
      B --> C{Decision};
      C -->|Yes| D[Result 1];
      C -->|No| E[Result 2];
  `;

    const chart2 = `
    sequenceDiagram
      Alice->>John: Hello John, how are you?
      John-->>Alice: Great!
      Alice-)John: See you later!
  `;

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Mermaid Diagram Test</h1>

            <section style={{ marginBottom: '40px' }}>
                <h2>Flowchart:</h2>
                <MermaidDiagram definition={chart1} id="flowchart" />
            </section>

            <section>
                <h2>Sequence Diagram:</h2>
                <MermaidDiagram definition={chart2} id="sequence" />
            </section>
        </div>
    );
};

export default MermaidTest;
