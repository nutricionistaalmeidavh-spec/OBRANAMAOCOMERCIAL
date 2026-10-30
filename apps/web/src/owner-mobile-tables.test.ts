// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { labelMobileTableCells } from './owner-mobile-tables';

describe('Central mobile-first table records',()=>{
  it('adds accessible column labels to populated table cells without altering values or controls',()=>{
    const table=document.createElement('table');
    table.innerHTML='<thead><tr><th>Usuário</th><th>Plano</th><th></th></tr></thead><tbody><tr><td>teste@example.test</td><td>Pro</td><td><button>Editar</button></td></tr></tbody>';
    document.body.append(table);
    labelMobileTableCells(table);
    const cells=table.tBodies[0].rows[0].cells;
    expect(Array.from(cells,x=>x.dataset.label)).toEqual(['Usuário','Plano','Ações']);
    expect(cells[2].querySelector('button')?.textContent).toBe('Editar');
    expect(cells[0].textContent).toBe('teste@example.test');
    table.remove();
  });

  it('leaves empty full-width rows intact',()=>{
    const table=document.createElement('table');
    table.innerHTML='<thead><tr><th>Usuário</th><th>Plano</th></tr></thead><tbody><tr><td colspan="2">Nenhuma conta encontrada.</td></tr></tbody>';
    labelMobileTableCells(table);
    expect(table.querySelector('td')?.hasAttribute('data-label')).toBe(false);
    expect(table.querySelector('td')?.colSpan).toBe(2);
  });

  it('uses a confined mobile record layout instead of an 880px page-width table',()=>{
    const css=readFileSync(new URL('./owner-debora-observability.css',import.meta.url),'utf8');
    const owner=readFileSync(new URL('./owner.css',import.meta.url),'utf8');
    expect(css).toContain('.owner-debora-table tbody tr{display:grid');
    expect(css).toContain('content:attr(data-label)');
    expect(css).toContain('.owner-debora-table-wrap{min-width:0;max-width:100%;overflow-x:auto');
    expect(owner).toContain('.owner-nav.is-open{display:grid}');
    expect(owner).toContain('body:has([data-owner-shell]) .shell');
  });
});
