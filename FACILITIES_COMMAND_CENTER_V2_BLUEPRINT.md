# Facilities Command Center V2 Blueprint

## Purpose

Facilities Command Center is a calm, capable, shared operations workspace for facilities management.

It is not meant to feel like cold maintenance software or a stressful dashboard. It should feel like a modern, organized operations desk: warm, useful, collaborative, and easy to return to when work is chaotic.

The app should help the facilities lead understand what needs attention, review incoming requests, connect files and vendors to work, and produce clear reports for leadership or the board.

---

## Product Feeling

### Core Emotional Goal

> I can handle this.

The app should make facilities work feel manageable, connected, and clear.

### Visual Direction

- Modern
- Calm
- Warm archival workspace
- Mid-century civic / institutional design
- More blue/green than brown
- Organized, spacious, and low-noise

### Palette Direction

- Deep navy blue
- Dusty teal
- Petroleum blue
- Muted sage
- Eucalyptus green
- Warm cream
- Soft brass / muted gold
- Soft charcoal text
- Muted rust only for urgent alerts

Avoid:

- harsh white
- neon colors
- bright red everywhere
- dense spreadsheet views as the default
- cluttered dashboards

---

## Core App Philosophy

### 1. Home is a daily rhythm space

The home screen should not be a panic wall.

It should answer:

> What is the rhythm of today?

Example:

```text
Good morning, Bee.

2 approvals waiting.
Kitchen walkthrough due today.
No urgent facility failures.
Fleet registration due Friday.
```

Then the user chooses where to work.

### 2. Navigation is workspace-based

The main experience should be large workspace cards, not tiny navigation links.

Primary workspaces:

1. Home
2. Review Queue
3. Projects
4. Maintenance
5. Fleet
6. Vendors & Bids
7. Files
8. Calendar
9. Reports
10. Settings

### 3. Calendar is a view, not a separate database

Calendar should display dated items from:

- Work Items
- Projects
- Maintenance
- Fleet
- Vendors & Bids
- Reports

Calendar records should not become a separate disconnected pile of data.

### 4. Files are supporting documents

Files support the work. They should not become the workflow.

Files should be attachable to:

- Work Items
- Projects
- Bids
- Vendors
- Fleet vehicles
- Reports

### 5. Submissions go to review first

Staff and office submissions should not automatically become live tasks.

They should enter a Review Queue where the facilities lead can:

- approve
- edit
- categorize
- assign
- link to a project/vendor/file/vehicle
- reject/archive

Urgent submissions should create a visible but contained alert.

---

## Main App Spaces

### 1. Home

Purpose:
A calm launch point.

Should include:

- Daily rhythm summary
- Subtle notification strip
- Workspace cards
- Important but contained alerts

Home should not show giant forms.

Workspace cards:

- Projects
- Maintenance
- Fleet
- Vendors & Bids
- Calendar
- Files
- Reports
- Review Queue

Each card should show:

- 1 to 2 key stats
- a small activity indicator
- any important "needs attention" signal

### 2. Review Queue

Purpose:
A holding area for new submissions, file imports, office requests, staff reports, and unusual issues.

Submissions should include:

- submitted by
- type
- urgency
- location
- notes
- files/photos if available
- date submitted
- source

Actions:

- Approve as Work Item
- Link to existing Project
- Assign to Maintenance
- Assign to Fleet
- Attach to Vendor/Bid
- Mark urgent
- Request more information
- Archive/reject

Urgent items should be visually contained but clear.

### 3. Projects

Purpose:
Track larger work such as remodels, repairs, upgrades, board asks, capital needs, and multi-step facility issues.

Project record fields:

- title
- status
- priority
- location
- target date
- estimated cost
- approved budget
- summary
- notes/history
- related work items
- related bids
- related vendors
- related files
- calendar dates

Workspace sections:

- Active
- Needs Approval
- Waiting on Vendor/Bid
- Scheduled
- Completed

### 4. Maintenance

Purpose:
Track routine and one-off facility work.

Maintenance should feel like a calm workspace, not a giant checklist.

Sections:

- Today
- This Week
- Recurring
- Review Queue
- Completed Recently

Task fields:

