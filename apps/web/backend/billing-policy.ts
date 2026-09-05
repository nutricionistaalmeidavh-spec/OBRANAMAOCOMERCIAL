export type FinancialStatus='created'|'pending'|'paid'|'overdue'|'canceled'|'refunded'|'failed'

export const BILLING_TRANSITIONS:Record<FinancialStatus,readonly FinancialStatus[]>={
  created:['pending','paid','canceled','failed'],
  pending:['paid','overdue','canceled','failed'],
  overdue:['paid','canceled','failed'],
  paid:['refunded'],
  canceled:[],
  refunded:[],
  failed:[]
}

const EVENT_STATUS:Record<string,FinancialStatus|undefined>={
  PAYMENT_CREATED:'pending',
  PAYMENT_UPDATED:'pending',
  PAYMENT_AWAITING_RISK_ANALYSIS:'pending',
  PAYMENT_RECEIVED:'paid',
  PAYMENT_CONFIRMED:'paid',
  PAYMENT_OVERDUE:'overdue',
  PAYMENT_REFUNDED:'refunded',
  PAYMENT_PARTIALLY_REFUNDED:'refunded',
  PAYMENT_DELETED:'canceled',
  CHECKOUT_CREATED:'pending',
  CHECKOUT_PAID:'paid',
  CHECKOUT_CANCELED:'canceled',
  CHECKOUT_EXPIRED:'canceled'
}

export function normalizeAsaasEvent(event:string):FinancialStatus|null{return EVENT_STATUS[String(event||'').trim().toUpperCase()]||null}
export function canApplyProviderTransition(current:FinancialStatus,next:FinancialStatus){return current===next||BILLING_TRANSITIONS[current].includes(next)}

export function validatePaidOrder(input:{orderAmountCents:number;providerAmountCents:number;providerPaymentId:string;expectedPaymentId:string;externalReference?:string;orderId?:string}){
  if(!input.expectedPaymentId||input.providerPaymentId!==input.expectedPaymentId)return{ok:false as const,reason:'payment_mismatch' as const}
  if(!Number.isInteger(input.providerAmountCents)||input.providerAmountCents!==input.orderAmountCents)return{ok:false as const,reason:'amount_mismatch' as const}
  if(input.orderId&&input.externalReference!==input.orderId)return{ok:false as const,reason:'external_reference_mismatch' as const}
  return{ok:true as const}
}
