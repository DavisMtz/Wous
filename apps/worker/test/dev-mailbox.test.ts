import { describe, expect, it } from 'vitest';
import { DEV_MAILBOX_PREFIX, devMailboxKey } from '../src/email/log-provider.ts';

describe('buzón de desarrollo', () => {
  it('lo más nuevo va primero en orden lexicográfico (como lista R2)', () => {
    const viejo = devMailboxKey(1_790_000_000_000, 'obx_A');
    const nuevo = devMailboxKey(1_790_000_000_001, 'obx_B');
    const muchoDespues = devMailboxKey(2_100_000_000_000, 'obx_C');
    expect([viejo, muchoDespues, nuevo].sort()).toEqual([muchoDespues, nuevo, viejo]);
    expect(nuevo.startsWith(DEV_MAILBOX_PREFIX)).toBe(true);
  });
});
