import type { DemoReportRow } from "./report-types"

/** Add linked operation and usage records without changing Overview's activity. */
export function attachDemoPerformance(input: Record<string, unknown>, now = new Date()) {
  const data = input as Record<string, DemoReportRow[]>
  const site = data.sites?.[0]
  const segments = data.segments?.filter(row => row.site_id === site?.id)
  if (!site || !segments?.length) return data

  const prefix = `${site.id}-performance-`
  const result = { ...data }
  for (const table of ["content", "requirements", "requirement_segments", "commands", "instance_logs", "remote_instances"]) {
    result[table] = (data[table] || []).filter(row => !row.id.startsWith(prefix))
  }
  const stamp = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  const instance = result.remote_instances.find(row => row.site_id === site.id)
  const instanceId = instance?.id || `${prefix}instance`
  if (!instance) result.remote_instances.push({
    id: instanceId, site_id: site.id, user_id: site.user_id,
    name: "Sample performance workspace", status: "active", is_archived: false,
    created_at: stamp(60), updated_at: stamp(0),
  })

  segments.forEach((segment, segmentIndex) => {
    const leads = (data.leads || []).filter(row => row.site_id === site.id && row.segment_id === segment.id)
    for (const [index, daysAgo] of [0, 2, 5, 9, 14, 21, 28, 35, 42, 49, 56].entries()) {
      const id = `${prefix}${segmentIndex}-${index}`
      const created = stamp(daysAgo)
      const lead = leads.find(row => row.id === `${site.id}-overview-${segmentIndex}-${index}-lead`) || leads[index % leads.length]
      const task = (data.tasks || []).find(row => row.site_id === site.id && row.lead_id === lead?.id)
      const conversation = (data.conversations || []).find(row => row.site_id === site.id && row.lead_id === lead?.id)
      const requirementId = `${id}-requirement`
      const contentId = `${id}-content`
      const commandId = `${id}-command`
      const completed = index % 4 !== 3
      const approved = index % 3 !== 2
      const links = {
        site_id: site.id, user_id: site.user_id, segment_id: segment.id,
        lead_id: lead?.id, task_id: task?.id, conversation_id: conversation?.id,
      }

      result.requirements.push({
        ...links, id: requirementId, title: `${segment.name || "Segment"} content review`,
        description: "Review the sample customer walkthrough and approve the creative assets.",
        status: completed ? "completed" : "in_progress", completion_status: completed ? "completed" : "pending",
        created_at: created, updated_at: created, due_date: created.slice(0, 10),
        completed_at: completed ? created : null,
      })
      result.requirement_segments.push({
        id: `${id}-requirement-segment`, site_id: site.id, requirement_id: requirementId,
        segment_id: segment.id, created_at: created,
      })
      result.content.push({
        ...links, id: contentId, requirement_id: requirementId,
        title: `${segment.name || "Segment"} sample walkthrough ${index + 1}`,
        description: "A sample product walkthrough prepared for the selected audience.",
        type: index % 2 ? "video" : "blog_post", status: approved ? "approved" : "draft",
        created_at: created, updated_at: created, approved_at: approved ? created : null,
      })
      result.commands.push({
        ...links, id: commandId, uuid: commandId, instance_id: instanceId,
        requirement_id: requirementId, content_id: contentId, status: "completed",
        task: "Prepare a sample audience walkthrough", input_tokens: 1800 + segmentIndex * 200 + index * 70,
        output_tokens: 640 + segmentIndex * 90 + index * 35,
        created_at: created, updated_at: created,
      })
      for (const [toolIndex, tool] of ["summarize_content", "generate_image", "generate_video"].entries()) {
        result.instance_logs.push({
          ...links, id: `${id}-log-${toolIndex}`, instance_id: instanceId, command_id: commandId,
          requirement_id: requirementId, content_id: contentId, log_type: "tool_result", level: "info",
          tool_name: tool, message: `Sample ${tool.replace(/_/g, " ")} completed`,
          tokens_used: { promptTokens: 320 + index * 25 + toolIndex * 40, completionTokens: 120 + index * 10 + toolIndex * 20 },
          duration_ms: toolIndex === 2 ? 90_000 + segmentIndex * 15_000 + index * 5_000 : 1500,
          created_at: created,
        })
      }
    }
  })
  return result
}