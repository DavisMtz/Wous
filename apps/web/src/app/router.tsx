import {
  type AnchorHTMLAttributes,
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Router mínimo sobre la History API: pocas rutas, sin dependencias. Las
 * rutas de los enlaces de correo (/verify-email, /reset-password) son las del
 * plan y las arma el servidor.
 */
export const ROUTES = {
  home: '/',
  register: '/register',
  login: '/login',
  checkEmail: '/check-email',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

type Location = { path: string; search: URLSearchParams };

type RouterValue = {
  location: Location;
  navigate(to: string, options?: { replace?: boolean; state?: unknown }): void;
};

const RouterContext = createContext<RouterValue | null>(null);

function readLocation(): Location {
  return { path: window.location.pathname, search: new URLSearchParams(window.location.search) };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback<RouterValue['navigate']>((to, options = {}) => {
    const url = new URL(to, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error('Navegación fuera del sitio');
    const target = `${url.pathname}${url.search}`;
    if (options.replace) window.history.replaceState(options.state ?? null, '', target);
    else window.history.pushState(options.state ?? null, '', target);
    setLocation(readLocation());
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter fuera de RouterProvider');
  return value;
}

/** Quita un parámetro de la barra de direcciones (p. ej. el token de un enlace). */
export function dropQueryParam(name: string) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