- title
- location
- status
- priority
- due date
- recurrence
- assigned person
- related project
- related files
- notes/history

Quick actions:

- Mark Complete
- Reschedule
- Assign
- Add Note
- Link File
- Move to Project

### 5. Fleet

Purpose:
Track vehicles, service schedules, mileage, repairs, registration, title/tags, warranty information, and fleet-related work.

Vehicle fields:

- vehicle name
- plate / ID
- mileage
- status
- registration due
- next service date
- warranty notes
- repair history
- related files
- related work items

Workspace sections:

- Vehicles Needing Attention
- Upcoming Service
- Registration / Tags Due
- Recent Repairs
- Fleet Files

### 6. Vendors & Bids

Purpose:
Track vendors, contractor estimates, bid comparisons, and board recommendations.

Bid fields:

- vendor / contractor
- related project
- amount
- status
- date received
- scope summary
- exclusions/concerns
- recommended yes/no
- related PDF/file
- related notes/history

Workspace sections:

- Awaiting Review
- Needs Approval
- Recommended
- Approved
- Rejected / Archived
- Vendor Follow-Up

Board comparison should show:

- lowest bid
- highest bid
- recommended bid
- total open bid value
- notes/concerns
- file links

### 7. Files

Purpose:
A calm library of supporting documents.

Files may include:

- contractor PDFs
- estimates
- invoices
- inspection reports
- Excel sheets
- maintenance checklists
- diagrams
- photos

File fields:

- file name
- type
- uploaded date
- source
- preview text if extracted
- related project
- related task/work item
- related vendor/bid
- related vehicle
- notes

Files should support:

- preview
- attach/link
- pull records
- archive

Do not show "imported on" as a main visible label unless troubleshooting.

### 8. Calendar

Purpose:
Visual rhythm of dated work.

Calendar should show:

- due maintenance
- scheduled inspections
- fleet service dates
- registration dates
- bid due dates
- vendor meetings
- project target dates
- report deadlines

Calendar should pull from other records rather than creating duplicate calendar-only items.

Views:

- Week
- Month
- List

### 9. Reports

Purpose:
Create readable summaries for leadership, board meetings, planning, and documentation.

Report types:

- Facilities Status Report
- Project Summary
- Bid Comparison Report
- Maintenance Calendar
- Fleet Status Report
- Needs Report
- Board Approval Packet

Reports should use existing data and attached files.

### 10. Settings

Purpose:
Manage app behavior without cluttering daily work.

Settings should include:

- workspace name
- sync status
- backup/export
- role/user settings later
- app maintenance
- reset local data

Do not put daily work controls in Settings.

---

## Staff Submission Portal

The submission portal should be separate from the main admin app.

It should feel friendly, guided, and not intimidating.

Opening prompt:

> What do you need help with?

Guided options:

- Building
- Kitchen / Equipment
- Vehicle
- Cleaning
- Safety
- Event Setup
- Vendor / Delivery
- Something unusual happened

The "Something unusual happened" option is required because facilities work is unpredictable.

Submission flow should collect:

- what happened
- where it happened
- how urgent it is
- optional photo/file
- contact name
- extra notes

Submission confirmation should be friendly:

```text
Saved - we'll take a look at it.
```

Not:

```text
Ticket submitted successfully.
```

---

## Notifications

Notification philosophy:

> Mostly quiet. Actionable only when necessary.

### Passive notifications

Use for:

- new submissions
- upcoming due dates
- normal reminders
- file uploads

Example:

```text
3 new maintenance submissions
```

### Interactive urgent alerts

Use for:

- freezer failure
- water leak
- vehicle breakdown
- safety issue
- blocked electrical/fire access
- urgent kitchen equipment failure

Urgent alert actions:

- Review
- Assign
- Call Vendor
- Mark In Progress
- Add Note

---

## Core Data Model

### Work Item

This is the primary operational record.

Fields:

- id
- title
- type
- status
- priority
- location
- due date
- assigned person
- submitted by
- source
- related project id
- related vehicle id
- related vendor id
- related file ids
- notes
- history
- created at
- updated at

### Project

Fields:

