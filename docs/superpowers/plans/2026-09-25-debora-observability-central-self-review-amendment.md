# Central Débora Observability — Self-review Amendment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. This amendment is authoritative where it narrows or corrects `2026-09-25-debora-usage-observability-central.md`.

**Goal:** Corrigir dois pontos encontrados na auto-revisão do plano: impedir inferência acidental de pagamento no formulário manual e distinguir `legacy_unmanaged` de Freemium nas métricas/tabela.

**Spec:** `docs/superpowers/specs/2026-09-25-debora-usage-observability-central-design.md`

## Correction 1 — Nenhum default silencioso de canal/pagamento

Esta regra substitui a frase da Task 9 que permitia default visual `mercado_livre`/`paid`.

O formulário de nova liberação/renovação deve exigir seleção explícita:

```html
<select name="acquisitionChannel" required>
  <option value="" selected disabled>Selecione o canal</option>
  <option value="mercado_livre">Mercado Livre</option>
  <option value="direct_sale">Venda direta</option>
  <option value="shopee">Shopee</option>
  <option value="gumroad">Gumroad</option>
  <option value="courtesy">Cortesia</option>
  <option value="partnership">Parceria</option>
  <option value="other">Outro</option>
</select>
<select name="paymentStatus" required>
  <option value="" selected disabled>Selecione o pagamento</option>
  <option value="paid">Pago</option>
  <option value="pending">Pendente</option>
  <option value="unpaid">Não pago</option>
  <option value="not_applicable">Não se aplica</option>
</select>
```

`grant` deve ser bloqueado pelo browser e validado novamente no backend se qualquer seleção estiver vazia. Nenhum dado histórico é usado como default da próxima venda.

Adicionar/ajustar testes da Task 3 e Task 9:

```ts
expect(() => normalizeManualSaleInput({acquisitionChannel:'',paymentStatus:''})).toThrow();
expect((form.elements.namedItem('paymentStatus') as HTMLSelectElement).value).toBe('');
```

## Correction 2 — `legacy_unmanaged` é tipo distinto de Freemium

A fórmula da Task 6:

```text
freemium = totalAccounts - activePro
```

não deve ser usada.

A Central já possui `product_accounts` como marcador de entrada no regime comercial. Portanto o summary consolidado deve calcular:

```text
accounts.total         = total de auth_users recebido da Débora
accounts.commercial    = COUNT(DISTINCT email) em product_accounts para debora-lactacao/status commercial
pro.total              = número de e-mails comerciais com licença Pro efetiva ativa
freemium               = max(commercial - pro.total, 0)
legacyUnmanaged        = max(total - commercial, 0)
```

O payload consolidado passa a incluir:

```ts
accounts:{
  total:number;
  commercial:number;
  legacyUnmanaged:number;
  createdToday:number;
  created7d:number;
  created30d:number;
};
pro:{total:number;monthly:number;annual:number;manual6m:number};
freemium:number;
```

### Enriquecimento da página de usuários

Na mesma query local limitada aos e-mails da página, consultar `product_accounts`:

- sem registro comercial → `accountType='legacy_unmanaged'`, sem limites comerciais inferidos;
- registro comercial + licença Pro ativa → `accountType='pro'` e `effectiveLicense` correspondente;
- registro comercial sem Pro ativa → `accountType='freemium'`.

Exemplo por item:

```ts
{
  ...remoteUser,
  accountType:'legacy_unmanaged'|'freemium'|'pro',
  effectiveLicense:null|{planCode,status,source,expiresAt},
  manualSale:null|{acquisitionChannel,paymentStatus,amountCents,externalOrderRef,createdAt}
}
```

Adicionar testes da Task 6 com três usuários — legacy, freemium comercial e Pro — e exigir classificação distinta.

## Correction 3 — Summary de plano usa licença efetiva única

Se um mesmo e-mail tiver licença manual e Asaas simultaneamente, contar a conta somente uma vez em `pro.total`. A escolha efetiva deve seguir a mesma ordenação usada pelo serviço de acesso atual: licença ativa/não expirada; sem vencimento primeiro, depois `expires_at` mais distante e `updated_at` mais recente.

A quebra `monthly/annual/manual6m` deve refletir apenas a licença efetiva escolhida pelo CTE `ROW_NUMBER()`, e a soma dessas três categorias deve ser igual a `pro.total`.

Adicionar assert:

```ts
expect(summary.pro.monthly + summary.pro.annual + summary.pro.manual6m).toBe(summary.pro.total);
```

## Review Gate

Antes de concluir Tasks 6 e 9 do plano principal, executar:

```powershell
npx vitest run backend/debora-observability-admin.test.ts src/owner-navigation.test.ts src/owner-debora-observability.test.ts
```

Os testes devem provar simultaneamente:
- legado != freemium;
- Pro contado uma única vez;
- selects manuais começam sem valor selecionado;
- backend recusa canal/status vazio.
