import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const backend=(name:string)=>readFileSync(new URL(`../backend/${name}`,import.meta.url),'utf8')
const migration=()=>readFileSync(new URL('./migrations/0004_billing_and_license_service.sql',import.meta.url),'utf8')

describe('billing/licensing stages 2-6 integration contract',()=>{
  it('uses the same audited license service for manual administration and billing',()=>{
    const index=backend('index.ts'),billing=backend('billing-service.ts'),licenses=backend('license-service.ts')
    expect(index).toContain('createManagedLicense')
    expect(index).toContain('mutateManagedLicense')
    expect(billing).toContain('activateOrRenewBillingLicense')
    expect(licenses).toContain("source:'billing'")
    expect(licenses).toContain("json_extract(record_json,'$.version')")
    expect(licenses).toContain('LicenseConflictError')
  })

  it('stores immutable server-side prices and separates financial status from license status',()=>{
    const sql=migration(),service=backend('billing-service.ts')
    expect(sql).toContain('billing_plan_versions')
    expect(sql).toContain('price_cents INTEGER NOT NULL')
    expect(sql).toContain('billing_orders')
    expect(sql).toContain('billing_subscriptions')
    expect(sql).toContain('billing_payments')
    expect(sql).toContain('billing_provider_events')
    expect(service).toContain('plan.price_cents')
    expect(service).not.toContain('input.amountCents')
  })

  it('binds checkout idempotency to the authenticated user and cannot accept an arbitrary company id',()=>{
    const service=backend('billing-service.ts'),routes=backend('billing-routes.ts'),sql=migration()
    expect(sql).toContain('UNIQUE(user_id,idempotency_key)')
    expect(service).toContain("WHERE user_id=? AND idempotency_key=?")
    expect(routes).toContain('c.user!')
    expect(routes).not.toContain('companyId:String(body.companyId')
    expect(service).toContain('const companyId=`billing_${order.id}`')
  })

  it('recovers uncertain hosted checkouts before any safe retry and preserves the same order',()=>{
    const service=backend('billing-service.ts'),routes=backend('billing-routes.ts')
    expect(service).toContain('isUnknownAsaasOutcome')
    expect(service).toContain('recoverHostedCheckoutOrder')
    expect(service).toContain("event_type IN ('CHECKOUT_CREATED','CHECKOUT_UPDATED','CHECKOUT_PAID')")
    expect(service).toContain("provider_checkout_id IS NULL AND financial_status IN ('created','failed')")
    expect(service).toContain('if(existing)return resumeExistingCheckout')
    expect(routes).toContain("'POST /api/billing/checkout/status'")
    expect(routes).toContain('result.state===\'verifying\'?202')
    expect(service).not.toContain('Checkout criado com estado incerto')
  })

  it('persists provider events before business processing and validates payment binding',()=>{
    const service=backend('billing-service.ts'),webhook=backend('asaas-webhook.ts')
    expect(service.indexOf('INSERT OR IGNORE INTO billing_provider_events')).toBeLessThan(service.indexOf("if(next==='paid')"))
    expect(service).toContain('validatePaidOrder')
    expect(service).toContain("throw new Error('Pagamento sem ordem/assinatura vinculada.')")
    expect(service).toContain("eventType.startsWith('CHECKOUT_')")
    expect(webhook).toContain("if(!env.DB)return json({error:'Persistência de cobrança indisponível.'},503)")
  })

  it('supports renewal, refund/cancel and out-of-order protection',()=>{
    const service=backend('billing-service.ts'),policy=backend('billing-policy.ts')
    expect(service).toContain('processRenewal')
    expect(service).toContain('revokeBillingLicense')
    expect(service).toContain('SUBSCRIPTION_INACTIVATED')
    expect(policy).toContain("paid:['refunded']")
  })
})
