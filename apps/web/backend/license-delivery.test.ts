import { describe, expect, it, vi } from 'vitest';
import { buildLicenseWelcome, sendLicenseWelcome, makeQuickStartPdf, validLicenseRecipient } from './license-delivery';

const license={ id:'license-123', email:'CLIENTE@example.com', code:'ABCD1234EFGH', status:'active' as const, channels:['desktop','mobile'], modules:['obra360'], plan:'lifetime', maxUsers:5, maxDevices:10, createdAt:'2026-11-13', updatedAt:'2026-11-13' };

describe('Obra na Mão automatic licensing email',()=>{
  it('composes download links, an access code, the PDF manual URL and instructions',()=>{
    const message=buildLicenseWelcome(license);
    expect(message.to).toBe('cliente@example.com');
    expect(message.text).toContain('ABCD1234EFGH');
    expect(message.text).toContain('Obra-na-Mao-Desktop-Setup-2.1.6.exe');
    expect(message.text).toContain('macOS-Apple-Silicon.dmg');
    expect(message.text).toContain('macOS-Intel.dmg');
    expect(message.text).toContain('drive.google.com/file/d/');
    expect(message.text).toMatch(/instal|ativ/i);
    expect(message.subject).toContain('Obra na Mão');
    expect(message.html).not.toContain('<script>');
  });

  it('generates a valid PDF quick start with per-license activation steps',()=>{
    const bytes=makeQuickStartPdf(license);
    expect(new TextDecoder().decode(bytes.slice(0,8))).toBe('%PDF-1.4');
    const text=new TextDecoder().decode(bytes);
    expect(text).toContain('ABCD1234EFGH');
    expect(text).toContain('%%EOF');
    expect(text).toMatch(/xref\n0 /);
  });

  it('accepts only syntactically valid recipients and active licences',()=>{
    expect(validLicenseRecipient(license)).toBe(true);
    expect(validLicenseRecipient({...license,email:'bad\r\nBcc:other@example.com'})).toBe(false);
    expect(validLicenseRecipient({...license,status:'revoked'})).toBe(false);
    expect(validLicenseRecipient({...license,expiresAt:'2020-01-01'})).toBe(false);
  });

  it('sends once via the existing native Cloudflare EMAIL binding and confirms messageId',async()=>{
    const send=vi.fn(async(_message:Record<string,unknown>)=>({messageId:'cf-message-1'}));
    const response=await sendLicenseWelcome(license,{EMAIL:{send},EMAIL_FROM:'welcome@artisys.dev'});
    expect(response.messageId).toBe('cf-message-1');
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0].attachments as Array<Record<string,unknown>>)?.[0]?.type).toBe('application/pdf');
    expect(send.mock.calls[0][0].to).toBe('cliente@example.com');
  });

  it('never treats an unconfigured mail service as successful delivery',async()=>{
    await expect(sendLicenseWelcome(license,{})).rejects.toThrow('EMAIL_TRANSPORT_NOT_CONFIGURED');
  });
});
