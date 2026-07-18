# 25 — Cursor Development Rules (Permanent)

**Audience:** Every human and Cursor agent working on Top-IPP.  
**Status:** Binding engineering constitution for implementation.  
**Related:** Docs `01`–`12` (business/system constitution), `20`–`24` (implementation blueprint).

---

## 0. Prime directives

1. **The platform never fabricates leads or business information.** It discovers companies, relationships, and opportunities supported by **verifiable evidence**.  
2. **CRM is the execution layer; Intelligence is the product.**  
3. **Path A (Market Intelligence)** and **Path B (Opportunity Intelligence)** both converge on **Company**; Relationship Score and Opportunity Score stay **independent**.  
4. **Do not contradict** docs in `/docs`. If reality diverges, **update documentation in the same change**.  
5. **Do not redesign** architecture invented in docs `20`–`23`. Implement it.  
6. **V1 scope discipline:** No Supplier matching engine/UI until explicitly scheduled post-V1.

---

## 1. Before writing any code

- [ ] Read the sprint in `24_PHASE1_BACKLOG.md` (or the task’s listed files).  
- [ ] Read relevant sections of `21` / `22` / `23`.  
- [ ] Confirm Path A vs Path B impact.  
- [ ] List files to change; list files that MUST NOT change.  
- [ ] Define acceptance criteria and rollback.

**If the task is ambiguous:** ask; do not invent product behavior.

---

## 2. File change discipline

| Rule | Detail |
|------|--------|
| Modify only listed files | Stay inside the sprint/task allowlist |
| Never refactor unrelated modules | No “while I’m here” cleanups |
| No drive-by renames | Unless the sprint says so |
| Prefer additive changes | Nullable fields; feature flags |
| One responsibility per PR/commit | Small commits |
| Preserve backward compatibility | Legacy Lead flows must keep working |

---

## 3. Architecture rules

| Rule | Detail |
|------|--------|
| Do not invent architecture | Follow `20`–`23` |
| Prefer composition over duplication | Shared scoring libs; shared validators |
| Keep services modular | Discovery / Verification / Scoring / Recommendation / CRM / AI / Inbox |
| Vertical Packs for new sectors | Config, not forks |
| Recommendations need evidence | ProductRecommendation must link evidence_ids + signal_ids |
| Supplier Intelligence | Schema stubs only until post-V1 |
| Opportunity Timeline | Use canonical stages from `21` |
| Base44 stays | No unauthorized platform rewrite |

---

## 4. Data & AI rules

| MUST | MUST NOT |
|------|----------|
| Require evidence (or manual attestation) for opportunities | Invent companies, projects, contacts |
| Quarantine enrichment suggestions until verified | Invent emails or phones |
| Store provenance and source_type | Silent CRM writes from AI |
| Use Doc 11 score formulas | Invent alternate score systems without doc update |
| Parameterize mold-specific prompts via VerticalPack | Hardcode one vertical forever into new IPP services |
| Record LearningEvent on Inbox reject/approve | Drop reason codes |

**AI may:** summarize, classify, compare, prioritize, recommend, extract facts from artifacts, calculate scores.  
**AI must never:** invent data, contacts, emails, phones, projects, companies.

---

## 5. CRM trust rules

- Do not flood CRM from raw scrape.  
- Promote only via Intelligence Inbox approval (`inboxPromoteToCrm`).  
- Keep SMTP caps, tracking, templates working.  
- Lead remains a Contact; deals/projects live on Opportunity.

---

## 6. Security & quality

- Mutating IPP functions require `auth.me()` (or signed cron) — see Sprint 6.1.  
- Do not reintroduce fake “Connected” badges.  
- Do not add unused heavy dependencies.  
- Cap batch enrichment concurrency.  
- Do not weaken Evidence validation to “make demos pass.”

---

## 7. Documentation rules

After implementing a sprint:

1. If schema/services/UI IA changed → update `21` / `22` / `23` accordingly.  
2. If sprint order changed → update `24`.  
3. If philosophy/scores/signals changed → update `11` / `12` (rare; requires explicit approval).  
4. Never leave docs contradicting code.

---

## 8. Commit rules

- Small, focused commits.  
- Message explains **why** (business/intel outcome), not only file list.  
- Do not commit secrets (`.env`, SMTP, API keys).  
- Do not commit unless the user requested a commit (per project norms).

---

## 9. Testing checklist (minimum each sprint)

- [ ] App still boots (`npm run dev` / build).  
- [ ] Sprint acceptance criteria pass.  
- [ ] No fabrication path introduced.  
- [ ] MUST NOT files untouched.  
- [ ] Rollback path identified.  
- [ ] Regression: Leads list + one outreach page still works (unless sprint says otherwise).

---

## 10. Prompt template for Cursor (mandatory header)

Future implementation prompts SHOULD begin with:

```text
Follow docs/25_CURSOR_DEVELOPMENT_RULES.md and the System Constitution in /docs.
Sprint: <id from 24_PHASE1_BACKLOG.md>
Allowed files: <list>
Forbidden files: <list>
Do not fabricate business data.
Do not implement Supplier matching.
Deliver working app; update docs if behavior changes.
```

---

## 11. Definition of done

A change is done only when:

1. Acceptance criteria met.  
2. Anti-fabrication rules held.  
3. Backward compatible with CRM execution.  
4. Docs updated if needed.  
5. Rollback known.

---

## 12. Explicit anti-patterns

| Anti-pattern | Why banned |
|--------------|------------|
| `Lead.create` from unverified scrape as default success | Pollutes CRM; fabricates funnel |
| Single “score” merging Rel + Opp | Breaks Path A/B independence |
| New vertical via copy-paste app | Breaks Vertical Pack model |
| Building Supplier matching “quickly” in V1 | Scope breach |
| Redesigning navigation without `23` | IA drift |
| “Temporary” invented emails for demos | Corrupts trust permanently |

---

**End of permanent rules.**  
When in doubt: protect evidence truth, protect CRM cleanliness, increase probability of closing real industrial projects.
