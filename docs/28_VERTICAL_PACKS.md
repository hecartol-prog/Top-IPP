# 28 — Vertical Packs

**Status:** Plug-in architecture for unlimited industrial sectors  
**Constitution:** Docs `11`, `12`, `21`, `22`, `26`, `27`  
**Rule:** New sectors = new VerticalPack records + config. No application redesign.

---

## 0. Pack schema (canonical)

Every pack defines:

| Block | Content |
|-------|---------|
| Mission | Why we pursue this sector |
| Industries | NAICS/free-text scopes |
| Products | Sellable solutions |
| Typical projects | Project shapes |
| Typical CAPEX | Value bands |
| Typical buyers | Org types |
| Decision makers | Personas (`11`) |
| Buying signals | Subset of `12` codes |
| Trade shows | Named events |
| Associations | |
| Government agencies | Relevant |
| Prompt templates | Keys → `26` |
| Discovery sources | Names → `27` |
| Recommended outreach | Channels/cadence |
| KPIs | Pack-specific |
| product_recommendation_rules | signal → products |
| score_weights | Optional Doc `11` overrides |

**V1 runtime seed (from `21`/`24`):** `plastic_molds`, `industrial_water` must be loadable.  
**This document** defines the full initial pack library for configuration readiness.

---

## 1. Industrial Water (`industrial_water`)

| Block | Content |
|-------|---------|
| **Mission** | Win water treatment, RO, desal, reuse, and industrial wastewater projects via China-capable packages + integration |
| **Industries** | Municipal water, industrial process water, F&B utilities, mining water, power, hospitality desal |
| **Products** | RO/UF/NF skids, pretreatment, dosing, CIP, brine, containerized plants, pumps, membranes (sourced) |
| **Typical projects** | Plant water upgrade; new factory utilities; desal train; ZLD study→skid |
| **Typical CAPEX** | USD 50k–15M+ |
| **Buyers** | Utilities, industrial plants, EPCs, industrial parks, resorts |
| **Decision makers** | Operations Director, Plant Manager, Engineering, Project Manager, Procurement, Government Procurement, EPC |
| **Buying signals** | `water_treatment`, `environmental_approval`, `water_discharge_permit`, `tender_published`, `factory_expansion`, `hiring_engineers` |
| **Trade shows** | IDA, WEFTEC regional, local water expos |
| **Associations** | National water associations; desal associations |
| **Agencies** | Env ministries, water utilities, industrial park authorities |
| **Prompt keys** | evidence_extraction, buying_signal_extraction, tender_summarization, product_recommendation, company_summarization |
| **Sources** | Env permits, tenders, official sites, news, investment, registries |
| **Outreach** | Engineer-to-engineer + EPC co-sell; quarterly nurture on regulation themes |
| **KPIs** | Water signals/week; tender coverage; RO-related qualified opps; win rate water |
| **Rec rules (examples)** | `water_treatment`→ RO, pretreatment, pumps; `new_plant_greenfield`→ full utility water package |

---

## 2. Food & Beverage (`food_beverage`)

| Block | Content |
|-------|---------|
| **Mission** | Capture processing + beverage line CAPEX with hygiene-compliant China OEM packages |
| **Industries** | Food processing, beverage, dairy, co-packing |
| **Products** | Process lines, filling, pasteurization, freezing, CIP, water for F&B, packaging interfaces |
| **Projects** | New plant; line expansion; hygiene upgrade; new SKU capacity |
| **CAPEX** | USD 150k–10M+ |
| **Buyers** | Brand owners, processors, bottlers, investors |
| **DMs** | Owner, Operations, Plant Manager, QA influencers, Engineering, Procurement |
| **Signals** | `new_production_line`, `new_plant_greenfield`, `packaging_upgrade`, `iso_certification`, `hiring_production`, `water_treatment` |
| **Shows** | Anuga/Gulfood regional; packing expos |
| **Associations** | Food manufacturer associations |
| **Agencies** | Food safety authorities; agri funds |
| **Prompts** | website_extraction, product_recommendation, news_summarization |
| **Sources** | Construction permits, news, trade shows, hiring, official sites |
| **Outreach** | Case studies hygiene/FAT; Path A nurture between CAPEX |
| **KPIs** | Line-shaped opps; F&B pack win rate |
| **Rec rules** | `new_production_line`→ process + water + packaging + automation bundle |

---

## 3. Packaging (`packaging`)

