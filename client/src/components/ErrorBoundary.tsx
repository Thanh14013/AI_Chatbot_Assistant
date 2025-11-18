import React from "react";
import styles from "./ErrorBoundary.module.css";

interface State {
  hasError: boolean;
  error?: Error | null;
  errorInfo?: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  State
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error("[ErrorBoundary] Caught error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <h2>⚠️ Something went wrong</h2>
          <p>
            An unexpected error occurred. Please refresh the page or contact
            support if the issue persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className={styles.refreshButton}
          >
            Refresh Page
          </button>
          <details className={`${styles.details} ${styles.errorDetails}`}>
            <summary className={styles.errorSummary}>
              Error Details (for developers)
            </summary>
            {this.state.error && this.state.error.toString()}
            {"\n"}
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
