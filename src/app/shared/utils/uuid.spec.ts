import { newUuid } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newUuid', () => {
  it('genera un UUID v4 distinto cada vez', () => {
    const first = newUuid();
    expect(first).toMatch(UUID_V4);
    expect(newUuid()).not.toBe(first);
  });

  it('sin crypto.randomUUID (contexto no seguro) también da un UUID v4 válido', () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      expect(newUuid()).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});
