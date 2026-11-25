# NF-e P1 — deterministic recognition and release gates

- No AI, embeddings, cloud inference or paid API. SAX parser Saxes 5.0.1 (ISC) and xmlchars 2.2.0 (MIT) are pinned; LAN packaging includes both, no runtime npm installation.
- XML is parsed from original bytes in the renderer for display and again by the selected authoritative Desktop or LAN backend; DTD/entity declarations, wrong namespace, invalid UTF-8, duplicate critical fields and malformed keys are rejected.
- The protocol is information contained in the XML, NOT a cryptographic signature or SEFAZ verification.
- Matching is scoped by company and supplier. Confirmed code/unit equivalences can be reused if no technical or GTIN conflict. GTIN and textual similarity only suggest candidates; a user must explicitly confirm the link and exact rational factor.
- A conservative CFOP allowlist separates purchases from returns/remittances/unknown or mixed operations. The transactional purchase core requires a production model 55 XML, normal outgoing operation, confirmed materials, original fiscal quantities and persisted canonical conversion.
- The UI supports inspection, candidate review, confirmation, purchase reference suggestions and duplicate detection. It does not yet register the fiscal note or create financial/stock movements.
- The core supports partial physical receiving, original XML archive, installments, cost allocation, idempotency and rollback. Follow-up receipts without a linked purchase order and safe compensating reversal use the persisted conversion. Linked order follow-up/reversal and multi-work DRE/cash projections are not yet homologated.
- Keep the fiscal mutation transport and full import wizard disabled until those projections, reconciliation, migration of fiscal linkage/archive, permissions, and end-to-end tests are complete. No production data, releases, secrets or licenses are changed.
