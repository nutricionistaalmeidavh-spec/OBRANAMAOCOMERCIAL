import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const integration=()=>readFile(new URL('./owner-loja-online.ts',import.meta.url),'utf8');
const shell=()=>readFile(new URL('../sistema.html',import.meta.url),'utf8');

describe('Central Artisys Loja Online contract',()=>{
  it('carrega Loja Online como terceiro produto gerenciado no owner existente',async()=>{
    const [text,html]=await Promise.all([integration(),shell()]);
    expect(html).toContain('/src/owner-loja-online.ts');
    expect(text).toContain("dataset.ownerView='loja'");
    expect(text).toContain('Loja Online');
    expect(text).toContain('/api/owner/loja-online/overview');
    expect(text).toContain('/api/owner/loja-online/companies');
  });

  it('mantém provisionamento empresarial e ações de licença na Central',async()=>{
    const text=await integration();
    expect(text).toContain('Criar loja e liberar licença');
    expect(text).toContain('Estender +6 meses');
    expect(text).toContain('Bloquear');
    expect(text).toContain('Desbloquear');
    expect(text).toContain('Máximo de usuários');
  });

  it('inclui Loja Online nos clientes e auditoria unificados',async()=>{
    const text=await integration();
    expect(text).toContain("option.value='loja-online'");
    expect(text).toContain('data-product="loja-online"');
    expect(text).toContain('/api/owner/loja-online/license-audit');
  });

  it('abre o painel SEO compartilhado já filtrado para Loja Online sem alterar o fluxo do Obra na Mão',async()=>{
    const text=await integration();
    expect(text).toContain('https://deboralactacao.com/admin/seo/?context=loja-online');
    expect(text).toContain('Abrir painel SEO');
    expect(text).not.toContain('apps/web/src/owner.ts');
  });
});
