// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('routes all field enhancers through one canonical render lifecycle without observing DOM mutations',async()=>{
  document.body.innerHTML='<main id="content"></main><dialog id="sheet"></dialog><nav class="nav"><button class="active" data-screen="team">Equipe</button></nav>';
  const content=document.getElementById('content')!,sheet=document.getElementById('sheet')!;
  const lifecycle=readFileSync('public/field-lifecycle.js','utf8');
  const enhancer=readFileSync('public/field-premium-v2.js','utf8');

  expect(lifecycle).toContain("document.addEventListener('field:rendered'");
  expect(lifecycle).toContain("document.addEventListener('field:sheet-rendered'");
  expect(enhancer).toContain('fieldLifecycle?.register({screen:enhance,sheet:enhanceSheet})');
  expect(enhancer).not.toContain("document.addEventListener('field:rendered'");
  expect(enhancer).not.toContain("document.addEventListener('field:sheet-rendered'");
  expect(lifecycle).not.toContain('MutationObserver');
  expect(enhancer).not.toContain('MutationObserver');

  new Function(lifecycle)();
  new Function(enhancer)();

  content.innerHTML='<div class="section-head"><h2>Equipe</h2></div>';
  document.dispatchEvent(new CustomEvent('field:rendered'));
  document.dispatchEvent(new CustomEvent('field:rendered'));
  await Promise.resolve();
  await Promise.resolve();
  expect(content.querySelectorAll('.team-hero-glyph')).toHaveLength(1);

  sheet.innerHTML='<div class="sheet"><div class="sheet-head"><h2>Nova pendência</h2></div><input></div>';
  document.dispatchEvent(new CustomEvent('field:sheet-rendered'));
  await Promise.resolve();
  expect(sheet.querySelector('.premium-sheet')?.getAttribute('data-sheet-tone')).toBe('issue');
  expect(sheet.querySelector('input')?.classList.contains('premium-control')).toBe(true);

  expect((window as any).fieldLifecycle.counts()).toEqual(expect.objectContaining({screen:1,sheet:1}));
});
