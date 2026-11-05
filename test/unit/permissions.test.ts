import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, effectivePermissions, ROLE_DEFAULTS, toOverrides } from '~/utils/permissions';

describe('permissions', () => {
  it('reprend les 24 permissions de l\'API', () => {
    expect(ALL_PERMISSIONS).toHaveLength(24);
    expect(new Set(ALL_PERMISSIONS).size).toBe(24);
  });

  it('donne au manager tout sauf la suppression et l\'abonnement', () => {
    expect(ROLE_DEFAULTS.MANAGER).not.toContain('restaurant.delete');
    expect(ROLE_DEFAULTS.MANAGER).not.toContain('billing.manage');
    expect(ROLE_DEFAULTS.MANAGER).toHaveLength(22);
  });

  it('calcule les écarts par rapport au rôle', () => {
    const selected = [...ROLE_DEFAULTS.STAFF.filter((p) => p !== 'payments.collect'), 'orders.cancel'];
    expect(toOverrides('STAFF', selected)).toEqual({ grant: ['orders.cancel'], deny: ['payments.collect'] });
  });

  it('retrouve la sélection à partir des écarts (aller-retour)', () => {
    const overrides = { grant: ['orders.refund'], deny: ['tables.status'] };
    const effective = effectivePermissions('STAFF', overrides);
    expect(effective).toContain('orders.refund');
    expect(effective).not.toContain('tables.status');
    expect(toOverrides('STAFF', effective)).toEqual(overrides);
  });

  it('ne crée aucun écart quand on garde les droits du rôle', () => {
    expect(toOverrides('MANAGER', ROLE_DEFAULTS.MANAGER)).toEqual({ grant: [], deny: [] });
  });
});
