interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
interface Manifest { version: 1; id: string; count: number }

// Commit a small manifest only after every encrypted chunk is stored. Session
// JSON may exceed SecureStore's platform limits; 400 code points are <=1600 UTF-8 bytes.
export function createSecureSessionStorage(secure: Storage, legacy: Storage, randomId: () => string): Storage {
  let pending: Promise<unknown> = Promise.resolve();
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = pending.then(operation, operation);
    pending = next.catch(() => undefined);
    return next;
  };
  const root = (key: string) => `${key}.secure-v1`;
  const part = (key: string, manifest: Manifest, index: number) => `${root(key)}.${manifest.id}.${index}`;
  function decode(value: string | null): Manifest | null {
    if (value === null) return null;
    const parsed = JSON.parse(value);
    if (parsed.version !== 1 || !/^[a-zA-Z0-9-]{1,64}$/.test(parsed.id)
      || !Number.isInteger(parsed.count) || parsed.count < 0 || parsed.count > 256) throw Error('Sesión segura inválida.');
    return parsed;
  }
  async function discard(key: string, manifest: Manifest | null) {
    if (!manifest) return;
    await Promise.all(Array.from({ length: manifest.count }, (_, i) => secure.removeItem(part(key, manifest, i)).catch(() => undefined)));
  }
  async function write(key: string, value: string | null) {
    const previous = decode(await secure.getItem(root(key)));
    const points = value === null ? [] : Array.from(value);
    const chunks: string[] = [];
    for (let i = 0; i < points.length; i += 400) chunks.push(points.slice(i, i + 400).join(''));
    if (chunks.length > 256) throw Error('Sesión demasiado grande para el almacenamiento seguro.');
    const next: Manifest = { version: 1, id: randomId(), count: chunks.length };
    try {
      for (let i = 0; i < chunks.length; i++) await secure.setItem(part(key, next, i), chunks[i]);
      await secure.setItem(root(key), JSON.stringify(next));
    } catch (error) {
      await discard(key, next);
      throw error;
    }
    // A count=0 tombstone prevents an old plaintext session from resurfacing.
    await legacy.removeItem(key);
    await discard(key, previous);
  }
  return {
    getItem: key => serial(async () => {
      const manifest = decode(await secure.getItem(root(key)));
      if (manifest) {
        await legacy.removeItem(key);
        if (manifest.count === 0) return null;
        const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, i) => secure.getItem(part(key, manifest, i))));
        if (chunks.some(chunk => chunk === null)) throw Error('Sesión segura incompleta. Vuelve a iniciar sesión.');
        return chunks.join('');
      }
      const oldValue = await legacy.getItem(key);
      if (oldValue !== null) await write(key, oldValue);
      return oldValue;
    }),
    setItem: (key, value) => serial(() => write(key, value)),
    removeItem: key => serial(() => write(key, null)),
  };
}
