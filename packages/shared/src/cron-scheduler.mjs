export const CRON_EXPRESSION = {
  MINUTE: 'minute',
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
};

export function parseCronExpression(expression = '') {
  const parts = String(expression || '').trim().split(/\s+/);

  if (parts.length === 5) {
    return {
      minute: parts[0],
      hour: parts[1],
      dayOfMonth: parts[2],
      month: parts[3],
      dayOfWeek: parts[4],
    };
  }

  if (parts.length === 1) {
    const lower = parts[0].toLowerCase();
    if (lower === 'minutely' || lower === '* * * * *') {
      return { minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' };
    }
    if (lower === 'hourly' || lower === '0 * * * *') {
      return { minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' };
    }
    if (lower === 'daily' || lower === '0 0 * * *') {
      return { minute: '0', hour: '0', dayOfMonth: '*', month: '*', dayOfWeek: '*' };
    }
    if (lower === 'weekly' || lower === '0 0 * * 0') {
      return { minute: '0', hour: '0', dayOfMonth: '*', month: '*', dayOfWeek: '0' };
    }
  }

  return null;
}

export function matchesCron(now = new Date(), cron = {}) {
  const minute = cron.minute || '*';
  const hour = cron.hour || '*';
  const dayOfMonth = cron.dayOfMonth || '*';
  const month = cron.month || '*';
  const dayOfWeek = cron.dayOfWeek || '*';

  const current = {
    minute: now.getMinutes(),
    hour: now.getHours(),
    dayOfMonth: now.getDate(),
    month: now.getMonth() + 1,
    dayOfWeek: now.getDay(),
  };

  if (minute !== '*' && String(minute) !== String(current.minute)) return false;
  if (hour !== '*' && String(hour) !== String(current.hour)) return false;
  if (dayOfMonth !== '*' && String(dayOfMonth) !== String(current.dayOfMonth)) return false;
  if (month !== '*' && String(month) !== String(current.month)) return false;
  if (dayOfWeek !== '*' && String(dayOfWeek) !== String(current.dayOfWeek)) return false;

  return true;
}

export function createCronScheduler({ eventBus = null } = {}) {
  const jobs = new Map();
  let timer = null;
  let running = false;

  async function executeJob(job) {
    const startedAt = new Date().toISOString();
    job.lastRunAt = startedAt;
    job.runCount = (job.runCount || 0) + 1;

    try {
      const result = await job.task();
      job.lastResult = { ok: true, result, at: new Date().toISOString() };
      eventBus?.publish?.({
        type: 'cron.job.completed',
        payload: { jobId: job.id, result, runCount: job.runCount },
      });
      return result;
    } catch (error) {
      job.lastResult = { ok: false, error: error.message, at: new Date().toISOString() };
      job.errorCount = (job.errorCount || 0) + 1;
      eventBus?.publish?.({
        type: 'cron.job.failed',
        payload: { jobId: job.id, error: error.message, errorCount: job.errorCount },
      });
      return null;
    }
  }

  function tick() {
    const now = new Date();

    for (const [id, job] of jobs.entries()) {
      if (!job.enabled) continue;
      if (job.disabled) continue;
      if (job.nextRunAt && new Date(job.nextRunAt) > now) continue;

      if (matchesCron(now, job.cron)) {
        executeJob(job).then(() => {
          job.nextRunAt = calculateNextRun(now, job.cron);
        });
      }
    }
  }

  function calculateNextRun(now = new Date(), cron = {}) {
    const next = new Date(now);
    const minute = cron.minute || '*';
    const hour = cron.hour || '*';

    if (minute === '*') {
      next.setMinutes(next.getMinutes() + 1);
    } else if (minute === '0') {
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
    } else {
      next.setMinutes(parseInt(minute) + 1);
    }

    return next.toISOString();
  }

  function start() {
    if (running) return;
    running = true;
    timer = setInterval(tick, 60000);
    if (timer?.unref) timer.unref();
  }

  function stop() {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function addJob(id = '', task = () => {}, cron = {}) {
    const job = {
      id,
      task,
      cron,
      enabled: true,
      disabled: false,
      runCount: 0,
      errorCount: 0,
      lastRunAt: null,
      lastResult: null,
      nextRunAt: null,
      createdAt: new Date().toISOString(),
    };
    jobs.set(id, job);
    return job;
  }

  function removeJob(id = '') {
    return jobs.delete(id);
  }

  function enableJob(id = '') {
    const job = jobs.get(id);
    if (job) {
      job.enabled = true;
      return true;
    }
    return false;
  }

  function disableJob(id = '') {
    const job = jobs.get(id);
    if (job) {
      job.disabled = true;
      return true;
    }
    return false;
  }

  function listJobs() {
    return [...jobs.values()].map((j) => ({
      id: j.id,
      enabled: j.enabled,
      cron: j.cron,
      runCount: j.runCount,
      errorCount: j.errorCount,
      lastRunAt: j.lastRunAt,
      lastResult: j.lastResult?.ok ? 'ok' : j.lastResult?.error || null,
      nextRunAt: j.nextRunAt,
    }));
  }

  return {
    start,
    stop,
    addJob,
    removeJob,
    enableJob,
    disableJob,
    listJobs,
  };
}

export default {
  CRON_EXPRESSION,
  parseCronExpression,
  matchesCron,
  createCronScheduler,
};
