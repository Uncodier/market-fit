// Preserve independent reads across automatic suspension, never across later writes.
const readOnly = new Set(['finish_task', 'requirement_progress', 'read_files', 'read_session_history', 'read_result_artifact']);
function mayHaveDetachedWriter(call) {
  if (call.name !== 'exec') return false;
  let args;
  try { args = JSON.parse(call.arguments); } catch { return true; }
  if (args.background === true || typeof args.command !== 'string') return true;
  // Conservative denial: a returned foreground command can still leave children.
  return /&|\b(?:nohup|disown|setsid|subprocess|threading|multiprocessing|fork|spawn|Popen|system|popen|execv\w*|posix_spawn\w*)\b/.test(args.command.replace(/&&/g, ''));
}
function fileEvidence(observations, path) {
  const last = observations.at(-1);
  if (!last || last.files?.[path]?.state !== 'unavailable' || last.session?.status !== 'completed') return last;
  const finalMessages = last.session.messages;
  if (!Array.isArray(finalMessages)) return last;
  for (let index = observations.length - 2; index >= 0; index--) {
    const candidate = observations[index];
    if (candidate.files?.[path]?.state === 'unavailable') continue;
    // A missing or mismatching newer read must not be replaced with an older one.
    if (candidate.files?.[path]?.state !== 'read' || candidate.complete !== true ||
      candidate.session?.id !== last.session.id ||
      !candidate.session?.workspace?.id || candidate.session.workspace.id !== last.session.workspace?.id ||
      candidate.mapping?.session_id !== last.mapping?.session_id) return last;
    const messages = candidate.session.messages;
    if (!Array.isArray(messages) || JSON.stringify(messages) !== JSON.stringify(finalMessages.slice(0, messages.length))) return last;
    const calls = messages.flatMap(message => message.toolCalls || []);
    const receipts = new Set(messages.filter(message => message.role === 'tool').map(message => message.toolCallId));
    if (calls.some(call => !receipts.has(call.id) || mayHaveDetachedWriter(call))) return last;
    const laterCalls = finalMessages.slice(messages.length).flatMap(message => message.toolCalls || []);
    if (laterCalls.some(call => !readOnly.has(call.name))) return last;
    return candidate;
  }
  return last;
}
module.exports = { fileEvidence };