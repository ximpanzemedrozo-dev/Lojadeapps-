import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Ops! Algo deu errado.</h1>
          <p className="text-gray-400 mb-6 max-w-md">
            Ocorreu um erro inesperado. Por favor, tente recarregar a página ou verifique sua conexão.
          </p>
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-left w-full max-w-lg overflow-auto">
            <code className="text-xs text-red-400">
              {this.state.error?.message}
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-8 py-3 rounded-xl font-bold transition-all"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
