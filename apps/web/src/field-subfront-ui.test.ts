import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
it('Obra360 mostra Etapas e Subetapas do Desktop, preservando vínculos do cronograma',()=>{
  const source=readFileSync(resolve(process.cwd(),'public/field.js'),'utf8');
  expect(source).toContain("subfrentes_obra:'Subetapa'");
  expect(source).toContain("'subfronts'");
  expect(source).toContain("bridgeDomainSection('Subetapas'");
  expect(source).not.toContain("bridgeDomainSection('Frentes'");
  expect(source).toContain("item.sourceDeviceId===row.sourceDeviceId");
});
