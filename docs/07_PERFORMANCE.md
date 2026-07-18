# 07 — Performance

## Observed characteristics

| Area | Behavior | Risk |
|------|----------|------|
| Entity lists | Client-side `list` / filter via Base44 + React Query | Degrades as Lead volume grows |
| Enrichment | Parallel fan-out (website + DDG + Bing + Clearbit + Apollo) per lead | Latency + cost spikes on batch |
| LLM | Many interactive InvokeLLM calls | Token cost; UI blocking |
| SMTP | Queue + daily cap (~20/inbox pattern) | **Good** throttle — KEEP |
| Bundle | Full shadcn kit + unused heavy deps (three, leaflet, jspdf…) | Larger than needed |
| Dashboard | Charts via Recharts; some hardcoded trend copy | Light |

---

## Issues

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Batch enrich without global concurrency limiter | **High** | Performance / Business (API spend) | Medium |
| Per-lead multi-fetch scrape (contact pages) | **Medium** | Performance | Medium |
| Client LLM for CSV mapping on large files | **Medium** | Performance | Medium |
| Unused heavy npm packages inflate install/build | **Low** | Performance / Maintainability | Small |
| No pagination strategy documented for Lead.list | **High** | Scalability | Medium |
| Dual auth.me() (Layout + AuthContext) | **Low** | Performance | Small |

---

## Scalability limits for IPP

Continuous industrial discovery implies:

- High-volume signal ingestion  
- Many enrichment jobs  
- Scoring refreshes  

Current architecture is **interactive CRM + on-demand jobs**, not a high-throughput pipeline with durable work queues beyond EmailQueue.

| Gap | Severity | Impact | Effort |
|-----|----------|--------|--------|
| No general job queue for discovery/enrichment | **High** | Scalability | Large |
| EmailQueue is email-only | **Medium** | Scalability | Medium |

**KEEP** EmailQueue pattern as a template for a future `EnrichmentJob` / `DiscoveryJob` entity.  
**REFACTOR** batch enrich to use capped workers.  
**Do not** rewrite the SPA for scale first — add job entities.

---

## Performance score drivers

- Strength: SMTP rate limiting, Promise.allSettled in enrichLead, React Query caching.  
- Weakness: N× enrichment fan-out, list-all patterns, LLM without budget controls.

**Scalability: 4.0 / 10**  
**Performance (current CRM size): acceptable; batch ops are the cliff.**

---

## KEEP / REFACTOR / REMOVE (performance)

| Item | Action |
|------|--------|
| EmailQueue + inbox daily caps | **KEEP** |
| Promise.allSettled multi-source enrich | **KEEP** |
| React Query | **KEEP** |
| Unbounded batch enrich | **REFACTOR** |
| Lead.list without pagination strategy | **REFACTOR** |
| Unused three/leaflet/jspdf/stripe | **REMOVE** |
