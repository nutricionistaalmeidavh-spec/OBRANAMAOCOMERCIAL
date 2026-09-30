import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const main=fs.readFileSync(path.resolve(process.cwd(),'electron/main.cjs'),'utf8')
const preload=fs.readFileSync(path.resolve(process.cwd(),'electron/preload.cjs'),'utf8')
const pkg=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),'package.json'),'utf8'))

describe('principal LAN host lifecycle',()=>{
  it('starts the LAN process only through explicit lan-host mode and keeps it alive behind the tray',()=>{
    expect(main).toContain("operationalMode === 'lan-host'")
    expect(main).toContain('new LanHostService')
    expect(main).toContain('new Tray')
    expect(main).toContain("mainWindow.on('close'")
    expect(main).toContain('event.preventDefault()')
    expect(main).toContain('services.lanHost.stop()')
  })

  it('does not silently force autostart; the user controls it through an explicit IPC action',()=>{
    expect(main).toContain("ipcMain.handle('lan:set-start-at-login'")
    expect(main).toContain('app.setLoginItemSettings({ openAtLogin: enabled === true })')
    expect(main).not.toContain('app.setLoginItemSettings({ openAtLogin: true })')
  })

  it('packages the free self-hosted LAN server and its versioned migrations with the Desktop installer',()=>{
    const resources=pkg.build?.extraResources||[]
    const server=resources.find((entry:any)=>entry.from==='../lan-server'&&entry.to==='lan-server')
    expect(server).toBeTruthy()
    expect(server.filter).toContain('src/**/*')
    expect(server.filter).toContain('migrations/**/*')
  })

  it('renderer receives only safe LAN operations, never server/device tokens',()=>{
    expect(preload).toContain('lan:')
    expect(preload).toContain("call('lan:claim-host'")
    expect(preload).toContain("call('lan:pair'")
    expect(preload).not.toContain('deviceToken')
    expect(preload).not.toContain('serverToken')
  })
})
