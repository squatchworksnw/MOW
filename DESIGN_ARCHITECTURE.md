# Field Operations Design Architecture

This app is a secure, mobile-first field operations workspace for facilities management and general contracting. It is not a generic facilities dashboard, startup SaaS surface, spreadsheet clone, or crowded admin panel.

Supabase is the source of truth. Data safety, role-based access, sync correctness, safe imports, safe archiving, mobile usability, and real operational workflows come before decoration.

## Product Truth

The app should feel like a dignified digital desk: calm, warm, operationally trustworthy, emotionally intelligent, and handcrafted. It should help people feel organized, supported, capable, calm, and respected.

The software exists to reduce operational stress and create clarity for facilities, fleet, maintenance, inspections, vendors, kitchens, logistics, documents, projects, uploads, work orders, inventory, fuel receipts, reporting, and scheduling.

## Functional Priorities

- Login and workspace loading.
- Supabase-backed normalized records.
- Owner, Admin, and Submitter permissions enforced with RLS.
- Work orders linked to buildings, spaces, assets, vehicles, vendors, and projects.
- Documents uploaded to Supabase Storage and staged through Import Review when extracted.
- Fuel receipts linked to vehicles, documents, and budget items.
- Import Review before extracted data becomes live operational data.
- Archive records with `archived_at` and `archived_by`; normal app actions should not hard delete.
- Audit logging for important changes.
- Local-first resilience and offline queueing should be added only in ways that preserve Supabase as the source of truth.
- Browser storage may hold a temporary pending-write retry queue. It must not become the primary database, and queued work must be clearly labeled as pending until Supabase accepts it.

## Access Model

Use only three roles:

- Owner: full workspace control, including users, roles, settings, budget, imports, documents, vehicles, vendors, work orders, archive actions, and reports.
- Admin: trusted daily operations, including work orders, buildings, spaces, assets, vehicles, vendors, documents, fuel receipts, reports, and import review. Admins cannot remove the owner or transfer ownership.
- Submitter: staff, contractors, drivers, volunteers, or outside users who submit requests, photos, documents, and receipts and view their own submissions.

Frontend hiding is not enough. Supabase RLS is the source of truth for permissions.

## Experience Principles

- Calm before density.
- Reliability before delight.
- Hierarchy before volume.
- Cards before tables for field workflows.
- Review before conversion.
- One clear interaction at a time.
- Illustrations support comprehension and emotional grounding; they do not become the product.

Avoid alert fatigue, excessive motion, noisy notifications, overcrowded interfaces, dense data walls, glossy startup SaaS styling, gamer UI, cyberpunk aesthetics, harsh contrast, overly modern minimalism, and generic enterprise admin dashboard patterns.

## Visual Direction

- Mid-century editorial illustration.
- Atomic-age operational graphics.
- Warm paper-like UI surfaces.
- Spacious layouts.
- Rounded cards.
- Muted teal, navy, sage, brass, and restrained rust/coral.
- Soft shadows.
- Editorial spacing rhythm.
- Subtle texture.
- Decorative geometry used as quiet anchors.

The interface should behave like an operational atlas, calm mission-control workspace, curated operations studio, and field notebook.

## Modular Card System

The UI should rely on reusable editorial cards with:

- Clear title, status, and primary action.
- A short metadata stack.
- Tags for state and relationships.
- Optional small illustration zone.
- Optional asymmetrical decorative geometry.
- Enough breathing room for mobile scanning.

Avoid nested cards and dense widget clusters. If a card becomes too complex, move the user into a detail view.

## Illustration System

Illustrations should support understanding, reduce intimidation, and add quiet delight. Prefer isolated reusable assets, small interactions, editorial placement, and subtle discoveries.

Good moments:

- Empty states.
- Loading states.
- Onboarding.
- Import Review.
- Confirmations.
- Sync/status areas.
- Gentle operational guidance.

Avoid giant cinematic scenes, crowded compositions, over-rendered storytelling art, floating props, impossible poses, extra limbs, and anthropomorphic arm anatomy.

## Mascot System

The Caretaker Bird and Buzzy the Bee are operational companions integrated into the design language. They support emotional grounding, stewardship, reduced operational stress, discoverable moments, and workflow comprehension.

They are not loud mascots, cartoon performers, primary content, or decorative clutter.

Strongest composition rule:

- One bird.
- One bee.
- One task.
- One clear interaction.
- Lots of breathing room.

### Bird Anatomy

- Two wings.
- Two legs.
- Two feet/claws.
- Believable posture and balance.
- Wings stabilize, balance, brace, or fly.
- Wings are not hands.
- Feet/claws perform gripping and carrying.

### Bee Anatomy

- Six legs.
- Two wings.
- Two antennae.
- Believable insect posture.
- The bee assists with stabilization, tiny detail work, support interactions, and collaborative carrying.

### Teamwork Rule

If the bird cannot logically stabilize or carry something alone, the bee assists. This collaboration logic is central to the emotional tone of the product.

Example moments:

- Bee sleeping near sync status.
- Bird inspecting an HVAC panel.
- Bee helping tape a blueprint.
- Bird carrying a clipboard with claws.
- Bee carrying a tiny screw.
- Bird perched beside completed tasks.

## Layout Rules

- Today answers the rhythm of the day, not a panic wall.
- Primary sections stay modular: Today, Work Orders, Projects, Buildings, Spaces, Assets, Vehicles, Fuel Receipts, Vendors, Money, Documents, Import Review, Reports, Settings.
- Empty states reserve space for a small illustration or mascot moment.
- Forms remain readable on iPhone-sized screens with clear labels and large tap targets.
- Tables are acceptable for exports or dense review; cards remain the default field workflow.
- Do not prioritize decoration before data safety, sync correctness, access control, mobile usability, and real Supabase-backed workflows.

## Consistency Checklist

Maintain consistency across:

- Icon stroke weight.
- Spacing rhythm.
- Typography hierarchy.
- Card density.
- Illustration scale.
- Texture usage.
- Decorative geometry.
- Shadow softness.
- Status language.
- Save/sync states.