- id
- title
- status
- priority
- location
- target date
- estimated cost
- approved budget
- summary
- notes
- related work item ids
- related bid ids
- related file ids
- created at
- updated at

### Vendor / Bid

Fields:

- id
- vendor name
- related project id
- amount
- status
- date received
- scope summary
- recommendation notes
- file ids
- created at
- updated at

### Vehicle

Fields:

- id
- name
- plate/id
- mileage
- status
- next service date
- registration due date
- notes
- related work item ids
- file ids
- created at
- updated at

### File Record

Fields:

- id
- file name
- file type
- storage path / url
- extracted preview text
- related record ids
- notes
- created at
- updated at

### Submission

Fields:

- id
- submitter name
- submitter contact
- category
- urgency
- location
- description
- file ids
- status
- reviewed by
- converted record id
- created at
- updated at

---

## Interaction Pattern

### Browse

Main screens should show calm cards.

### Tap

Tap an item to open a detail panel or focused screen.

### Edit

Edit inside the detail view, not directly everywhere.

### Relate

Detail view should emphasize:

1. Status
2. Related ecosystem

Top of detail view:

- status
- priority
- due date
- quick actions

Middle:

- related files
- related tasks
- related project
- related vendor
- calendar dates
- board report links

Bottom:

- notes
- history
- activity

---

## V2 Build Strategy

### Recommended file structure

```text
index.html
portal.html
styles.css
app.js
supabase.js
import.js
reports.js
calendar.js
```

### Pages / entry points

- `index.html` = admin/facilities command center
- `portal.html` = staff/office guided submission portal

### Build phases

#### Phase 1: Clean app shell

- visual style
- home screen
- workspace cards
- navigation
- Supabase connection
- basic auth/session gate for cloud sync
- shared data load/save

#### Phase 2: Core records

- work items
- projects
- maintenance
- fleet
- vendors/bids
- files
- calendar view

#### Phase 3: Review Queue

- submissions table
- approve/edit/archive
- urgent alert behavior

#### Phase 4: Staff Portal

- guided submission flow
- simple friendly UI
- sends items to Review Queue

#### Phase 5: Files and imports

- file library
- PDF preview/extraction
- Excel preview
- pull records into review queue, not straight into live records

#### Phase 6: Reports

- board-ready summaries
- bid comparison packets
- needs reports
- fleet reports
- maintenance calendar reports

#### Phase 7: Roles/auth expansion

Later, add:

- admin
- staff
- office
- viewer

Do not build full role complexity before the V2 structure is stable.

---

## Senior Implementation Adjustment

The original blueprint put auth in Phase 7. That is right for full roles and permissions, but the current Supabase database now requires signed-in access after the RLS cleanup. Therefore:

- Basic Supabase session handling belongs in Phase 1.
- Role modeling still belongs later.
- The current app can continue local-first when signed out.
- Cloud sync should only run after sign-in.
- Future row-level policies should move from "any authenticated user" to workspace membership.

Recommended long-term access model:

```text
workspaces
  -> workspace_memberships
  -> users / profiles
  -> facilities
  -> work_items
  -> projects
  -> vehicles
  -> vendors
  -> bids
  -> files
  -> submissions
```

The durable rule:

```text
Signed-in user can read/write a record only if they belong to that record's workspace.
```

---

## Current Decision Log

- Home should focus on daily rhythm, not a panic dashboard.
- Main navigation should use large workspace cards.
- Workspaces should use a hybrid of small tabs and vertical card sections.
- Items should open into detail/focus view before editing.
- Calendar is a view of dated records, not separate data.
- Submissions should go to Review Queue first.
- File and spreadsheet imports should also stage in Review Queue before becoming live records.
- Urgent submissions should create contained alerts.
- Staff portal should be guided and friendly.
- The app should feel modern, calm, capable, and warm.
- Visual style should lean blue/green mid-century archival workspace.
- Files should support records, not become the main workflow.
- Visible "imported on" labels should be removed from normal UI.
- Basic auth is now required for cloud sync because Supabase RLS has been hardened.
- Import Center is a utility behind Review Queue/Files, not a primary workspace tab.
- Calendar and Files are primary workspaces in the app shell.
