// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('enhances newly rendered screens and sheets once without observing DOM mutations',()=>{
 document.body.innerHTML='<main id="content"></main><dialog id="sheet"></dialog><nav class="nav"><button class="active" data-screen="team">Equipe</button></nav>';
 const content=document.getElementById('content')!,sheet=document.getElementById('sheet')!;
 const script=readFileSync('public/field-premium-v2.js','utf8');
 expect(script).not.toContain('MutationObserver');
 new Function(script)();
 content.innerHTML='<div class="section-head"><h2>Equipe</h2></div>';
 document.dispatchEvent(new CustomEvent('field:rendered'));document.dispatchEvent(new CustomEvent('field:rendered'));
 expect(content.querySelectorAll('.team-hero-glyph')).toHaveLength(1);
 sheet.innerHTML='<div class="sheet"><div class="sheet-head"><h2>Nova pendência</h2></div><input></div>';
 document.dispatchEvent(new CustomEvent('field:sheet-rendered'));
 expect(sheet.querySelector('.premium-sheet')?.getAttribute('data-sheet-tone')).toBe('issue');
 expect(sheet.querySelector('input')?.classList.contains('premium-control')).toBe(true);
});
