import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Scheduled daily function: updates lead temperatures and creates stall tasks
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leads = await base44.asServiceRole.entities.Lead.list();
    const now = new Date();
    let updated = 0;
    let tasksCreated = 0;

    for (const lead of leads) {
      if (['won', 'lost'].includes(lead.status)) continue;

      const lastActivity = lead.last_activity_date ? new Date(lead.last_activity_date) : null;
      const daysSinceActivity = lastActivity
        ? Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24))
        : null;

      let newTemperature = lead.temperature || 'cold';

      // Rule: No activity for 14+ days → At Risk
      if (daysSinceActivity !== null && daysSinceActivity >= 14) {
        newTemperature = 'at_risk';
      }

      // Rule: Pipeline stage → Opportunity
      if (['proposal', 'negotiation'].includes(lead.status)) {
        newTemperature = lead.temperature === 'hot' ? 'hot' : 'opportunity';
      }

      // Stall detection for pipeline deals (10+ days without update)
      const updatedDate = lead.updated_date ? new Date(lead.updated_date) : null;
      const daysSinceUpdate = updatedDate
        ? Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24))
        : null;

      if (
        daysSinceUpdate !== null &&
        daysSinceUpdate >= 10 &&
        ['contacted', 'qualified', 'proposal', 'negotiation'].includes(lead.status)
      ) {
        // Create a stall task if not recently created
        await base44.asServiceRole.entities.Task.create({
          lead_id: lead.id,
          title: `⚠ Deal stalled — ${lead.first_name} ${lead.last_name} at ${lead.company_name}`,
          type: 'follow_up',
          priority: 'urgent',
          due_date: now.toISOString(),
          auto_generated: true,
          stage_trigger: lead.status,
          completed: false,
          notes: `No stage change in ${daysSinceUpdate} days. Stage: ${lead.status}`,
        });
        tasksCreated++;
      }

      // Update if temperature changed
      if (newTemperature !== lead.temperature) {
        await base44.asServiceRole.entities.Lead.update(lead.id, {
          temperature: newTemperature,
        });
        updated++;
      }
    }

    return Response.json({
      success: true,
      leads_processed: leads.length,
      temperatures_updated: updated,
      stall_tasks_created: tasksCreated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});