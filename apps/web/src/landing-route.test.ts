import { describe, expect, it } from 'vitest';
import { systemDestination } from './landing-route';

describe('commercial landing route compatibility', () => {
  it.each(['', '#', '#topo', '#conteudo', '#servicos', '#prova', '#processo', '#contato'])('keeps %s on the public site', hash => {
    expect(systemDestination(hash)).toBeNull();
  });

  it.each(['#portal', '#owner', '#universidade', '#finance', '#gestao', '#obra', '#desktop-bridge', '#desktop-auth=request.token&mode=desktop', '#activate=ABC123'])('preserves existing system route %s', hash => {
    expect(systemDestination(hash, '?source=desktop')).toBe(`./sistema.html?source=desktop${hash}`);
  });

  it('never uses a hash as an external redirect destination', () => {
    expect(systemDestination('#https://example.com')).toBe('./sistema.html#https://example.com');
  });
});