| Block | Content |
|-------|---------|
| **Mission** | Win packaging equipment upgrades tied to CPG/F&B capacity |
| **Products** | Wrappers, cartoners, case packers, labelers, palletizers |
| **Projects** | Speed upgrade; new format; e-comm pack |
| **CAPEX** | USD 40k–2M+ |
| **Buyers** | CPG, F&B, contract packers |
| **DMs** | Operations, Packaging Manager, Plant Manager, Procurement |
| **Signals** | `packaging_upgrade`, `new_product_launch`, `new_production_line`, `hiring_engineers` |
| **Shows** | Pack Expo regional; interpack satellite events |
| **Sources** | News, trade shows, hiring, RFQ/tenders |
| **Outreach** | Format flexibility + changeover ROI |
| **KPIs** | Packaging signal→opp conversion |
| **Rec rules** | `packaging_upgrade`→ packers/palletizers; bundle with conveyors/automation |

---

## 4. Automation (`factory_automation`)

| Block | Content |
|-------|---------|
| **Mission** | Sell automation cells and line integration with China hardware + local commissioning path |
| **Products** | Conveyors, robotics cells, PLC/SCADA packages, inspection, pick-and-place |
| **Projects** | Labor replacement; quality cells; new plant automation |
| **CAPEX** | USD 50k–5M+ |
| **Buyers** | Manufacturers, SIs |
| **DMs** | Operations, Engineering, Plant Manager, Maintenance, SI partners |
| **Signals** | `automation_upgrade`, `hiring_automation`, `factory_expansion`, `energy_efficiency` |
| **Shows** | Automation fairs; industry vertical shows |
| **Sources** | Hiring, news, trade shows, tenders |
| **Outreach** | ROI/labor payback; SI co-sell |
| **KPIs** | Automation qualified opps; SI-sourced pipeline |
| **Rec rules** | `automation_upgrade`→ cells, conveyors, vision; may attach compressors/energy |

---

## 5. Automotive (`automotive`)

| Block | Content |
|-------|---------|
| **Mission** | Tooling, plastics, automation, and process equipment for auto suppliers |
| **Products** | Molds, plastic parts OEM, automation, specialty machinery |
| **Projects** | New platform tooling; line expansion; dual-source China |
| **CAPEX** | USD 20k–5M+ (wide) |
| **Buyers** | Tier-1/2 suppliers, molders |
| **DMs** | Engineering Director, Purchasing, Quality, Plant Manager |
| **Signals** | `new_product_launch`, `new_machinery`, `hiring_engineers`, `china_sourcing_intent`, `iso_certification` |
| **Shows** | Automechanika regional; plastics shows |
| **Sources** | Trade shows, news, import data, official sites |
| **Outreach** | Spec/quality rigor; audit narrative |
| **KPIs** | Auto vertical pipeline value |
| **Rec rules** | Launch→ molds + automation; sourcing intent→ OEM/ODM |

---

## 6. Furniture (`furniture`)

| Block | Content |
|-------|---------|
| **Mission** | Machinery, materials processing, and OEM programs for furniture manufacturers |
| **Products** | Wood/panel machinery, packaging, OEM components |
| **Projects** | Factory upgrade; export expansion capacity |
| **CAPEX** | USD 30k–2M+ |
| **Buyers** | Furniture factories, exporters |
| **DMs** | Owner, Plant Manager, Procurement |
| **Signals** | `export_expansion`, `new_machinery`, `factory_expansion`, `trade_show_participation` |
| **Shows** | Furniture fairs; woodworking expos |
| **Sources** | Trade shows, import/export, news |
| **Outreach** | Owner-led trust; staged CAPEX |
| **KPIs** | Furniture Path A companies verified; machinery opps |
| **Rec rules** | `new_machinery`→ process machines; `export_expansion`→ packaging + capacity |

---

## 7. Medical Devices (`medical_devices`)

| Block | Content |
|-------|---------|
| **Mission** | Selective pursuit where certifications and quality systems allow China-sourced equipment/components |
| **Products** | Clean packaging, precision plastics/molds, selective automation |
| **Projects** | Cleanroom line; component OEM; packaging compliance |
| **CAPEX** | USD 50k–3M+ |
| **Buyers** | Device makers, component suppliers |
| **DMs** | Technical Director, Quality, Engineering, Procurement |
| **Signals** | `iso_certification`, `new_production_line`, `hiring_engineers`, `tender_published` |
| **Shows** | Medtech expos |
| **Sources** | Registries, news, association, tenders |
| **Outreach** | Compliance-first; never oversell uncertified kit |
| **KPIs** | Fit-score distribution (reject low cert fit) |
| **Rec rules** | Strict Strategic Fit gate before recommend |

---

## 8. Electronics (`electronics`)

| Block | Content |
|-------|---------|
| **Mission** | Assembly/packaging/automation and OEM plastics for electronics manufacturers |
| **Products** | Automation, packaging, molds/plastics, ESD-aware handling |
| **Projects** | SMT-adjacent automation; enclosure tooling; capacity |
| **CAPEX** | USD 40k–4M+ |
| **Buyers** | EMS, brand hardware |
| **DMs** | Engineering, Operations, Procurement, NPI |
| **Signals** | `new_production_line`, `automation_upgrade`, `new_product_launch`, `china_sourcing_intent` |
| **Shows** | Electronica regional; manufacturing shows |
| **Sources** | News, hiring, trade, import |
| **Outreach** | NPI speed + quality |
| **KPIs** | Electronics opps with evidence strength ≥ dual-source |
| **Rec rules** | Line→ automation+packaging; launch→ molds/enclosures |

