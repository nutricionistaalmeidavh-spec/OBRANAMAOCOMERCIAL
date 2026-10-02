import assert from 'node:assert/strict'
import test from 'node:test'
import { BackupOperationsService } from '../src/backup-operations-service.mjs'

function fixture({enabled=true}={}){
  const calls=[]
  let scheduled=null
  const storage={
    create:async({reason,actor})=>{calls.push(['create',reason,actor]);return{backupId:'b-new',createdAt:'2026-10-01T10:00:00.000Z'}},
    verifyManagedBackup:(id,{enforceCurrentIdentity,actor})=>{calls.push(['verify',id,enforceCurrentIdentity,actor]);return{integrity:'ok',manifest:{backupId:id}}},
    pruneManaged:retain=>{calls.push(['prune',retain]);return{removed:['b-old'],retained:retain}},
    listManagedBackups:()=>[{backupId:'b-new',createdAt:'2026-10-01T10:00:00.000Z'}],
    testRestoreManaged:(id,{actor})=>{calls.push(['restore-test',id,actor]);return{restorable:true,backupId:id,integrity:'ok'}}
  }
  const service=new BackupOperationsService({
    storage,enabled,intervalHours:24,retentionCount:7,
    now:()=>new Date('2026-10-01T12:00:00.000Z'),
    setIntervalFn:(fn,ms)=>{scheduled={fn,ms,unref(){calls.push(['unref'])}};return scheduled},
    clearIntervalFn:timer=>calls.push(['clear',timer===scheduled])
  })
  return{service,calls,get scheduled(){return scheduled}}
}

test('operational backup creates, verifies and applies retention using the existing storage engine',async()=>{
  const f=fixture()
  const result=await f.service.runNow({reason:'scheduled',actor:{id:'admin'}})
  assert.equal(result.backup.backupId,'b-new')
  assert.equal(result.verified,true)
  assert.deepEqual(f.calls.slice(0,3).map(x=>x[0]),['create','verify','prune'])
  assert.equal(f.calls.find(x=>x[0]==='prune')[1],7)
  assert.equal(f.service.status().lastRun.status,'success')
})

test('pre-upgrade backup uses the same verified operational path',async()=>{
  const f=fixture()
  const result=await f.service.preUpgrade({actor:{id:'admin'}})
  assert.equal(result.backup.backupId,'b-new')
  assert.equal(f.calls.find(x=>x[0]==='create')[1],'pre-upgrade')
})

test('restore test never mutates live storage and delegates to safe restore-test primitive',async()=>{
  const f=fixture()
  const result=await f.service.testRestore('b-new',{actor:{id:'admin'}})
  assert.deepEqual(result,{restorable:true,backupId:'b-new',integrity:'ok'})
  assert.equal(f.calls.some(x=>x[0]==='create'),false)
  assert.equal(f.calls.some(x=>x[0]==='restore-test'),true)
})

test('scheduler is explicit, unrefd and can be stopped without running when disabled',()=>{
  const f=fixture()
  const state=f.service.start()
  assert.equal(state.running,true)
  assert.equal(f.scheduled.ms,24*60*60*1000)
  assert.equal(f.calls.some(x=>x[0]==='unref'),true)
  f.service.stop()
  assert.equal(f.calls.some(x=>x[0]==='clear'),true)

  const disabled=fixture({enabled:false})
  assert.equal(disabled.service.start().running,false)
  assert.equal(disabled.scheduled,null)
})
