# Modularization Phase 2 Status

Phase 2 moved the first real operational systems out of `app.js` while preserving the existing visual direction and workflows.

## Moved Into View Modules

### Work Orders

File: `views/work-orders.js`

Owns:

- work order list rendering
- archived work order list rendering
- work order cards and actions
- work order detail rendering
- mark complete
- status / priority / due date updates
- document link / unlink from work order
- archive / restore work order

### Documents

File: `views/documents.js`

Owns:

- document upload metadata flow
- Supabase Storage upload orchestration
- document list rendering
- linked document strips on related records
- document import target mapping

### Review Queue

File: `views/review-queue.js`

Owns:

- submitter request creation
- Review Queue rendering
- review detail rendering
- approve / archive review
- create normalized records from approved reviews
- submitter file attachment path through documents

### Today / Operational Heartbeat

File: `views/today-dashboard.js`

Owns:

- `TodayDashboard.render(app, helpers)`
- current Today dashboard rendering
- operational rhythm summary lines
- urgent and due-soon work summaries
- "needs attention today" logic
- calendar item collection
- calendar rendering

### Fleet / Fuel

File: `views/fleet.js`

Owns:

- `FleetWorkspace`
- vehicle payload creation
- fuel receipt payload creation
- vehicle add flow
- fuel receipt add flow with linked budget item creation
- fleet list rendering
- fuel receipt rendering
- reusable vehicle cards
- reusable vehicle detail helpers
- reusable vehicle alert cards
- service due calculations
- registration alert calculations
- fleet-related document lookup helpers

## Remaining `app.js` Responsibilities

`app.js` is now closer to an orchestrator. It still owns:

- boot lifecycle
- auth/session coordination
- shared runtime state
- Supabase data loading
- common role guards
- common edit modal
- remaining unextracted views
- event binding

## Next Modularization Targets

Recommended next extraction order:

1. `views/today-dashboard.js`
   - completed

2. `views/fleet.js`
   - completed

3. `views/projects-budget.js`
   - projects
   - bids
   - budget items
   - report packet helpers

4. `services/mappers.js`
   - `from*` row mappers
   - `to*Payload` payload builders

5. `services/import-review-service.js`
   - conversion logic for Review Queue
   - normalized record creation

## Verification

The architecture boundary test now checks that:

- Work Orders, Documents, and Review Queue have dedicated view files.
- Today Dashboard and Fleet have dedicated view files.
- `app.js` calls `TodayDashboard.render(app, createViewHelpers())`.
- `index.html` loads those files before `app.js`.
- major renderers are no longer implemented inside `app.js`.

The acceptance tests for role flow, work order hardening, and mobile usability still pass.
