import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirestoreError = false;

      try {
        const errorData = JSON.parse(this.state.error?.message || '');
        if (errorData.error && errorData.operationType) {
          isFirestoreError = true;
          errorMessage = `Firestore Error: ${errorData.error} during ${errorData.operationType} on ${errorData.path}`;
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-red-100 text-center">
            <div className="inline-flex p-4 bg-red-50 rounded-3xl mb-6">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-8">{errorMessage}</p>
            
            <button
              onClick={this.handleReset}
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCw className="h-5 w-5" />
              Refresh Application
            </button>
            
            {isFirestoreError && (
              <p className="mt-6 text-xs text-gray-400">
                This error has been logged for our administrators to investigate.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
