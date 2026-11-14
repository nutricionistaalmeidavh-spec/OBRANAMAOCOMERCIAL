/**
 * P1 Umami self-hosted analytics adapter.
 * No tracker loads until the site owner sets both public meta fields;
 * no IDs, secrets, IPs or customer data in the repository.
 */
type UmamiWindow = Window & { umami?: { track: (event: string, data?: Record<string, string>) => void } };
let enabled = false;

export function configureUmami(): boolean {
  const source = document.querySelector<HTMLMetaElement>('meta[name="artisys-umami-base-url"]')?.content?.trim();
  const websiteId = document.querySelector<HTMLMetaElement>('meta[name="artisys-umami-website-id"]')?.content?.trim();
  if (!source || !websiteId) return false;
  let url: URL;
  try { url = new URL(source); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (!/^[a-f0-9-]{32,36}$/i.test(websiteId)) return false;
  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = url.href.replace(/\/$/, '') + '/script.js';
  script.setAttribute('data-website-id', websiteId);
  script.setAttribute('data-auto-track', 'true');
  script.addEventListener('load', () => { enabled = true; }, { once: true });
  document.head.append(script);
  return true;
}

export function trackFinanceEvent(event: string, label?: string) {
  if (!enabled) return;
  const client = window as UmamiWindow;
  client.umami?.track(event.slice(0, 50), label ? { area: label.slice(0, 50) } : undefined);
}
