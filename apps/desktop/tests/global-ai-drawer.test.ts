import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('global AI drawer rendering contract',()=>{
  it('renders the fixed drawer through a document portal so sticky backdrop-filter ancestors cannot trap it',()=>{
    const component=read('../src/components/GlobalAiAssistant.tsx')
    expect(component).toContain("from 'react-dom'")
    expect(component).toContain('createPortal(')
    expect(component).toContain('document.body')
  })
})
