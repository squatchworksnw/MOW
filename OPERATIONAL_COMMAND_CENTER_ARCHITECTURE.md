# Operational Command Center Architecture

This application is a unified Operations Command Center, not a collection of disconnected pages.

The product connects fleet, facilities, assets, projects, maintenance, vendors, documents, budget, reporting, inventory, compliance, and contractor workflows through shared operational records.

## Product Principle

The system should feel like a dignified operational workspace:

- calm
- spacious
- trustworthy
- emotionally intelligent
- operationally focused
- mobile-first
- low-friction in the field

This is not generic enterprise software. It should reduce cognitive load while preserving operational clarity.

## Connected Operational Model

Records should interconnect naturally through normalized relationships:

- projects
- work orders
- buildings
- spaces / rooms
- assets
- vehicles
- vendors
- documents
- budget items
- inventory / consumables
- compliance items
- review queue items

No major system should be treated as an isolated module. A document, vendor, vehicle, work order, project, or budget item should be able to support the others when the workflow calls for it.

## Core Workflow Pattern

Use review-before-conversion for incoming or extracted information.

1. Submitter, import, upload, or admin creates an intake item.
2. Intake item lands in Review Queue.
3. Owner/Admin reviews and fixes extracted fields.
4. Owner/Admin approves into normalized records.
5. Normalized records become part of the operational graph.
6. Documents, notes, history, budget, vendors, vehicles, assets, and projects remain linked.

Supabase remains the source of truth. Browser storage must not become the database.

## Architecture Priorities

1. Modularize frontend architecture.
2. Stabilize Supabase CRUD and RLS.
3. Build Today Mode operational heartbeat.
4. Expand Review Queue workflows.
5. Add Materials / Takeoff architecture.
6. Add Inventory and Consumables tracking.
7. Add Preventive Maintenance scheduling.
8. Add contractor-friendly submission flows.

## Current Modular Frontend Direction

The frontend should continue moving toward:

- `views/` for screen-level rendering and orchestration
- `components/` for reusable cards, forms, timeline, upload, and status UI
- `services/` for Supabase CRUD, storage, and normalized data access
- `state/` for local runtime state shape only
- `auth/` for session and role rules
- `sync/` for pending retry queue and offline write behavior
- `styles/tokens/` for design tokens and visual constants

Rendering and data logic should stay separate. Supabase access should stay isolated behind services.

## Role Model

Keep roles simple:

- Owner: full operational and workspace control
- Admin: operational control without ownership management
- Submitter: simple request/upload portal only

Role-aware UI must match Supabase RLS. Hidden UI is not security; RLS is.

## Near-Term Product Systems

### Today Mode

Today Mode should be the operational heartbeat. It should show:

- work due today
- urgent/high-priority work
- open review queue items
- fleet service concerns
- preventive maintenance due soon
- pending uploads or failed saves
- quick submit / quick note / quick complete actions

### Review Queue

Review Queue is a core operational system, not just an import list. It should handle:

- submitter requests
- uploaded PDFs
- uploaded spreadsheets
- gas receipts
- contractor bids
- maintenance notes
- inspection findings
- extracted document text
- field corrections before approval

### Materials / Takeoff

Materials and takeoff should connect to:

- projects
- work orders
- vendors
- budget items
- documents
- inventory

### Inventory / Consumables

Inventory should support:

- item name
- category
- quantity on hand
- reorder point
- storage location
- vendor
- related asset/project/work order
- receipt/document links
- usage history

### Preventive Maintenance

Preventive maintenance should connect schedules to:

- buildings
- spaces
- assets
- vehicles
- vendors
- work orders
- documents
- compliance evidence

## Explicit Non-Priorities For Now

Do not begin these until core operational workflows are stable:

- GIS systems
- IoT integrations
- GPS tracking
- automation systems
- complex notifications
- advanced mapping

## Design Direction

Preserve the calm editorial layout system:

- warm surfaces
- spacious hierarchy
- clear cards
- mobile-first forms
- soft status feedback
- reduced alert popups
- scan-first operational summaries

Visual polish should support trust and comprehension. It should not distract from field work.
