import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: 'p-8 text-center',
        style: { color: 'var(--text-muted)' }
      },
        React.createElement('p', { className: 'text-lg font-semibold mb-2' }, 'Something went wrong'),
        React.createElement('p', { className: 'text-sm mb-4' }, this.state.error?.message || 'Unknown error'),
        React.createElement('button', {
          onClick: () => this.setState({ hasError: false, error: null }),
          className: 'px-4 py-2 rounded-lg text-sm font-medium',
          style: { background: 'var(--primary)', color: 'white' }
        }, 'Retry')
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
