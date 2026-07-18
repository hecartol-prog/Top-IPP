# 31 — System Governance

**Status:** Governance manual + Architecture Freeze  
**Constitution:** Entire `/docs` corpus  
**After this document set (26–32 + validation):** architecture is **FROZEN** unless product owner explicitly reopens redesign.

---

## 1. Architecture principles (immutable)

1. Never fabricate business information.  
2. Important facts need evidence.  
3. Important fields need provenance.  
4. Relationship Intelligence ≠ Opportunity Intelligence (independent scores).  
5. Path A and Path B converge on **Company**.  
6. Companies exist without opportunities.  
7. Projects (Opportunities) may exist without prior relationship.  
8. AI reasons over evidence; never invents evidence.  
9. One responsibility per service.  
10. Stability > feature quantity.

CRM is execution. Intelligence is the product.

---

## 2. Naming conventions

| Concept | Canonical name | Forbidden / legacy |
|---------|----------------|--------------------|
| Org hub | Company | Account (legacy prose only) |
| Person DB entity | Lead | — |
| Person UI | Contact | “Lead gen” as KPI |
| Project | Opportunity | Project entity |
| Signal entity | BuyingSignal | — |
| Approval queue | Intelligence Inbox | Do not call InboxStats |
| SMTP stats | InboxStats | — |
| Config | VerticalPack | — |
| Scores | Relationship / Opportunity / Strategic Fit / Priority Index | Merged mega-score |
| Evidence confidence | OpportunityConfidence (0–1) | Confusing with Opp Score |

Function names: verbNoun (`evidenceIngest`, `scoreRelationship`).  
Prompt keys: snake capability ids from `26`.

---

## 3. Folder conventions

```text
docs/                    # Constitution — do not delete
base44/entities/         # All entity schemas in git
base44/functions/<name>/entry.ts  # One responsibility each
src/pages/               # Routes
src/components/<domain>/ # leads, intelligence, outreach, ...
src/lib/scoring/         # Deterministic score calculators
src/api/base44Client.js  # Single client
```

New IPP UI under `src/components/intelligence/` preferred.

---

## 4. Database conventions

- Additive migrations; nullable new fields.  
- Never drop Lead columns in V1.  
- `evidence_ids` required for Opportunity promote.  
- Enums documented in schemas.  
- Duplicate prevention per `21`.  
- Supplier* stubs allowed empty; no matching logic in V1.

---

## 5. Service conventions

- Single responsibility (`22`).  
- Structured errors `{ ok, error, code, details }`.  
- Mutators: auth required (Sprint 6.1).  
- Anti-fabrication → HTTP 422.  
- No god functions.

---

## 6. Entity conventions

- Company hub FKs use `company_id`.  
- Soft deletes preferred over hard deletes for Evidence.  
- Snapshots of scores at Inbox decision time.  
- LearningEvent on every Approve/Reject.

---

## 7. Documentation rules

- Code change that alters behavior → update relevant doc same PR.  
- Docs `01`–`12` = business/system constitution; `20`–`32` = engineering.  
- No silent contradiction; if conflict, prefer `20`–`32` + this freeze + product owner.  
- Cursor prompts must reference `25`.

---

## 8. Prompt writing rules

- Follow `26` capability contracts.  
- Temperature/token limits as specified.  
- Always demand JSON schema.  
- Always include MUST NEVER block.  
- VerticalPack may specialize glossary, not constitution.

---

## 9. Testing rules

- Sprint acceptance from `24`.  
- Anti-fabrication tests mandatory for IPP mutators.  
- Regression: Leads + Outreach still work.  
- Pack switch changes recommendations.  
- No fake dashboard trends.

---

## 10. Versioning

- Docs: filename prefix immutable; content version noted in Status line when revised.  
- Functions: record prompt/extractor `version` in Evidence.extractor.  
- VerticalPack: `version` field recommended.  
- App: semver when releasing V1.

---

## 11. Migration rules

- Dry-run before backfill (`24` Sprint 1.3).  
- Idempotent backfills.  
- Dual-write window until company_id coverage high.  
- No destructive Lead wipes.

---

## 12. Backward compatibility

- Legacy Lead pipeline remains usable.  
- Feature flags: `ipp_v1_inbox`, `ipp_v1_company_required`, `ipp_v1_recommendations`.  
- Old UI paths must not break when flags off.

---

## 13. Definition of Done

1. Sprint AC met.  
2. Anti-fabrication held.  
3. MUST NOT files untouched.  
4. Docs updated if needed.  
5. Rollback known.  
6. Tests/checklist green.  
7. Review checklist below passed.

---

## 14. Acceptance criteria (release)

See Doc `20` AC1–AC12. All must pass for V1 launch.

---

