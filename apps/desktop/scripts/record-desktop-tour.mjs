import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const outDir = path.resolve('tour-output')
const dataDir = path.resolve('.tour-data')
const devUrl = 'http://127.0.0.1:5173'
fs.rmSync(dataDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

if (!electronPath || !fs.existsSync(electronPath)) {
  throw new Error(`Electron executable not found: ${electronPath || 'empty path'}`)
}

const app = await electron.launch({
  executablePath: electronPath,
  args: ['--no-sandbox', '.'],
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl,
    OBRA_NA_MAO_DATA_DIR: dataDir,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  },
})

let page = await app.firstWindow()
await page.waitForTimeout(1000)
const rendererWindow = app.windows().find((candidate) => candidate.url().startsWith(devUrl))
if (rendererWindow) page = rendererWindow

await app.evaluate(({ BrowserWindow }, expectedUrl) => {
  const windows = BrowserWindow.getAllWindows()
  const healthy = windows.find((win) => win.webContents.getURL().startsWith(expectedUrl))
  if (!healthy) throw new Error('Healthy desktop renderer window was not found.')
  for (const win of windows) {
    if (win !== healthy && win.webContents.getURL().startsWith('data:text/html')) win.destroy()
  }
  healthy.setBounds({ x: 0, y: 0, width: 1440, height: 900 })
  healthy.show()
  healthy.focus()
}, devUrl)

await page.waitForFunction(() => Boolean(window.fluxoDre?.app), null, { timeout: 30_000 })
const seedResult = await page.evaluate(async () => {
  await window.fluxoDre.app.setLayout('command-center')
  return window.fluxoDre.demo.seed()
})
if (seedResult?.ok === false) {
  throw new Error(`Demo database seed failed: ${seedResult.error?.message || seedResult.error || 'unknown error'}`)
}

await page.reload()
await page.waitForFunction(() => Boolean(document.querySelector('.command-center-shell')), null, { timeout: 30_000 })
const bootText = await page.locator('body').innerText()
if (/não conseguiu iniciar|não foi possível abrir o banco de dados local|interface não pôde ser carregada/i.test(bootText)) {
  throw new Error(`Desktop boot failed before recording: ${bootText.slice(0, 500)}`)
}
await page.waitForTimeout(1500)

const routes = [
  ['Painel', '/'],
  ['DRE', '/dre'],
  ['Contas', '/financeiro'],
  ['Orcamento', '/orcamento'],
  ['Medicoes', '/medicoes'],
  ['Compras e Contratos', '/compras-contratos'],
  ['Obras', '/obras'],
  ['Planejamento', '/planejamento'],
  ['RH', '/rh'],
  ['Folha e pagamentos', '/folha'],
  ['Configuracoes', '/configuracoes'],
]

const stable = []
for (const [label, route] of routes) {
  await page.evaluate((r) => { location.hash = `#${r}` }, route)
  await page.waitForTimeout(650)
  const body = await page.locator('body').innerText()
  const broken = /erro inesperado|não foi possível carregar a preferência|não conseguiu iniciar|interface não pôde ser carregada/i.test(body)
  if (!broken) stable.push([label, route])
}

if (stable.length < 4) {
  throw new Error(`Not enough stable desktop routes to record: ${stable.length}`)
}

await page.evaluate(() => { location.hash = '#/' })
await page.waitForTimeout(1200)
await app.evaluate(({ BrowserWindow }, expectedUrl) => {
  const healthy = BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().startsWith(expectedUrl))
  if (healthy) { healthy.show(); healthy.focus(); healthy.setBounds({ x: 0, y: 0, width: 1440, height: 900 }) }
}, devUrl)

const display = process.env.DISPLAY || ':99'
const output = path.join(outDir, 'ArtiSys-Desktop-Tour-Real.mp4')
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'x11grab',
  '-draw_mouse', '1',
  '-video_size', '1440x900',
  '-framerate', '30',
  '-i', `${display}.0`,
  '-an',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  output,
], { stdio: ['ignore', 'pipe', 'pipe'] })

const pause = (ms) => page.waitForTimeout(ms)
await pause(2200)

for (const [label, route] of stable) {
  if (route === '/') continue
  const link = page.getByRole('link', { name: label, exact: true }).first()
  if (await link.count()) {
    await link.scrollIntoViewIfNeeded()
    await link.click()
  } else {
    await page.evaluate((r) => { location.hash = `#${r}` }, route)
  }
  await pause(1800)

  const content = page.locator('.content-wrap')
  if (await content.count()) {
    const height = await content.evaluate((el) => el.scrollHeight)
    if (height > 850) {
      await page.mouse.wheel(0, Math.min(420, height - 700))
      await pause(650)
      await page.mouse.wheel(0, -500)
      await pause(450)
    }
  }
}

await page.evaluate(() => { location.hash = '#/' })
await pause(1800)

ffmpeg.kill('SIGINT')
await new Promise((resolve, reject) => {
  ffmpeg.once('exit', (code) => code === 0 || code === 255 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)))
  ffmpeg.once('error', reject)
})

fs.writeFileSync(path.join(outDir, 'tour-routes.json'), JSON.stringify({ stableRoutes: stable.map(([label, route]) => ({ label, route })) }, null, 2))
await app.close()
console.log(`Tour gravado em ${output}`)
