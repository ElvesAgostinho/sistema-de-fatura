'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; name?: string; }
interface State { hasError: boolean; error: Error | null; }

export default class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error('[PanelErrorBoundary]', this.props.name ?? 'panel', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="ms-card p-6 space-y-3 border border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Não foi possível carregar este painel</p>
              <p className="text-xs text-muted-foreground mt-1">
                {this.state.error?.message ?? 'Erro inesperado'}
              </p>
              <button
                type="button"
                onClick={this.reset}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium hover:bg-secondary"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
