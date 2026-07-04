'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. If not provided, uses the default error card. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional label to identify which part of the UI crashed */
  section?: string;
}

/**
 * ErrorBoundary — Captura crashes de componentes React e exibe UI amigável.
 * Envolve layouts e secções críticas para evitar que um crash derrube toda a página.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log para console em dev; em produção enviar para serviço de monitorização
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', this.props.section ?? 'App', error, errorInfo);
    } else {
      // Aqui pode-se integrar Sentry, LogRocket, etc.
      console.error('[ErrorBoundary] Crash em:', this.props.section ?? 'App', error.message);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, section } = this.props;

    if (hasError && error) {
      if (fallback) return fallback(error, this.reset);

      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="error-boundary-title">Algo correu mal</h2>
            <p className="error-boundary-subtitle">
              {section ? `Ocorreu um erro em "${section}".` : 'Esta secção encontrou um problema inesperado.'}
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="error-boundary-detail">{error.message}</pre>
            )}
            <div className="error-boundary-actions">
              <button onClick={this.reset} className="error-boundary-btn error-boundary-btn--primary">
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
              <button onClick={() => window.location.reload()} className="error-boundary-btn">
                Recarregar página
              </button>
            </div>
          </div>
          <style>{`
            .error-boundary-container {
              min-height: 300px;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2rem;
            }
            .error-boundary-card {
              background: rgb(var(--card));
              border: 1px solid rgb(var(--border));
              border-radius: 12px;
              padding: 2.5rem;
              max-width: 480px;
              width: 100%;
              text-align: center;
              box-shadow: 0 8px 32px rgba(0,0,0,0.08);
            }
            .error-boundary-icon {
              width: 56px; height: 56px; border-radius: 50%;
              background: rgb(var(--destructive) / 0.1);
              color: rgb(var(--destructive));
              display: flex; align-items: center; justify-content: center;
              margin: 0 auto 1.25rem;
            }
            .error-boundary-title {
              font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;
              color: rgb(var(--foreground));
            }
            .error-boundary-subtitle {
              color: rgb(var(--muted-foreground)); font-size: 0.9rem;
              margin-bottom: 1.5rem; line-height: 1.6;
            }
            .error-boundary-detail {
              background: rgb(var(--muted));
              border-radius: 6px; padding: 0.75rem;
              font-size: 0.75rem; text-align: left;
              overflow: auto; max-height: 120px;
              margin-bottom: 1.5rem;
              color: rgb(var(--destructive));
              border: 1px solid rgb(var(--border));
            }
            .error-boundary-actions {
              display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;
            }
            .error-boundary-btn {
              display: inline-flex; align-items: center; gap: 6px;
              padding: 0.55rem 1.25rem; border-radius: 8px;
              font-size: 0.875rem; font-weight: 500; cursor: pointer;
              border: 1px solid rgb(var(--border));
              background: rgb(var(--background));
              color: rgb(var(--foreground));
              transition: all 0.2s;
            }
            .error-boundary-btn:hover { background: rgb(var(--secondary)); }
            .error-boundary-btn--primary {
              background: rgb(var(--primary));
              color: rgb(var(--primary-foreground));
              border-color: transparent;
            }
            .error-boundary-btn--primary:hover { opacity: 0.9; }
          `}</style>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
