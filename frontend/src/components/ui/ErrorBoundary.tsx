import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-[400px] animate-fade-in">
          <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-danger/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-danger" />
          </div>
          <h2 className="text-[18px] font-semibold mb-2">出错了</h2>
          <p className="text-[14px] text-text-secondary mb-6 leading-relaxed">
            页面遇到了意外错误，请尝试刷新
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-[14px] font-medium rounded-[var(--radius-md)] hover:bg-accent-hover transition-colors"
          >
            <RefreshCw size={16} />
            重试
          </button>
        </div>
      </div>
    );
  }
}
