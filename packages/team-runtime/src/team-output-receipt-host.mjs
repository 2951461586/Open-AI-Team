function isTeamOutputReceipt(evt = {}) {
  const commandId = String(evt.commandId || evt.command_id || '');
  const taskId = String(evt.taskId || evt.task_id || '');
  const outputRequestId = String(evt.outputRequestId || evt.output_request_id || '');
  return (commandId.startsWith('team-output:') && !!taskId) || (!!taskId && !!outputRequestId);
}

function handleTeamOutputReceipt(evt = {}, ctx = {}) {
  if (!isTeamOutputReceipt(evt)) {
    return { ok: false, accepted: false, advanced: false, error: 'not_team_output_receipt' };
  }
  if (typeof ctx?.teamOutputBridge?.onOutputReceipt !== 'function') {
    return {
      ok: false,
      accepted: false,
      advanced: false,
      type: 'team_output_receipt',
      error: 'team_output_bridge_not_configured',
    };
  }
  const out = ctx.teamOutputBridge.onOutputReceipt(evt);
  return {
    ok: !!out?.ok,
    accepted: !!out?.ok,
    advanced: !!out?.ok,
    type: 'team_output_receipt',
    ...(out || {}),
  };
}

export {
  isTeamOutputReceipt,
  handleTeamOutputReceipt,
};