## 15. Code review checklist

- [ ] Single responsibility preserved  
- [ ] Evidence/provenance for new facts  
- [ ] No invented contacts/projects  
- [ ] Path A/B scores not merged  
- [ ] Company hub respected  
- [ ] VerticalPack used instead of hardcoding sector  
- [ ] Auth on mutators  
- [ ] Docs updated  
- [ ] Feature flag / rollback  

---

## 16. Security checklist

- [ ] No secrets in repo  
- [ ] Auth gates  
- [ ] RLS awareness (InboxStats admin)  
- [ ] Enrichment quarantine  
- [ ] Tracking endpoints unguessable ids  
- [ ] No fake Connected badges  

---

## 17. Performance checklist

- [ ] Batch concurrency capped  
- [ ] No unbounded Lead.list assumptions for new intel queries  
- [ ] Score recompute not N² without need  
- [ ] Token limits respected  

---

## 18. Release checklist

- [ ] `24` Sprint 6.3 UAT signed  
- [ ] AC1–AC12 green  
- [ ] Flags configured  
- [ ] Packs `plastic_molds` + `industrial_water` seeded  
- [ ] Monitoring/alerts for function errors  
- [ ] Architecture freeze acknowledged  

---

## 19. Architecture Freeze Validation Matrix

| Concept | Covered? | Document(s) | Missing? | Priority |
|---------|----------|-------------|----------|----------|
| Company hub | Yes | 21, 29, 20 | — | Done |
| Lead/Contact | Yes | 21, 23, 03 | — | Done |
| Evidence model | Yes | 12, 21, 29 | — | Done |
| BuyingSignal | Yes | 12, 21, 26 | — | Done |
| Opportunity + Timeline | Yes | 21, 29 | Promote stage locked in 29 | Done |
| Intelligence Inbox | Yes | 12, 21–24 | — | Done |
| Path A / Path B | Yes | 20–25, 29 | — | Done |
| Relationship Score | Yes | 11, 21, 22 | — | Done |
| Opportunity Score | Yes | 11, 21, 22 | — | Done |
| Strategic Fit Score | Yes | 11, 21, 22 | — | Done |
| Priority Index | Yes | 11, 21, 22 | — | Done |
| OpportunityConfidence | Yes | 12, 26, 29 | — | Done |
| VerticalPacks | Yes | 21, 28 | — | Done |
| Source catalog | Yes | 27, 12 | — | Done |
| Product recommendations | Yes | 30, 21, 22, 26 | — | Done |
| AI prompt contracts | Yes | 26 | — | Done |
| Discovery workflow | Yes | 12, 20, 22 | — | Done |
| Verification | Yes | 12, 22 | — | Done |
| CRM execution KEEP | Yes | 04, 20, 22, 23 | — | Done |
| Supplier future path | Yes | 21, 22, 30 | Impl deferred | Done |
| Provenance | Yes | 21, 29, principles | — | Done |
| Learning loop | Yes | 12, 21, 24 | — | Done |
| UI IA | Yes | 23 | No visual design (intentional) | Done |
| Implementation sprints | Yes | 24 | — | Done |
| Cursor rules | Yes | 25 | — | Done |
| Governance / DoD | Yes | 31 | — | Done |
| Vision | Yes | 32 | — | Done |
| Service SRP map | Yes | 22 | — | Done |
| Anti-fabrication rules | Yes | 12, 20, 25, 26 | — | Done |
| Account vs Company alias | Yes | 26, 29, 31 | — | Done |
| InboxStats vs Intel Inbox | Yes | 31 | — | Done |
| Site/HQ hierarchy | Deferred | 03, 12 | Explicitly post-V1 | P2 |
| Auto-approve policy | Designed | 12, 20 | Default off | P1 ops |
| Full crawler fleet | Out V1 | 20, 27 | P1 sources first | P1 |

### Validation assertions

| Assertion | Status |
|-----------|--------|
| Every V1 entity defined | **Pass** (`21`) |
| Every service single responsibility | **Pass** (`22`) |
| Every AI interaction governed | **Pass** (`26`) |
| Every discovery source catalogued | **Pass** (`27`) |
| Every business workflow documented | **Pass** (`11`, `12`, `23`) |
| Every score defined | **Pass** (`11`, `21`) |
| Every graph relationship documented | **Pass** (`29`) |
| Every recommendation evidence-bound | **Pass** (`30`) |
| Future expansion via packs/suppliers | **Pass** (`28`, `21`) |
| Sprints executable without new architecture decisions | **Pass** (`24` + freeze) |

---

## 20. Freeze declaration

**ARCHITECTURE IS FROZEN.**

Future work may only: **implement · test · review · optimize**.  
No redesign unless explicitly requested by the product owner.
