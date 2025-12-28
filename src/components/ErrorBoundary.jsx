import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: '#f87171', background: 'rgba(50,0,0,0.5)', borderRadius: '8px' }}>
                    <h4>⚠️ Component Crashed</h4>
                    <p>{this.state.error?.toString()}</p>
                    <button onClick={() => this.setState({ hasError: false })} style={{ marginTop: '10px', padding: '5px 10px' }}>
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
