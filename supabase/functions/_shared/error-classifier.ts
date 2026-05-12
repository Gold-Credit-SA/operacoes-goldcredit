// Classifica erros para decidir retry e cobrança.
// - user_error  : culpa do input (CPF inválido, doc não cadastrado). NÃO retry.
// - provider_error: API do provedor respondeu erro (4xx semântico). NÃO retry.
// - network_error: timeout, 5xx, falha de conexão. RETRY OK.

export type ErrorClass = 'user_error' | 'provider_error' | 'network_error';

export interface ClassifiedError {
  class: ErrorClass;
  code: string | null;
  message: string;
  retryable: boolean;
  userMessage: string;
}

// Códigos HBI conhecidos. Lista cresce conforme aparecem novos.
const HBI_ERROR_CATALOG: Record<string, Omit<ClassifiedError, 'message'>> = {
  '52':         { class: 'provider_error', code: '52',         retryable: false, userMessage: 'Data-base solicitada não está disponível no SCR. Tente uma data-base anterior.' },
  EAU00001:     { class: 'user_error',     code: 'EAU00001',   retryable: false, userMessage: 'Credenciais HBI inválidas. Contate o administrador.' },
  EGQBP0002:    { class: 'provider_error', code: 'EGQBP0002',  retryable: false, userMessage: 'Serviço SCR não encontrado para o documento informado.' },
  EGQBP0003:    { class: 'provider_error', code: 'EGQBP0003',  retryable: false, userMessage: 'Tipo de consulta SCR inválido. Verifique o uuidTypeScr.' },
};

export function classifyHbiError(payload: unknown, httpStatus: number): ClassifiedError {
  const obj = (payload ?? {}) as Record<string, unknown>;
  const data = (obj.data ?? {}) as Record<string, unknown>;
  const response = (data.response ?? obj.response ?? {}) as Record<string, unknown>;

  const codigoBacen = response.codigo;
  const errorCode = obj.code ?? data.code;
  const rawMessage =
    (obj.message as string) ||
    (data.message as string) ||
    (response.mensagem as string) ||
    `Erro HTTP ${httpStatus}`;

  // Erro Bacen código 52 (data-base indisponível)
  if (codigoBacen === '52' || codigoBacen === 52) {
    return { ...HBI_ERROR_CATALOG['52'], message: rawMessage };
  }

  if (errorCode && typeof errorCode === 'string' && HBI_ERROR_CATALOG[errorCode]) {
    return { ...HBI_ERROR_CATALOG[errorCode], message: rawMessage };
  }

  // 5xx ou network → retry
  if (httpStatus >= 500 || httpStatus === 0) {
    return {
      class: 'network_error',
      code: String(httpStatus || 'NETWORK'),
      message: rawMessage,
      retryable: true,
      userMessage: 'Falha temporária no provedor. Será feita nova tentativa automaticamente.',
    };
  }

  // 4xx genérico
  return {
    class: 'provider_error',
    code: (typeof errorCode === 'string' ? errorCode : null) || String(httpStatus),
    message: rawMessage,
    retryable: false,
    userMessage: rawMessage,
  };
}

export function classifyNetworkError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err);
  return {
    class: 'network_error',
    code: 'NETWORK',
    message,
    retryable: true,
    userMessage: 'Falha de conexão com o provedor. Tente novamente em alguns instantes.',
  };
}
