import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { PairingService, PairingError } from '../src/pairing-service.mjs'

const digest = value => createHash('sha256').update(String(value)).digest('hex')

function fixture({ nowMs = Date.parse('2026-09-29T20:00:00.000Z') } = {}) {
  const members = new Map([
    ['admin-a', { memberId:'admin-a', email:'admin@example.com', role:'admin', modules:['obra360'], channels:['desktop'], status:'active' }],
    ['member-a', { memberId:'member-a', email:'user@example.com', role:'foreman', modules:['obra360'], channels:['desktop'], status:'active' }],
    ['mobile-only', { memberId:'mobile-only', email:'mobile@example.com', role:'foreman', modules:['obra360'], channels:['mobile'], status:'active' }],
    ['revoked', { memberId:'revoked', email:'revoked@example.com', role:'employee', modules:['obra360'], channels:['desktop'], status:'revoked' }]
  ])
  const codes = new Map()
  const devices = new Map()
  const audits = []
  let sequence = 0
  const security = {
    member(id){ return members.get(String(id)) || null },
    members(){ return [...members.values()].map(member=>({...member})) },
    createPairingCode({ memberId, codeHash, expiresAt, createdByDeviceId }) {
      codes.set(codeHash,{ memberId, expiresAt, createdByDeviceId, consumed:false })
      return { memberId, expiresAt, createdByDeviceId }
    },
    consumePairingCode(codeHash) {
      const row=codes.get(codeHash)
      if(!row||row.consumed||Date.parse(row.expiresAt)<=nowMs)return null
      row.consumed=true
      return { memberId:row.memberId, expiresAt:row.expiresAt, createdByDeviceId:row.createdByDeviceId }
    },
    createDevice({ memberId, installationId, deviceName, tokenHash }) {
      const device={ id:`device-${++sequence}`, memberId, installationId, deviceName, tokenHash, status:'active' }
      devices.set(device.id,device)
      return { ...device }
    },
    listDevices(){ return [...devices.values()].map(x=>({...x})) },
    device(id){ const value=devices.get(String(id)); return value?{...value}:null },
    setDeviceStatus(id,status){ const value=devices.get(String(id)); if(!value)return null; value.status=status; return {...value} },
    appendAudit(entry){ audits.push(entry); return audits.length }
  }
  const service = new PairingService({
    security,
    nowMs:()=>nowMs,
    codeFactory:()=> 'PAIR-1234',
    tokenFactory:()=> 'lan-device-secret-token'
  })
  return { service,security,members,codes,devices,audits,setNow(value){nowMs=value} }
}

const adminActor={ device:{id:'admin-device'}, member:{memberId:'admin-a',role:'admin'} }
const foremanActor={ device:{id:'field-device'}, member:{memberId:'member-a',role:'foreman'} }

function expectPairingError(fn,status){
  assert.throws(fn,error=>error instanceof PairingError&&error.status===status)
}

test('admin creates a 10-minute one-use pairing invitation for an active Desktop member',()=>{
  const {service,codes}=fixture()
  const invite=service.createInvitation({actor:adminActor,targetMemberId:'member-a'})
  assert.equal(invite.code,'PAIR-1234')
  assert.equal(invite.expiresAt,'2026-09-29T20:10:00.000Z')
  assert.ok(codes.has(digest('PAIR-1234')))
})

test('admin can select an authorized Desktop member by email for the settings UX',()=>{
  const {service,codes}=fixture()
  const invite=service.createInvitation({actor:adminActor,targetMemberId:'USER@EXAMPLE.COM'})
  assert.equal(invite.member.memberId,'member-a')
  assert.ok(codes.has(digest('PAIR-1234')))
})

test('non-admin and invalid target members cannot create invitations',()=>{
  const {service}=fixture()
  expectPairingError(()=>service.createInvitation({actor:foremanActor,targetMemberId:'member-a'}),403)
  expectPairingError(()=>service.createInvitation({actor:adminActor,targetMemberId:'missing'}),404)
  expectPairingError(()=>service.createInvitation({actor:adminActor,targetMemberId:'revoked'}),403)
  expectPairingError(()=>service.createInvitation({actor:adminActor,targetMemberId:'mobile-only'}),403)
})

test('claim returns plaintext token once, persists only digest and rejects replay',()=>{
  const {service,devices}=fixture()
  service.createInvitation({actor:adminActor,targetMemberId:'member-a'})
  const result=service.claim({code:'PAIR-1234',installationId:'install-b',deviceName:'PC Engenharia',clientKey:'10.0.0.2'})
  assert.equal(result.deviceToken,'lan-device-secret-token')
  assert.equal(result.member.memberId,'member-a')
  const stored=[...devices.values()][0]
  assert.equal(stored.tokenHash,digest('lan-device-secret-token'))
  assert.equal(JSON.stringify(stored).includes('lan-device-secret-token'),false)
  expectPairingError(()=>service.claim({code:'PAIR-1234',installationId:'install-c',deviceName:'Replay',clientKey:'10.0.0.2'}),404)
})

test('expired code is rejected',()=>{
  const fx=fixture()
  fx.service.createInvitation({actor:adminActor,targetMemberId:'member-a'})
  fx.setNow(Date.parse('2026-09-29T20:11:00.000Z'))
  expectPairingError(()=>fx.service.claim({code:'PAIR-1234',installationId:'install-b',deviceName:'PC',clientKey:'10.0.0.2'}),404)
})

test('repeated invalid claims are rate limited',()=>{
  const {service}=fixture()
  for(let i=0;i<8;i++)expectPairingError(()=>service.claim({code:`BAD-${i}`,installationId:'install-b',deviceName:'PC',clientKey:'10.0.0.9'}),404)
  expectPairingError(()=>service.claim({code:'BAD-LAST',installationId:'install-b',deviceName:'PC',clientKey:'10.0.0.9'}),429)
})

test('admin can list, revoke and reactivate paired devices immediately',()=>{
  const {service}=fixture()
  service.createInvitation({actor:adminActor,targetMemberId:'member-a'})
  const paired=service.claim({code:'PAIR-1234',installationId:'install-b',deviceName:'PC Engenharia',clientKey:'10.0.0.2'})
  assert.equal(service.listDevices(adminActor).length,1)
  assert.equal(service.setDeviceStatus({actor:adminActor,deviceId:paired.device.id,status:'revoked'}).status,'revoked')
  assert.equal(service.setDeviceStatus({actor:adminActor,deviceId:paired.device.id,status:'active'}).status,'active')
  expectPairingError(()=>service.listDevices(foremanActor),403)
})

test('cloud-authorized enrollment creates the first LAN credential without a manual pairing code',()=>{
  const {service,devices}=fixture()
  const result=service.enrollAuthorized({memberId:'member-a',installationId:'install-auto',deviceName:'PC João'})
  assert.equal(result.deviceToken,'lan-device-secret-token')
  assert.equal(result.member.memberId,'member-a')
  const stored=[...devices.values()][0]
  assert.equal(stored.installationId,'install-auto')
  assert.equal(stored.tokenHash,digest('lan-device-secret-token'))
})

test('cloud-authorized enrollment still refuses revoked or mobile-only members',()=>{
  const {service}=fixture()
  expectPairingError(()=>service.enrollAuthorized({memberId:'mobile-only',installationId:'install-a',deviceName:'PC'}),403)
  expectPairingError(()=>service.enrollAuthorized({memberId:'revoked',installationId:'install-b',deviceName:'PC'}),403)
})
