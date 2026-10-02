import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { parseServerAddress }=require('./server-endpoint.cjs')

describe('parseServerAddress',()=>{
  it.each([
    ['192.168.1.50',{scheme:'http',host:'192.168.1.50',port:4732,baseUrl:'http://192.168.1.50:4732'}],
    ['obra-server.local',{scheme:'http',host:'obra-server.local',port:4732,baseUrl:'http://obra-server.local:4732'}],
    ['obra-server.local:4810',{scheme:'http',host:'obra-server.local',port:4810,baseUrl:'http://obra-server.local:4810'}],
    ['http://192.168.1.50:4810',{scheme:'http',host:'192.168.1.50',port:4810,baseUrl:'http://192.168.1.50:4810'}],
    ['https://servidor.empresa.com.br',{scheme:'https',host:'servidor.empresa.com.br',port:443,baseUrl:'https://servidor.empresa.com.br'}]
  ])('normaliza %s',(input,expected)=>{
    expect(parseServerAddress(input)).toMatchObject(expected)
  })

  it.each([
    'ftp://servidor.local',
    'http://usuario@servidor.local',
    'http://servidor.local/caminho',
    'http://servidor.local?x=1',
    'http://servidor.local/#frag',
    ''
  ])('rejeita endereço fora do contrato: %s',(input)=>{
    expect(()=>parseServerAddress(input)).toThrow(/endereço|servidor|protocolo|caminho/i)
  })
})
