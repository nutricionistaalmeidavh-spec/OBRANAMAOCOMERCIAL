import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const e2e=readFileSync(resolve(process.cwd(),'scripts/qa-collaborator-onboarding-e2e.mjs'),'utf8')
const gate=readFileSync(resolve(process.cwd(),'scripts/qa-p2-release.mjs'),'utf8')

describe('collaborator onboarding E2E release contract',()=>{
  it('covers one invitation across Web/PWA and Desktop with canonical LAN storage',()=>{
    for(const value of [
      'inviteCodeReusedAcrossChannels',
      'webClaimUsedMemberEndpoint',
      'desktopInvitationPurpose',
      'desktopCanonicalServerId',
      'googleAuthPreserved',
      'canonicalRevocationCutsPwa'
    ])expect(e2e).toContain(value)
    expect(e2e).toContain("accessPurpose!=='member-invitation'")
    expect(e2e).toContain("mode:'lan-server'")
    expect(e2e).toContain('serverId')
  })

  it('is a critical P2 release gate rather than an optional QA artifact',()=>{
    expect(gate).toContain("p1:collaborator-onboarding-e2e")
    expect(gate).toContain("collaborator onboarding E2E report not passed")
    expect(gate).toContain("collaborator invitation touched commercial activation")
  })
})
