import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
  isDomMutationError: boolean;
  recoveryKey: number;
}

/**
 * Captura erros de render que normalmente causariam tela branca.
 * - ChunkLoadError (cache desatualizado após deploy) → reload limpo automático
 * - DOM mutation errors (removeChild/insertBefore) causados por extensões do navegador
 *   (Google Translate, etc.) → auto-recovery silencioso por re-mount
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    isChunkError: false,
    isDomMutationError: false,
    recoveryKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    const msg = String(error?.message || '');
    const name = String(error?.name || '');
    const isChunkError =
      name === 'ChunkLoadError' ||
      /Loading chunk [\d]+ failed/i.test(msg) ||
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg);

    // Erros causados por extensões que mexem no DOM (Google Translate, etc.)
    const isDomMutationError =
      /removeChild|insertBefore|Failed to execute 'removeChild'|Failed to execute 'insertBefore'|não é filho deste nó|is not a child of this node/i.test(
        msg
      );

    return { hasError: true, error, isChunkError, isDomMutationError };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log estruturado para debug remoto
    console.error('[ErrorBoundary] Render error:', error, info);

    // Chunk error: força reload limpo automaticamente (1x)
    if (this.state.isChunkError && !sessionStorage.getItem('chunk-reload-attempted')) {
      sessionStorage.setItem('chunk-reload-attempted', '1');
      window.location.reload();
      return;
    }

    // DOM mutation error de extensão: re-monta a árvore silenciosamente
    if (this.state.isDomMutationError) {
      const attempts = Number(sessionStorage.getItem('dom-recovery-attempts') || '0');
      if (attempts < 2) {
        sessionStorage.setItem('dom-recovery-attempts', String(attempts + 1));
        // Re-monta no próximo tick para deixar o DOM se estabilizar
        setTimeout(() => {
          this.setState((s) => ({
            hasError: false,
            error: null,
            isChunkError: false,
            isDomMutationError: false,
            recoveryKey: s.recoveryKey + 1,
          }));
        }, 50);
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('chunk-reload-attempted');
    sessionStorage.removeItem('dom-recovery-attempts');
    window.location.reload();
  };

  handleGoHome = () => {
    sessionStorage.removeItem('chunk-reload-attempted');
    sessionStorage.removeItem('dom-recovery-attempts');
    window.location.href = '/';
  };

  render() {
    // Re-mount silencioso após recovery: nova key força árvore limpa
    if (!this.state.hasError) {
      return (
        <React.Fragment key={this.state.recoveryKey}>
          {this.props.children}
        </React.Fragment>
      );
    }

    // Em recovery silencioso (DOM mutation), não mostra tela de erro
    if (this.state.isDomMutationError) {
      return null;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {this.state.isChunkError ? 'Atualização disponível' : 'Algo deu errado'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {this.state.isChunkError
              ? 'Uma nova versão do sistema foi publicada. Recarregue para continuar.'
              : 'Encontramos um erro ao carregar esta tela. Tente recarregar — se persistir, volte para a página inicial.'}
          </p>
          {!this.state.isChunkError && this.state.error?.message && (
            <pre className="text-[10px] text-left bg-muted p-3 rounded overflow-auto max-h-32 text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={this.handleReload} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
            </Button>
            <Button onClick={this.handleGoHome} variant="outline">
              Ir para o início
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
