import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("🛑 ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 border border-destructive rounded-md bg-destructive/10">
            <h3 className="font-semibold text-destructive mb-2">A apărut o eroare</h3>
            <pre className="text-xs whitespace-pre-wrap text-destructive">
              {this.state.error?.message}
            </pre>
            <button
              onClick={this.reset}
              className="mt-3 px-3 py-1 text-sm bg-primary text-primary-foreground rounded"
            >
              Încearcă din nou
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
