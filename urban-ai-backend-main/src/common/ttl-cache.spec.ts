import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('serve a segunda chamada do cache dentro do TTL', async () => {
    let t = 0;
    const cache = new TtlCache<number>(1000, 10, () => t);
    const loader = jest.fn().mockResolvedValue(42);

    expect(await cache.getOrLoad('a', loader)).toBe(42);
    t = 999;
    expect(await cache.getOrLoad('a', loader)).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);

    t = 1000;
    await cache.getOrLoad('a', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('chamadas simultâneas à mesma chave compartilham uma só carga', async () => {
    const cache = new TtlCache<string>(1000);
    let release: (v: string) => void = () => undefined;
    const loader = jest.fn(() => new Promise<string>((r) => (release = r)));

    const calls = [cache.getOrLoad('k', loader), cache.getOrLoad('k', loader), cache.getOrLoad('k', loader)];
    release('ok');

    expect(await Promise.all(calls)).toEqual(['ok', 'ok', 'ok']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('não cacheia falha: a próxima tentativa refaz a carga', async () => {
    const cache = new TtlCache<string>(1000);
    const loader = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');

    await expect(cache.getOrLoad('k', loader)).rejects.toThrow('boom');
    expect(await cache.getOrLoad('k', loader)).toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('respeita o teto de entradas descartando a mais antiga', async () => {
    const cache = new TtlCache<number>(10_000, 2);
    const loader = jest.fn(async () => 1);
    await cache.getOrLoad('a', loader);
    await cache.getOrLoad('b', loader);
    await cache.getOrLoad('c', loader); // expulsa "a"
    expect(loader).toHaveBeenCalledTimes(3);
    await cache.getOrLoad('b', loader);
    await cache.getOrLoad('c', loader);
    expect(loader).toHaveBeenCalledTimes(3);
    await cache.getOrLoad('a', loader);
    expect(loader).toHaveBeenCalledTimes(4);
  });
});
