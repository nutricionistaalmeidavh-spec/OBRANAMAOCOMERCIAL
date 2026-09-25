export const MANUAL_PLAN_CODE = 'pro_6m';
export const MANUAL_PLAN_MONTHS = 6;

export type ManualAcquisitionChannel='mercado_livre'|'direct_sale'|'shopee'|'gumroad'|'courtesy'|'partnership'|'other';
export type ManualPaymentStatus='paid'|'pending'|'unpaid'|'not_applicable';
export type NormalizedManualSaleInput={
  acquisitionChannel:ManualAcquisitionChannel;
  paymentStatus:ManualPaymentStatus;
  amountCents:number|null;
  paidAt:string|null;
  externalOrderRef:string|null;
};

const acquisitionChannels=new Set<ManualAcquisitionChannel>(['mercado_livre','direct_sale','shopee','gumroad','courtesy','partnership','other']);
const paymentStatuses=new Set<ManualPaymentStatus>(['paid','pending','unpaid','not_applicable']);

export function normalizeDeboraLicenseEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeManualSaleInput(value:unknown):NormalizedManualSaleInput{
  const input=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;
  const acquisitionChannel=String(input.acquisitionChannel||'') as ManualAcquisitionChannel;
  const paymentStatus=String(input.paymentStatus||'') as ManualPaymentStatus;
  if(!acquisitionChannels.has(acquisitionChannel))throw new Error('Informe uma origem válida para a liberação manual.');
  if(!paymentStatuses.has(paymentStatus))throw new Error('Informe a situação do pagamento.');

  const rawAmount=input.amountCents;
  let amountCents:number|null=null;
  if(rawAmount!==undefined&&rawAmount!==null&&rawAmount!==''){
    const amount=Number(rawAmount);
    if(!Number.isInteger(amount)||amount<0)throw new Error('Informe um valor válido em centavos.');
    amountCents=amount;
  }

  const rawPaidAt=String(input.paidAt||'').trim();
  let paidAt:string|null=null;
  if(rawPaidAt){
    const parsed=new Date(rawPaidAt);
    if(Number.isNaN(parsed.getTime()))throw new Error('Informe uma data de pagamento válida.');
    paidAt=parsed.toISOString();
  }

  const externalOrderRef=String(input.externalOrderRef||'').trim()||null;
  if(externalOrderRef&&externalOrderRef.length>160)throw new Error('A referência externa deve ter no máximo 160 caracteres.');

  return{acquisitionChannel,paymentStatus,amountCents,paidAt,externalOrderRef};
}

export function buildDeboraGrantPayload(value: unknown) {
  const email = normalizeDeboraLicenseEmail(value);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.');
  return {
    action: 'grant' as const,
    email,
    planCode: MANUAL_PLAN_CODE,
    months: MANUAL_PLAN_MONTHS,
    source: 'mercado_livre_manual' as const,
  };
}
