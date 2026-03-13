/**
 * Lead Scoring Engine for TopMold CRM
 * Scores leads 0–100 based on engagement, deal value, company size, and responsiveness.
 */

const SPANISH_COUNTRIES = ["Mexico", "Argentina", "Colombia", "Spain", "Chile", "Peru", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay", "Guatemala", "El Salvador", "Honduras", "Nicaragua", "Costa Rica", "Dominican Republic"];
const SPANISH_DOMAINS = ["mx", "ar", "co", "es", "cl", "pe", "ve", "ec", "bo", "py", "uy", "gt", "sv", "hn", "ni", "cr", "do", "cu", "pr"];

export function calculateLeadScore(lead) {
  let score = 0;

  // 1. Pipeline Stage (0–25 pts)
  const stageScores = { new: 5, contacted: 10, qualified: 18, proposal: 22, negotiation: 25, won: 25, lost: 0 };
  score += stageScores[lead.status] || 0;

  // 2. Estimated Deal Value (0–25 pts)
  const val = lead.estimated_value || 0;
  if (val >= 100000) score += 25;
  else if (val >= 50000) score += 20;
  else if (val >= 20000) score += 14;
  else if (val >= 5000) score += 8;
  else if (val > 0) score += 3;

  // 3. Company Size (0–15 pts)
  const sizeScores = { "1000+": 15, "501-1000": 12, "201-500": 10, "51-200": 6, "11-50": 3, "1-10": 1 };
  score += sizeScores[lead.company_size] || 0;

  // 4. Engagement / Recency (0–20 pts)
  if (lead.last_contacted) {
    const daysSince = (Date.now() - new Date(lead.last_contacted)) / (1000 * 60 * 60 * 24);
    if (daysSince <= 3) score += 20;
    else if (daysSince <= 7) score += 15;
    else if (daysSince <= 14) score += 10;
    else if (daysSince <= 30) score += 5;
  }

  // 5. Data Completeness (0–10 pts)
  if (lead.email) score += 2;
  if (lead.phone) score += 2;
  if (lead.linkedin_url) score += 2;
  if (lead.estimated_value) score += 2;
  if (lead.company_size) score += 2;

  // 6. Priority flag (0–5 pts)
  const priorityBonus = { urgent: 5, high: 4, medium: 2, low: 0 };
  score += priorityBonus[lead.priority] || 0;

  return Math.min(100, Math.round(score));
}

export function getScoreLabel(score) {
  if (score >= 75) return { label: "🔥 Hot", color: "text-red-700 bg-red-50 border-red-200" };
  if (score >= 50) return { label: "🌤 Warm", color: "text-orange-600 bg-orange-50 border-orange-200" };
  if (score >= 25) return { label: "🌊 Cool", color: "text-amber-600 bg-amber-50 border-amber-200" };
  return { label: "❄️ Cold", color: "text-slate-500 bg-slate-50 border-slate-200" };
}

export function getLanguageForLead(lead) {
  if (lead.language === "spanish") return "spanish";
  const emailDomain = (lead.email || "").split("@")[1]?.split(".").pop()?.toLowerCase();
  if (SPANISH_DOMAINS.includes(emailDomain)) return "spanish";
  if (lead.country && SPANISH_COUNTRIES.includes(lead.country)) return "spanish";
  return "english";
}