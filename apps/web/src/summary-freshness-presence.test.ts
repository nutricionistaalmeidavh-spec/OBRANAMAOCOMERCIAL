import { expect, it } from 'vitest';
import { snapshotFreshness } from './summary-freshness';

const now=new Date('2026-11-25T23:00:00Z');
it('unchanged data with the Desktop online is current, even if published long ago',()=>{
  const result=snapshotFreshness('2026-11-20T12:00:00Z',now,'2026-11-25T22:58:00Z');
  expect(result.state).toBe('current');
  expect(result.label).toMatch(/^Desktop conectado · dados de 20\/11\/2026/);
});
it('says plainly that the office Desktop is off and since when',()=>{
  const result=snapshotFreshness('2026-11-25T20:00:00Z',now,'2026-11-25T21:00:00Z');
  expect(result.state).toBe('stale');
  expect(result.label).toMatch(/^Desktop do escritório desligado desde 25\/11\/2026/);
  expect(result.label).toContain('dados de 25/11/2026');
});
it('keeps the previous behaviour without a heartbeat',()=>{
  expect(snapshotFreshness(undefined,now).label).toBe('Sem data de atualização do Desktop');
  expect(snapshotFreshness('2026-11-25T22:00:00Z',now).label).toMatch(/^Publicado pelo Desktop em/);
});
