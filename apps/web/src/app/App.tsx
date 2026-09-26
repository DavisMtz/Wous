import { useEffect, useState } from 'react';

type Health = { status: string; environment: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => r.json() as Promise<{ data: Health }>)
      .then((b) => setHealth(b.data))
      .catch(() => setHealth(null));
  }, []);

  return (
    <main>
      <h1>Wous</h1>
      <p>{health ? `Servidor: ${health.status} (${health.environment})` : 'Conectando…'}</p>
    </main>
  );
}
