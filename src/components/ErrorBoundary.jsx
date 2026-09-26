import React from 'react';
import { IconAlert, IconReset } from './icons.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="panel empty" role="alert" style={{ minHeight: '16rem' }}>
          <div className="empty-icon" style={{ color: 'var(--danger-text)' }}><IconAlert size={20} /></div>
          <p className="empty-title">Something went wrong</p>
          <p className="empty-desc mono" style={{ fontSize: '0.75rem' }}>{this.state.error?.message || 'Unknown error'}</p>
          <button type="button" className="btn" onClick={() => this.setState({ hasError: false, error: null })}>
            <IconReset size={14} />Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
