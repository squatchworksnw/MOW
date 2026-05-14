# Supabase CRUD + RLS Audit

This audit defines the Phase 1 trust foundation expectations for Supabase.

Supabase is the source of truth. The frontend may simplify or hide actions by role, but Supabase RLS must enforce the real permission boundary.

## Role Contract

### Owner

- Can read all workspace operational records.
- Can create, update, archive, and restore operational records.
- Can manage workspace settings.
- Can manage memberships and roles later.

### Admin

- Can read operational records in assigned workspaces.
- Can create, update, archive, and restore operational records.
- Can review and approve submitted/imported items.
- Cannot manage ownership or workspace ownership settings.

### Submitter

- Can create requests through `field_ops_import_reviews`.
- Can upload supporting files through `field_ops_documents`.
- Can read their own submitted/relevant items where policies allow it.
- Cannot read full operational admin surfaces such as work orders, budget, vendors, vehicles, reports, archive controls, or settings.

## Tables Currently Used By The Frontend

| Table | Read | Create | Update | Archive/Restore | Submitter |
|---|---:|---:|---:|---:|---|
| `field_ops_my_workspaces` | Owner/Admin/Submitter own memberships | No direct frontend create | No | No | Read own workspace role |
| `field_ops_workspaces` | Owner/Admin/Submitter assigned | Owner only | Owner only | No | No settings access |
| `field_ops_buildings` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No |
| `field_ops_spaces` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No |
| `field_ops_assets` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No |
| `field_ops_projects` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No |
| `field_ops_vendors` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No |
| `field_ops_vehicles` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No |
| `field_ops_fuel_receipts` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | Submit via Review Queue later |
| `field_ops_work_orders` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No direct access |
| `field_ops_budget_items` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin | No |
| `field_ops_documents` | Owner/Admin; submitter own/allowed uploads | Owner/Admin/Submitter | Owner/Admin | Owner/Admin | Create uploads only |
| `field_ops_import_reviews` | Owner/Admin; submitter own/allowed requests | Owner/Admin/Submitter | Owner/Admin | Owner/Admin | Create requests only |
| `field_ops_vehicle_alerts` | Owner/Admin | View only | View only | View only | No |

## Frontend CRUD Boundary

All direct Supabase row operations should flow through:

- `services/supabase-service.js`
- `auth/session.js`
- `sync/pending-queue.js`

`app.js` should orchestrate workflows, not own low-level Supabase access.

Current service responsibilities:

- active and archived workspace reads
- vehicle alert reads
- insert/update/archive/restore row operations
- document metadata insert
- Supabase Storage upload
- session load/sign-in/sign-out/workspace load
- pending retry queue execution

## RLS Verification Checklist

Use Supabase SQL editor or dashboard policy view to verify:

- RLS is enabled on every `field_ops_*` table used by the frontend.
- Every operational table is scoped by `workspace_id`.
- Owners/Admins can read/write only records in workspaces where they have membership.
- Submitters cannot read or mutate admin operational tables directly.
- Submitters can create only `field_ops_import_reviews` and `field_ops_documents`.
- Archive is implemented as `archived_at`, not hard delete.
- Restore clears `archived_at` and `archived_by`.
- Policies do not depend on row numbers or client-side filtering.
- Storage bucket policies match document table permissions.

## Trust Gaps To Close Next

1. Add or verify `field_ops_audit_log` writes for:
   - status changes
   - archive / restore
   - review approval / rejection
   - document link / unlink
   - role-sensitive updates

2. Confirm Submitter ownership tracking on:
   - `field_ops_import_reviews`
   - `field_ops_documents`

3. Confirm storage policies prevent Submitters from reading unrelated files.

4. Add SQL policy snapshots or migration files once the database shape is stable.

5. Add a small Supabase verification script or checklist-runner once service-role access is available in the development environment.

## Current Decision

Do not add Phase 2+ systems until this trust foundation is boring and dependable.
