import { handler } from '../backend/index';
import { handleAsaasWebhook } from '../backend/asaas-webhook';

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    if (url.pathname === '/api/webhooks/asaas') {
      return handleAsaasWebhook(request, env);
    }
    return handler.fetch(request, env);
  }
};
