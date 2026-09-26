import type { ClientConfig, SessionResponse } from '@wous/contracts';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, api } from '../services/api.ts';

type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; session: SessionResponse };

type SessionValue = {
  state: SessionState;
  config: ClientConfig | null;
  /** Guarda la sesión que devuelve login o verify-email. */
  setSession(session: SessionResponse): void;
  refresh(): Promise<void>;
  logout(options?: { everywhere?: boolean }): Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Estado de sesión del cliente. La sesión vive en una cookie HttpOnly que el
 * JS no puede leer (§6): el cliente solo pregunta al servidor quién es.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [config, setConfig] = useState<ClientConfig | null>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await api.get<SessionResponse>('/auth/session');
      setState({ status: 'authenticated', session });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') {
        setState({ status: 'anonymous' });
        return;
      }
      setState({ status: 'anonymous' });
    }
  }, []);

  useEffect(() => {
    void refresh();
    api
      .get<ClientConfig>('/config')
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [refresh]);

  const setSession = useCallback((session: SessionResponse) => {
    setState({ status: 'authenticated', session });
  }, []);

  const logout = useCallback(async (options: { everywhere?: boolean } = {}) => {
    await api.post(options.everywhere ? '/auth/logout-all' : '/auth/logout');
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo(
    () => ({ state, config, setSession, refresh, logout }),
    [state, config, setSession, refresh, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession fuera de SessionProvider');
  return value;
}