---

## 9. Mining (`mining`)

| Block | Content |
|-------|---------|
| **Mission** | Water, materials handling, and selective machinery for mining/industrial minerals |
| **Products** | Water treatment, pumps, conveyors, specialty machines |
| **Projects** | Water compliance; plant expansion; dewatering |
| **CAPEX** | USD 100k–20M+ |
| **Buyers** | Mining cos, processors, EPCs |
| **DMs** | Operations, Engineering, Project Manager, Procurement, Government |
| **Signals** | `environmental_approval`, `water_treatment`, `construction_permit`, `tender_published`, `investment` family |
| **Shows** | Mining expos |
| **Agencies** | Mining & environment ministries |
| **Sources** | Permits, tenders, investment news |
| **Outreach** | EPC partnership; compliance narrative |
| **KPIs** | Permit-linked opps |
| **Rec rules** | Env water→ treatment trains; expansion→ conveyors/water |

---

## 10. Energy (`energy`)

| Block | Content |
|-------|---------|
| **Mission** | Small wind (10–50 kW), efficiency, and industrial energy packages where fit is honest |
| **Products** | Small wind turbines, controllers, hybrid kits, efficiency equipment |
| **Projects** | Farm/resort microgen; remote industrial site; grant projects |
| **CAPEX** | USD 15k–400k typical small wind; larger if hybrid |
| **Buyers** | Farms, resorts, remote sites, municipalities, distributors |
| **DMs** | Owner, Facility/Energy Manager, Government program leads, consultants |
| **Signals** | `energy_efficiency`, `tender_published`, `government_investment`, `environmental_approval` |
| **Shows** | Renewables expos |
| **Sources** | Tenders, grants news, associations |
| **Outreach** | Feasibility honesty; certification clarity |
| **KPIs** | Qualified small-wind opps; distributor Path A growth |
| **Rec rules** | Energy efficiency→ audit which products apply; never invent site production claims |

---

## 11. Chemical (`chemical`)

| Block | Content |
|-------|---------|
| **Mission** | Process water, packaging, and selective equipment for chemical/process industries |
| **Products** | Water/waste systems, packaging, pumps, automation for utilities |
| **Projects** | Effluent upgrade; utility expansion; packaging lines |
| **CAPEX** | USD 100k–10M+ |
| **Buyers** | Chemical plants, blenders, EPCs |
| **DMs** | Technical Director, Operations, HSE influencers, Procurement, EPC |
| **Signals** | `environmental_approval`, `water_discharge_permit`, `factory_expansion`, `tender_published`, `iso_certification` |
| **Shows** | Chemtech regional |
| **Agencies** | Environmental regulators |
| **Sources** | Env permits, tenders, news |
| **Outreach** | HSE + compliance; EPC path |
| **KPIs** | Env-linked qualified pipeline |
| **Rec rules** | Discharge permit→ water treatment; expansion→ utilities + automation |

---

## 12. Plastic Molds & Products (legacy strength) (`plastic_molds`)

| Block | Content |
|-------|---------|
| **Mission** | Preserve and extend Top Mold CRM strength as a Vertical Pack — tooling + plastic products + OEM |
| **Products** | Injection molds, hot runners, molded parts, OEM/ODM programs |
| **Projects** | New product tooling; dual-source; cost-down |
| **CAPEX** | USD 5k–250k molds; programs higher |
| **Buyers** | Plastic OEMs, consumer goods, auto plastics, importers |
| **DMs** | Engineering, Purchasing, Owner (SME) |
| **Signals** | `new_product_launch`, `china_sourcing_intent`, `trade_show_participation`, `rfq_detected`, `hiring_engineers` |
| **Shows** | Plastics expos; existing CRM trade-show flows |
| **Sources** | Existing CRM, Apollo assist, websites, trade shows, LinkedIn |
| **Outreach** | KEEP existing templates/sequences; bilingual EN/ES |
| **KPIs** | Legacy CRM conversion + evidence-backed RFQs |
| **Rec rules** | Launch→ mold + OEM; sourcing→ China partnership |

---

## 13. Adding a new pack (no redesign)

1. Create VerticalPack record with blocks above.  
2. Select Source Names from `27`.  
3. Select signal codes from `12`.  
4. Bind prompt keys from `26`.  
5. Define recommendation rules.  
6. Activate `active=true`.  
7. No new core entities required.

---

## 14. Freeze note

Pack **content** may expand; pack **architecture** is frozen.
