# API Reference Guide

## Incident Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/incidents` | Fetch list of active incidents |
| `POST` | `/api/incidents` | Declare a new incident |
| `GET` | `/api/incidents/[id]` | Fetch aggregated single incident read model |
| `GET` | `/api/incidents/[id]/export` | Export incident summary as Markdown or JSON |
| `POST` | `/api/incidents/[id]/agora-token` | Generate RTC voice room authentication token |
| `POST` | `/api/incidents/[id]/facts/verify` | Confirm reported observations to verified facts |
| `POST` | `/api/incidents/[id]/hypotheses/verify` | Promote hypotheses to confirmed facts |
| `POST` | `/api/incidents/[id]/actions/update` | Update status of assigned action items |
| `POST` | `/api/incidents/[id]/conflicts/resolve` | Mark operational discrepancies resolved |
| `GET` | `/api/incidents/[id]/sla` | Check SLA deadline response status |
| `GET` | `/api/incidents/[id]/audit` | Retrieve historical audit log entries |
