# P2/P3 — Maintenance and Product Validation

Updated: 2026-09-03

## P2 — Maintenance

### Backend split
- `backend/project-state.ts`: project/company lookup, snapshots, day persistence, state assembly and active-front carry-forward.
- `backend/desktop-store.ts`: Desktop pairing persistence, device-token lookup and Desktop sync journal.
- `backend/index.ts` remains the composition root for route wiring and access orchestration.

### University split
- `src/university-shell.ts`: navigation shell, guide rendering, toast/error presentation and common page chrome.
- `src/university.ts`: learning, diagnostic, tutor and feature flow orchestration.

### Curriculum and question banks
- `src/curriculum-catalog.ts`: areas, competencies, levels, sources and audit catalog.
- `src/curriculum-types.ts`: shared curriculum item/unit contracts.
- `src/curriculum-content.ts`: canonical 60-unit lesson content.
- `src/curriculum.ts`: question-bank composition, supplementation, calibration and selection.
- Existing Portuguese, additional and young-adult variant banks remain independent.

### Versioning
- App version: `0.2.0`
- API contract: `3`
- D1 schema: `2`
- Project-state schema: `7`
- Every build writes commit SHA and semantic version to `build-meta.json`.
- API responses include `x-app-version` and `x-request-id`.
- D1 migrations now have explicit local/remote commands.

### Diagnostics
- Unexpected backend errors receive a request ID.
- A bounded D1 error log stores method, route, sanitized message and timestamp.
- Owner-only `GET /api/owner/diagnostics` returns version information and recent errors.
- `/api/health` reports application/API/database contract versions.

## P3 — Product validation possible without presencial users

### Admin → Encarregado → Funcionário
Automated integration coverage validates:
- Admin creates/vinculates the two operational roles.
- Encarregado claims access, opens the project and records attendance.
- Funcionário claims access and can access their own task flow.
- Funcionário is rejected from the Admin/Encarregado project-management route.

### Desktop ↔ mobile
Automated integration coverage validates:
- Desktop pairing and authorization.
- Desktop pushes an Obra360 change into the canonical bridge.
- Mobile Encarregado updates that same item.
- Desktop pulls the updated canonical snapshot and receives the mobile change.

### UX/commercial readiness
- Broken University guide-image references were removed.
- The guide now uses the canonical MH SVG asset.
- Semantic app version is visible in the University shell.
- Production smoke validates static app, University, version compatibility, 549 question visuals and protected API behavior.

## Deferred
The only intentionally deferred P3 item is the presencial human validation with a real Encarregado/Colaborador. Automated tests reduce technical risk but do not replace observation of a real user using the flow on-site.
