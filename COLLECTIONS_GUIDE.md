# Decompilations & Recompilations collections

Collections are **only** shown on the Decompilations & Recompilations category page. Other category pages, All, Recent and Search are unchanged.

1. Enable a collection in `data/collections.json` (name, slug, enabled, optional weight). Bloodborne is preconfigured.
2. For each project to group, add `"collection": "bloodborne"` to its entry in `data/games.json`. The value must match the collection **slug**, not the display name. Only entries whose category is exactly `decompilations-recompilations` will be grouped.
3. Run `preview` or `deploy` as usual. The collection appears only once at least one matching project is assigned. No projects have been automatically assigned.
4. In Preview Mode click **Copy filename** on the collection card; for Bloodborne it copies `bloodborne-collection`. Put its image in `static/Images/Games/bloodborne-collection.jpg` (also supports .webp, .jpeg, .png).
5. Collection page: `/collections/bloodborne/`. Individual project links and features remain intact.

A collection card has artwork, its collection name and a live project count; it does not have rating or AI-report controls. Individual projects are removed only from the decomp/recomp category grid and still appear on the collection page and elsewhere.

**Note:** Popular Picks remains based on individual project IDs. Category filters may hide collection cards when filtering for a specific platform, genre, date or AI status because collections don't have a single value for those attributes.
