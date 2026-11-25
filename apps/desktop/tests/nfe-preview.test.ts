import { describe, it, expect } from 'vitest'
import { parseNfePreview, validNfeKey } from '../src/utils/nfe-preview'
const prefix='3526111234567800012355001000001234100001234'
let sum=0,weight=2
for(let i=42;i>=0;i--){sum+=Number(prefix[i])*weight;weight=weight===9?2:weight+1}
const d=11-sum%11
const key=prefix+String(d>=10?0:d)
const nfe=(inner='')=>'<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe'+key+'"><ide><mod>55</mod><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-25T08:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000123</CNPJ><xNome>Fornecedor &amp; Cia</xNome></emit><dest><CNPJ>12345678000124</CNPJ></dest><det nItem="1"><prod><cProd>P1</cProd><xProd>Tubo</xProd><uCom>M</uCom><qCom>2.5000</qCom><vUnCom>10.1234567890</vUnCom><vProd>25.31</vProd></prod></det><total><ICMSTot><vNF>30.31</vNF></ICMSTot></total><cobr><dup><nDup>1</nDup><dVenc>2026-12-25</dVenc><vDup>30.31</vDup></dup></cobr>'+inner+'</infNFe></NFe><protNFe><infProt><chNFe>'+key+'</chNFe><cStat>100</cStat><nProt>12345</nProt></infProt></protNFe></nfeProc>'
describe('prévia NF-e local',()=>{
 it('preserva precisão decimal, valor fiscal e parcelas sem gerar lançamentos',()=>{
   expect(validNfeKey(key)).toBe(true)
   const result=parseNfePreview(nfe())
   expect(result.chave).toBe(key);expect(result.total).toBe('30.31')
   expect(result.itens[0].valor_unitario).toBe('10.1234567890')
   expect(result.itens[0].quantidade).toBe('2.5000')
   expect(result.fornecedor).toBe('Fornecedor & Cia')
   expect(result.parcelas[0]).toEqual({numero:'1',vencimento:'2026-12-25',valor:'30.31'})
 })
 it('rejeita DTD, XML malformado, outro namespace, chave e protocolo incompatíveis',()=>{
   for(const xml of ['<!DOCTYPE a [<!ENTITY x "bad">]>'+nfe(),'<NFe>',nfe().replace('portalfiscal.inf.br','invalid.example'),nfe().replace('NFe'+key,'NFe'+key.slice(0,43)+'x'),nfe().replace('<cStat>100','<cStat>110')]){
     expect(()=>parseNfePreview(xml)).toThrow()
   }
 })
 it('rejeita duplicidade de campos e quantidade zero',()=>{
   expect(()=>parseNfePreview(nfe('<ide/>'))).toThrow()
   expect(()=>parseNfePreview(nfe().replace('2.5000','0'))).toThrow()
 })
})
