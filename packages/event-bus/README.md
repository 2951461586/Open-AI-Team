# @ai-team-harness/event-bus

Planned home for event transport, session signaling, pub/sub semantics, and cross-runtime coordination.

Expected responsibilities:
- event envelopes and contracts
- session/event propagation
- pub/sub adapters
- coordination messaging between runtime components

Migration note:
- extract shared messaging concerns here instead of burying them inside app/runtime packages
