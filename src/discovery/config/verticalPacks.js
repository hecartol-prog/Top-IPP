/**
 * Production Vertical Pack configurations (Sprint 2.2).
 * Config only — maps to VerticalPack entity fields (docs/28, docs/33).
 * No new persistence entities.
 */

/**
 * @typedef {Object} VerticalPackConfig
 * @property {string} code
 * @property {string} name
 * @property {string[]} evidence_keywords
 * @property {string[]} typical_products
 * @property {string[]} buying_signal_codes
 * @property {string[]} discovery_source_ids
 * @property {boolean} active
 */

/** @type {VerticalPackConfig[]} */
export const PRODUCTION_VERTICAL_PACKS = Object.freeze([
  Object.freeze({
    code: 'industrial_water',
    name: 'Industrial Water & Desalination',
    active: true,
    evidence_keywords: Object.freeze([
      'Reverse Osmosis',
      'UF',
      'MBR',
      'EDI',
      'Water Treatment',
      'Wastewater',
      'Industrial Water',
      'Desalination',
      'Pump Stations',
      'Water Infrastructure',
    ]),
    typical_products: Object.freeze([
      'RO/UF/NF skids',
      'pretreatment',
      'MBR',
      'EDI',
      'desalination trains',
      'pump stations',
    ]),
    buying_signal_codes: Object.freeze([
      'environmental_approval',
      'water_treatment',
      'water_discharge_permit',
      'factory_expansion',
      'tender_published',
      'government_investment',
    ]),
    discovery_source_ids: Object.freeze([
      'src_water_news_rss',
      'src_water_permits_json',
      'src_water_csv_import',
    ]),
  }),
  Object.freeze({
    code: 'production_lines',
    name: 'Production Lines',
    active: true,
    evidence_keywords: Object.freeze([
      'Factory Expansion',
      'Packaging Lines',
      'Food Processing',
      'Assembly',
      'Automation Upgrades',
      'Production Capacity',
      'Plant Construction',
    ]),
    typical_products: Object.freeze([
      'turnkey production lines',
      'packaging lines',
      'food processing lines',
      'assembly systems',
    ]),
    buying_signal_codes: Object.freeze([
      'factory_expansion',
      'new_production_line',
      'new_plant_greenfield',
      'construction_permit',
      'packaging_upgrade',
      'automation_upgrade',
    ]),
    discovery_source_ids: Object.freeze([
      'src_lines_sitemap',
      'src_lines_news_rss',
      'src_lines_manual_url',
    ]),
  }),
  Object.freeze({
    code: 'factory_automation',
    name: 'Factory Automation',
    active: true,
    evidence_keywords: Object.freeze([
      'Robotics',
      'PLC',
      'SCADA',
      'MES',
      'Industrial IoT',
      'Digital Factory',
      'Predictive Maintenance',
      'Conveyors',
      'Warehouse Automation',
    ]),
    typical_products: Object.freeze([
      'robotics cells',
      'PLC/SCADA packages',
      'conveyors',
      'MES',
      'warehouse automation',
    ]),
    buying_signal_codes: Object.freeze([
      'automation_upgrade',
      'digitalization',
      'hiring_automation',
      'new_machinery',
      'factory_expansion',
    ]),
    discovery_source_ids: Object.freeze([
      'src_automation_json',
      'src_automation_rss',
    ]),
  }),
  Object.freeze({
    code: 'industrial_machinery',
    name: 'Industrial Machinery',
    active: true,
    evidence_keywords: Object.freeze([
      'CNC',
      'Injection Machines',
      'Blow Molding',
      'Extrusion',
      'Compressors',
      'Boilers',
      'Used Equipment',
      'Heavy Machinery',
      'Machine Retrofits',
    ]),
    typical_products: Object.freeze([
      'CNC',
      'injection machines',
      'blow molding',
      'extrusion',
      'compressors',
      'boilers',
    ]),
    buying_signal_codes: Object.freeze([
      'new_machinery',
      'energy_efficiency',
      'hiring_maintenance',
      'rfq_detected',
    ]),
    discovery_source_ids: Object.freeze([
      'src_machinery_csv',
      'src_machinery_json',
    ]),
  }),
  Object.freeze({
    code: 'plastic_manufacturing',
    name: 'Plastic Manufacturing',
    active: true,
    evidence_keywords: Object.freeze([
      'Injection Molds',
      'Plastic Parts',
      'Tooling',
      'OEM',
      'ODM',
      'Automotive Plastics',
      'Packaging Plastics',
      'Medical Plastics',
    ]),
    typical_products: Object.freeze([
      'injection molds',
      'plastic parts',
      'tooling',
      'OEM/ODM programs',
    ]),
    buying_signal_codes: Object.freeze([
      'new_product_launch',
      'new_machinery',
      'china_sourcing_intent',
      'hiring_engineers',
      'trade_show_participation',
    ]),
    discovery_source_ids: Object.freeze([
      'src_plastics_rss',
      'src_plastics_pdf_meta',
      'src_plastics_csv',
    ]),
  }),
]);

/**
 * @param {string} code
 * @returns {VerticalPackConfig|undefined}
 */
export function getVerticalPack(code) {
  return PRODUCTION_VERTICAL_PACKS.find((p) => p.code === code);
}

/**
 * Payload suitable for VerticalPack.create (Base44).
 * @param {VerticalPackConfig} pack
 */
export function toVerticalPackEntity(pack) {
  return {
    code: pack.code,
    name: pack.name,
    active: pack.active !== false,
    discovery_source_ids: [...pack.discovery_source_ids],
    buying_signal_codes: [...pack.buying_signal_codes],
    typical_products: [...pack.typical_products],
    typical_equipment: [...pack.evidence_keywords],
  };
}
