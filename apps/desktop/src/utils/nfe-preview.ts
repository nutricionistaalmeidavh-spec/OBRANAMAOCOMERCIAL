import { SaxesParser } from 'saxes'
import { MAX_NFE_BYTES,validNfeKey,parseNfeXml } from '../../../../packages/domain-core/nfe-xml.mjs'
export { MAX_NFE_BYTES,validNfeKey }
export type NfePreview={chave:string;numero:string;serie:string;emissao:string;fornecedor:string;documento:string;destinatario:string;ambiente:string;tipo_operacao:string;finalidade:string;natureza_operacao:string;total:string;total_produtos:string;componentes:Record<string,string>;protocolo:string;status:string;itens:{numero:string;codigo:string;descricao:string;unidade:string;gtin:string;gtin_tributavel:string;ncm:string;cfop:string;pedido:string;item_pedido:string;unidade_tributavel:string;quantidade_tributavel:string;quantidade:string;valor_unitario:string;valor_produto:string}[];parcelas:{numero:string;vencimento:string;valor:string}[]}
export function parseNfePreview(xml:string):NfePreview{return parseNfeXml(xml,SaxesParser) as NfePreview}
