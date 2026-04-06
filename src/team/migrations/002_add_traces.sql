CREATE TABLE IF NOT EXISTS trace_spans (
  span_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_span_id TEXT NOT NULL DEFAULT '',
  op TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ok',
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL DEFAULT '',
  attributes_json TEXT NOT NULL DEFAULT '{}',
  events_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_started ON trace_spans(trace_id, started_at ASC);
CREATE INDEX IF NOT EXISTS idx_trace_spans_parent ON trace_spans(parent_span_id, started_at ASC);
CREATE INDEX IF NOT EXISTS idx_trace_spans_op ON trace_spans(op, started_at DESC);
