import { describe, expect, it } from 'vitest';
import * as entry from '../src/index.ts';

describe('módulo de entrada del Worker', () => {
  it('solo exporta el handler por defecto y clases (workerd rechaza cualquier otra cosa)', () => {
    for (const [name, value] of Object.entries(entry)) {
      if (name === 'default') {
        expect(typeof value).toBe('object');
        continue;
      }
      // Un string o número exportado aquí tumba `wrangler dev` y el deploy.
      expect(typeof value, `export «${name}»`).toBe('function');
    }
  });
});
