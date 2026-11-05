import { describe, expect, it, vi } from 'vitest';
import { singleFlight } from '~/utils/single-flight';

describe('singleFlight (rafraîchissement du jeton)', () => {
  it('partage un seul appel entre des 401 simultanés', async () => {
    let resolve!: (v: boolean) => void;
    const refresh = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
    const run = singleFlight(refresh);

    const calls = [run(), run(), run()];
    expect(refresh).toHaveBeenCalledTimes(1);
    resolve(true);
    expect(await Promise.all(calls)).toEqual([true, true, true]);
  });

  it('relance un nouvel appel une fois le précédent terminé', async () => {
    const refresh = vi.fn(async () => true);
    const run = singleFlight(refresh);
    await run();
    await run();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('libère le verrou même en cas d\'échec', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce(true);
    const run = singleFlight(refresh);
    await expect(run()).rejects.toThrow('réseau');
    await expect(run()).resolves.toBe(true);
  });
});
