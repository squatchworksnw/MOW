# Operational Maturity Roadmap

The platform should mature in phases instead of expanding features randomly.

The product goal remains: reduce operational cognitive load while creating a calm, dependable, emotionally intelligent operational workspace.

## Roadmap Principle

Every new feature should answer:

1. Does this strengthen trust in the operational record?
2. Does this reduce field or admin cognitive load?
3. Does this connect to existing operational records?
4. Does this belong in the current maturity phase?

If the answer is no, defer it.

## Phase 1: Trust Foundation

Goal: make the system dependable before making it bigger.

Priority systems:

- Supabase stabilization
- RLS
- modular frontend architecture
- Review Queue workflows
- Import Review workflows
- archive systems
- audit/history systems
- document upload, preview, extraction, and linking
- clear pending/save/failure states
- Owner/Admin/Submitter permission clarity

Definition of done:

- Supabase is the source of truth.
- RLS matches the frontend role experience.
- Submitter cannot access admin surfaces.
- Owner/Admin can review, approve, archive, and recover records safely.
- Work orders have usable detail, documents, notes, and history.
- Documents can be linked to normalized operational records.
- Failed saves and offline/pending states are visible without panic.

## Phase 2: Operational Heartbeat

Goal: make daily work easier to understand and act on.

Priority systems:

- Today Mode
- workflow compression
- operational rhythm
- waiting / blocked systems
- due-today and due-soon views
- urgent/high-priority work surfacing
- quick complete, quick note, quick reschedule
- review queue attention prompts
- pending upload/save awareness

Definition of done:

- A user can open the app and immediately know what matters today.
- The system shows blocked/waiting work clearly.
- Field updates require minimal tapping.
- Today Mode connects work orders, reviews, fleet, documents, and maintenance instead of duplicating them.

## Phase 3: Contractor Systems

Goal: support general contractor workflows without turning the app into generic construction software.

Priority systems:

- materials
- takeoffs
- approvals
- estimates
- receipts
- vendor workflows
- bid/contract packet improvements
- project-to-budget-to-document linking
- contractor-friendly submission flows

Definition of done:

- A project can track materials, estimates, vendors, receipts, and approvals.
- Contractor uploads land in Review Queue before conversion.
- Budget items, documents, vendors, projects, and work orders remain linked.
- Estimates and receipts can be reviewed, corrected, and approved into normalized records.

## Phase 4: Preventive Maintenance And Inventory

Goal: move from reactive tracking to predictable stewardship.

Priority systems:

- recurring systems
- preventive maintenance schedules
- consumables
- inventory counts
- reorder thresholds
- replacement forecasting
- lifecycle management
- service intervals for assets and vehicles
- compliance evidence links

Definition of done:

- Assets and vehicles can generate recurring maintenance work.
- Inventory supports quantities, locations, vendors, reorder points, and usage history.
- Consumables can connect to work orders, projects, and budget items.
- Replacement forecasts help plan instead of surprise.

## Phase 5: Reporting And Nonprofit Operational Tools

Goal: turn operational truth into useful communication.

Priority systems:

- board reporting
- grant reporting
- volunteer systems
- impact summaries
- printable operational packets
- project summaries
- fleet/facility health summaries
- budget-to-impact reporting

Definition of done:

- Reports come from normalized Supabase records.
- Board-ready reports can be produced without manual spreadsheet cleanup.
- Grant and impact summaries connect facilities/fleet work to mission outcomes.
- Reports remain calm, legible, and trustworthy.

## Explicitly Deferred

Do not expand into these until core operational workflows are stable and trusted:

- GIS
- IoT
- GPS
- automation systems
- advanced mapping
- complex notification systems

These may be useful later, but they are not part of the current maturity path.

## Product Tone

The platform should remain:

- calm
- dependable
- spacious
- emotionally intelligent
- operationally focused
- respectful of field work

The product is a dignified operational workspace, not generic enterprise software.
