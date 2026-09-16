import { defineSeoConfig } from './vendor/artisys-seo/config.mjs';

export const artisysSeoConfig = defineSeoConfig({
  site: {
    name: 'ArtiSys',
    url: 'https://artisys.dev',
    language: 'pt-BR',
    organization: {
      name: 'ArtiSys',
      url: 'https://artisys.dev/'
    }
  },
  pages: [
    {
      path: '/',
      title: 'ArtiSys | Sistemas, sites e automações para negócios',
      description: 'A ArtiSys cria sistemas sob medida, sites profissionais e automações para empresas que querem vender, organizar e crescer.',
      schemaType: 'WebPage',
      changeFrequency: 'weekly',
      priority: 1
    }
  ]
});
