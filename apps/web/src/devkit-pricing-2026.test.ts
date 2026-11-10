import {describe,expect,it} from 'vitest';
import {canonicalPriceCents,compareCanonicalPrice} from '../public/devkits/catalog-pricing.mjs';
const key=(v: string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const offers=new Map([
 [key('Kit A'),{priceCents:3853}],
 [key('Kit B'),{priceCents:5405}],
 [key('Kit C'),{priceCents:1990}],
]);
const items=[
 {id:'01',title:'Kit A',price:800},
 {id:'02',title:'Kit B',price:50},
 {id:'03',title:'Kit C',price:100},
 {id:'04',title:'Kit pendente',price:1},
];
describe('Ordenação canônica do checkout (P0)',()=>{
 it('exibe e usa somente o preço da oferta publicada',()=>{
  expect(canonicalPriceCents(items[0],offers,key)).toBe(3853);
  expect(canonicalPriceCents(items[1],offers,key)).toBe(5405);
  expect(canonicalPriceCents(items[3],offers,key)).toBeNull();
 });
 it('ordena por menor preço em centavos e deixa kits pendentes ao final',()=>{
  expect([...items].sort((a,b)=>compareCanonicalPrice(a,b,1,offers,key)).map(x=>x.id))
   .toEqual(['03','01','02','04']);
 });
 it('ordena por maior preço e deixa kits pendentes ao final',()=>{
  expect([...items].sort((a,b)=>compareCanonicalPrice(a,b,-1,offers,key)).map(x=>x.id))
   .toEqual(['02','01','03','04']);
 });
 it('desempata com ID para manter ordem estável',()=>{
  const a={id:'02',title:'Kit A'},b={id:'01',title:'Kit A'};
  expect(compareCanonicalPrice(a,b,1,offers,key)).toBeGreaterThan(0);
 });
});
