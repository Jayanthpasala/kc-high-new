
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Standard React Error Boundary component.
 */
// Fix: Explicitly inherit from React.Component to ensure props and setState are correctly linked in the type system.
class ErrorBoundary extends React.Component<Props, State> {
  // Fix: Initializing state without the override modifier to resolve the compilation error.
  public state: State = {
    hasError: false,
    error: undefined
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Fix: Removed the override modifier as the compiler fails to recognize inheritance in the current environment.
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in module:", error, errorInfo);
  }

  // Arrow function for lexical binding of 'this'
  private handleReset = () => {
    // Fix: this.setState is now correctly inherited from React.Component.
    this.setState({ hasError: false, error: undefined });
  };

  // Fix: Removed the override modifier for the render method.
  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-rose-50 p-10 rounded-[2.5rem] border-2 border-dashed border-rose-200 text-center animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 text-rose-500 border-2 border-rose-100">
                <AlertTriangle size={40} />
            </div>
            <h2 className="text-3xl font-black text-rose-900 tracking-tight">Module Failure Detected</h2>
            <p className="text-rose-700/80 max-w-lg mx-auto mt-4 font-semibold">
              An unexpected error occurred in this section of the application. Your other modules are still operational.
            </p>
            {this.state.error && (
              <pre className="mt-6 text-left bg-rose-100/50 text-rose-800 p-4 rounded-xl text-xs overflow-auto max-h-32 border border-rose-200">
                {this.state.error.toString()}
              </pre>
            )}
            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                onClick={this.handleReset}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Reload Module
              </button>
            </div>
        </div>
      );
    }

    // Fix: Correctly access children through this.props inherited from React.Component.
    return this.props.children;
  }
}

export default ErrorBoundary;
