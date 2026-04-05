#!/usr/bin/env python3
import json
from pathlib import Path
from urllib.parse import urljoin
from jsonschema import Draft202012Validator, RefResolver

ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = ROOT / 'schemas'
FIXTURES = ROOT / 'fixtures' / 'public-contracts'

PAIRS = [
    ('completion-envelope.schema.json', 'completion-envelope.fixture.json'),
    ('dashboard-workbench-payload.schema.json', 'dashboard-workbench-payload.fixture.json'),
    ('dashboard-resident-registry.schema.json', 'dashboard-resident-registry.fixture.json'),
    ('dashboard-summary-payload.schema.json', 'dashboard-summary-payload.fixture.json'),
    ('dashboard-pipeline-payload.schema.json', 'dashboard-pipeline-payload.fixture.json'),
    ('dashboard-control-payload.schema.json', 'dashboard-control-payload.fixture.json'),
    ('dashboard-board-payload.schema.json', 'derived/dashboard-board-payload.derived.fixture.json'),
    ('dashboard-dashboard-payload.schema.json', 'derived/dashboard-dashboard-payload.derived.fixture.json'),
    ('dashboard-nodes-payload.schema.json', 'derived/dashboard-nodes-payload.derived.fixture.json'),
    ('dashboard-threads-payload.schema.json', 'derived/dashboard-threads-payload.derived.fixture.json'),
    ('dashboard-thread-detail-payload.schema.json', 'derived/dashboard-thread-detail-payload.derived.fixture.json'),
    ('dashboard-summary-payload.schema.json', 'derived/dashboard-summary-payload.derived.fixture.json'),
    ('dashboard-workbench-payload.schema.json', 'derived/dashboard-workbench-payload.derived.fixture.json'),
    ('dashboard-pipeline-payload.schema.json', 'derived/dashboard-pipeline-payload.derived.fixture.json'),
    ('dashboard-control-payload.schema.json', 'derived/dashboard-control-payload.derived.fixture.json'),
    ('event-log.schema.json', 'event-log.fixture.json'),
    ('stream-log.schema.json', 'stream-log.fixture.json'),
    ('bridge-state.schema.json', 'bridge-state.fixture.json'),
    ('run-state.schema.json', 'run-state.fixture.json'),
    ('bridge-state.schema.json', 'real-run/bridge-state.real-run.fixture.json'),
    ('event-log.schema.json', 'real-run/event-log.real-run.fixture.json'),
    ('run-state.schema.json', 'real-run/run-state.real-run.fixture.json'),
    ('fixture-provenance.schema.json', 'real-run/fixture-provenance.json'),
    ('published-route-catalog.schema.json', 'published-route-catalog.fixture.json'),
]


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def build_store():
    store = {}
    for schema_path in SCHEMAS.glob('*.json'):
        schema = load_json(schema_path)
        file_uri = schema_path.resolve().as_uri()
        store[file_uri] = schema
        schema_id = schema.get('$id')
        if schema_id:
            store[schema_id] = schema
            store[urljoin(schema_id, schema_path.name)] = schema
    return store


store = build_store()
results = []
for schema_name, fixture_name in PAIRS:
    schema_path = SCHEMAS / schema_name
    fixture_path = FIXTURES / fixture_name
    schema = load_json(schema_path)
    fixture = load_json(fixture_path)
    resolver = RefResolver(base_uri=schema_path.resolve().as_uri(), referrer=schema, store=store)
    Draft202012Validator(schema, resolver=resolver).validate(fixture)
    results.append({
        'schema': schema_name,
        'fixture': fixture_name,
        'ok': True,
    })

print(json.dumps({
    'ok': True,
    'validatedCount': len(results),
    'results': results,
}, indent=2, ensure_ascii=False))
