# Field Operations App Architecture

## Product Direction

This app is now moving from a local facilities tracker toward a secure, mobile-first field operations app for facilities management and general contracting.

Supabase is the source of truth. Browser local storage can be used only as a temporary cache or offline convenience, not as the primary database.

## Primary Workspaces

- Today
- Work Orders
- Projects
- Buildings
- Spaces / Rooms
- Assets
- Vehicles
- Fuel Receipts
- Vendors / Subcontractors
- Money / Budget
- Documents
- Import Review
- Reports
- Settings

## Supabase Foundation

The new production path uses the `field_ops_*` tables:

- `field_ops_workspaces`
- `field_ops_memberships`
- `field_ops_buildings`
- `field_ops_spaces`
- `field_ops_assets`
- `field_ops_projects`
- `field_ops_vendors`
- `field_ops_vehicles`
- `field_ops_fuel_receipts`
- `field_ops_work_orders`
- `field_ops_budget_items`
- `field_ops_documents`
- `field_ops_import_reviews`
- `field_ops_audit_log`

All new tables have RLS enabled and are scoped by workspace membership.

Seeded workspace:

- Name: `MOW Field Operations`
- Slug: `mow-field-ops`
- Initial admin user: `test@example.com`

## Storage

The Supabase Storage bucket `documents` is private.

Document paths should start with the workspace id:

```text
{workspace_id}/{document_id}/{filename}
```

Storage policies allow signed-in workspace members to access only objects for workspaces they belong to.

## Record Safety

Records should be archived by setting `archived_at` and `archived_by`.

Hard deletes should be rare, manager-only, and confirmed. Important changes should be written to `field_ops_audit_log` as the app matures.

Backend hardening now includes:

- automatic `updated_at` triggers on normalized `field_ops_*` records
- audit triggers for insert/update/delete on core operational records
- human-readable work order numbers like `WO-2026-000001`
- a read-only `field_ops_vehicle_alerts` view for Today/fleet alerts

## Import Rule

PDF, Excel, and CSV extraction must not write directly into operational tables.

Fuel receipts link to vehicles, optional vendors, receipt documents, and budget items. They should appear in vehicle history alongside service and work-order records.

Extracted data goes to `field_ops_import_reviews` first. A user reviews and approves it before creating a:

- work order
- budget item
- vendor
- vehicle
- fuel receipt
- project
- asset
- building
- space

## Next Frontend Step

Replace the current legacy local-first save/load layer with Supabase CRUD against the `field_ops_*` tables, starting with:

1. Workspace bootstrap after login.
2. Today query.
3. Work orders.
4. Vehicles.
5. Fuel receipts linked to vehicles and budget.
6. Documents upload to private Storage.
7. Import Review approval flow.
