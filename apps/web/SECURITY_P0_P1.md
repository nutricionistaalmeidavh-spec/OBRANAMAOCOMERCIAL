# P0/P1 — Reliability and Security Baseline

Updated: 2026-09-02

This document records the reliability and security controls implemented before broader commercial rollout.

## P0 — Reliability

### Automated critical-flow tests

The Web CI runs Vitest before every build. The suite covers:

- phone/password first access and login;
- University role boundary and cross-company denial;
- owner/bootstrap and project snapshot loading;
- attendance mutation inside the authenticated project;
- mobile foreman access bound to employee, company and project;
- native practice-run persistence;
- Desktop pairing, approval and device session;
- deterministic security-policy invariants.

### Deployment verification

Every Web build writes `public/build-meta.json` with the source commit SHA.

After a push to `main`, the `production-smoke` CI job waits until the deployed Worker reports that exact SHA and verifies:

- `/api/health`;
- `/universidade.html`;
- all 549 University question-image mappings;
- one real question image asset;
- unauthenticated denial on `/api/project`.

This prevents a green source build from being mistaken for a successful production deployment.

## P1 — Security

### Authentication and sessions

- Google/Web cookie sessions are limited to 24 hours.
- Expired Web sessions are deleted when encountered.
- University sessions are limited to 24 hours.
- Expired University sessions are deleted when encountered.
- Blocking a Platform user revokes their Web cookie sessions.
- Regenerating a Platform credential revokes existing Web cookie sessions.

### Sensitive endpoint throttling

Persistent D1-backed rate limits protect:

- Google authentication entry points;
- University password login and first access;
- University access lookup;
- Platform/member/license/bootstrap claims;
- Desktop pairing start/status/approval.

Counters are keyed by endpoint scope and a non-reversible short hash of the connecting IP.

### Request-origin protection

Cookie-authenticated mutation requests reject cross-site origins. Token-only field/Desktop calls remain usable by their non-cookie clients and continue to rely on their bearer credential and scope checks.

### Tenant isolation

- membership access now verifies that the project belongs to the member company;
- non-superadmin Platform access must contain the selected company and project;
- phone/foreman access validates participant company, project company and employee linkage;
- Desktop sessions validate project/company linkage and active Platform status;
- University admin overview, review and participant/tutor operations are filtered to the actor company unless the actor is Superadmin.

### Desktop credential hardening

- temporary pairing secrets are stored only as SHA-256 digests;
- newly issued Desktop device tokens expire after 90 days;
- existing tokens receive a 30-day migration grace period on first use;
- blocked Platform users can no longer keep using an otherwise valid Desktop session.

### Activation credentials

New Platform provisional credentials use 12 hexadecimal characters. Existing 8-character pending credentials remain accepted for migration compatibility.

### Legacy runtime repair

The one-time `2026-08-18` data repair was removed from request handling. The independent business rule that carries active assignments into a new workday remains in place as `carryForwardActiveAssignments`.

## Branch protection

The repository CI is prepared for protected-main operation. The required pre-merge status check should be:

- `validate`

Recommended GitHub rules for `main`:

- require a pull request before merge;
- require the `validate` status check;
- require conversation resolution;
- block force pushes;
- block branch deletion.

`production-smoke` intentionally runs after a push to `main`, so it should not be configured as a pre-merge required check.
