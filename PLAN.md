# PostgreSQL Migration Plan - Comprehensive Implementation Guide

## Overview
**Hybrid approach**: Use PostgreSQL for bulk data operations while leveraging Discogs API for search relevancy.

**Strategy**:
- **Search**: Discogs API - leverages their relevancy algorithm and returns images
- **Releases/Details**: PostgreSQL - fast, no rate limits, handles bulk data

**Key insight**: Discogs IDs in search results match database IDs, enabling seamless handoff.

**Result**: 90%+ reduction in Discogs API calls while maintaining search quality and gaining massive performance improvements for data-heavy operations.

Your database is already populated with November 2025 Discogs data and properly indexed.

---

## Phase 1: Database Client Setup (15 min)

### 1.1 Install Dependencies
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

### 1.2 Update Environment Variables
Add to `.env.local`:
```bash
DATABASE_URL=postgresql://neondb_owner:npg_G6yP1OKsgZDQ@ep-twilight-tree-aeugxue5.c-2.us-east-2.aws.neon.tech/metadata_search?sslmode=require
```

### 1.3 Create Database Connection Module
**File**: `/lib/db.ts`
- Export singleton connection pool using Neon serverless driver
- Configure connection pooling for Vercel edge runtime
- Add error handling and retry logic

---

## Phase 2: Type Definitions (20 min)

### 2.1 Create Shared Types
**File**: `/lib/types.ts`

**Database Entity Types** (raw data from PostgreSQL):
- `DbArtist` - Maps to `artist` table (id, name, realname, profile, data_quality)
- `DbLabel` - Maps to `label` table (id, name, contact_info, profile, parent_id, parent_name, data_quality)
- `DbRelease` - Maps to `release` table (id, title, released, country, notes, master_id, status, data_quality)
- `DbTrack` - Maps to `release_track` table (id, release_id, sequence, position, title, duration)
- `DbTrackCredit` - Maps to `release_track_artist` where extra=true (artist_name, role, anv)

**API Response Types** (match current Discogs API format):
- `SearchResult` - Label/Artist search result
  ```typescript
  {
    id: number
    type: 'label' | 'artist'
    title: string  // from label.name or artist.name
    thumb: string  // from Discogs API
    cover_image: string  // from Discogs API
    resource_url: string  // e.g., "https://api.discogs.com/labels/281"
    uri: string  // e.g., "/label/281-Blue-Note"
    // Note: user_data, master_id, master_url can be omitted or set to defaults
  }
  ```
- `SearchResponse` - Search endpoint response (simple, no pagination)
  ```typescript
  {
    results: SearchResult[]  // All results in one response
  }
  ```
- `Release` - For label/artist releases
  ```typescript
  {
    id: number
    title: string
    catno: string  // from release_label.catno
    year: string  // from release.released
    format: string  // aggregated from release_format
    artists: Array<{
      id: number
      name: string
      anv?: string  // artist name variation
    }>
    labels: Array<{
      id: number
      name: string
      catno: string
    }>
    thumb?: string  // from Discogs API (optional)
    cover_image?: string  // from Discogs API (optional)
    formatVariants?: Release[]  // for deduplicated releases
  }
  ```
- `Track` - For release details
  ```typescript
  {
    position: string  // e.g., "A1", "1-1"
    title: string
    duration: string
    artists: string[]  // main track artists
    writers: string[]  // extracted from role field
    producers: string[]  // extracted from role field
  }
  ```
- `ReleaseDetails` - Full release with tracks
  ```typescript
  {
    id: number
    title: string
    released: string
    country: string
    artists: Array<{ id: number, name: string, anv?: string }>
    labels: Array<{ id: number, name: string, catno: string }>
    formats: Array<{ name: string, qty: string, descriptions?: string }>
    genres: string[]
    styles: string[]
    tracks: Track[]  // using Track type above
    thumb?: string  // from Discogs API
    images?: Array<{ uri: string, type: string }>  // from Discogs API
  }
  ```

---

## Phase 3: Query Functions (60 min)

**IMPORTANT NOTES**:
1. **No shadow_catno in database**: The `release` table does NOT have a `shadow_catno` column. Shadow catalog numbers are calculated in the application layer using the existing algorithm in [/app/api/discogs/label/[id]/releases/route.ts:75-97](app/api/discogs/label/[id]/releases/route.ts#L75-L97).
2. **No image tables**: Image tables (`artist_image`, `label_image`, `release_image`) have been deleted. All queries should NOT join to these tables. Images will be fetched from Discogs API in Phase 4.
3. **Deduplication in app**: Format variant deduplication happens in the application layer, NOT in SQL queries.

### 3.1 Label Search Query
**File**: `/lib/db/queries/labels.ts`
```typescript
export async function searchLabels(query: string): Promise<DbLabel[]>
```

**Query Requirements**:
- Use `pg_trgm` fuzzy matching with `similarity()` function
- Combine ILIKE for broad matching with similarity scoring for ranking
- Join with `release_label` to count releases: `LEFT JOIN release_label rl ON l.id = rl.label_id`
- Return fields: id, name, contact_info, profile, parent_id, parent_name, data_quality, release_count
- WHERE clause: `l.name ILIKE '%' || query || '%' OR similarity(l.name, query) > 0.3`
- Order by:
  1. Exact match first: `CASE WHEN LOWER(l.name) = LOWER(query) THEN 0 ELSE 1 END`
  2. Similarity score DESC: `similarity(l.name, query) DESC`
  3. Release count DESC: `COUNT(rl.release_id) DESC`
  4. Name alphabetically: `l.name ASC`
- **Return ALL results** (no pagination - return everything in one response)
- Limit to reasonable max: `LIMIT 100` to prevent excessive results
- Port base logic from `/data/queries/label_search.sql` but add similarity scoring

### 3.2 Artist Search Query
**File**: `/lib/db/queries/artists.ts`
```typescript
export async function searchArtists(query: string): Promise<DbArtist[]>
```

**Query Requirements**:
- Use `pg_trgm` fuzzy matching with `similarity()` function
- Search both artist name and name variations
- Join with `artist_namevariation` to include alternate names: `LEFT JOIN artist_namevariation av ON a.id = av.artist_id`
- Join with `release_artist` to count releases: `LEFT JOIN release_artist ra ON a.id = ra.artist_id`
- Return fields: id, name, realname, profile, data_quality, release_count
- WHERE clause: `a.name ILIKE '%' || query || '%' OR av.name ILIKE '%' || query || '%' OR similarity(a.name, query) > 0.3`
- Order by:
  1. Exact match first: `CASE WHEN LOWER(a.name) = LOWER(query) THEN 0 ELSE 1 END`
  2. Similarity score DESC: `similarity(a.name, query) DESC`
  3. Release count DESC: `COUNT(DISTINCT ra.release_id) DESC`
  4. Name alphabetically: `a.name ASC`
- **Return ALL results** (no pagination)
- Limit to reasonable max: `LIMIT 100`

### 3.3 Label Releases Query
**File**: `/lib/db/queries/labels.ts`
```typescript
export async function getLabelReleases(labelId: number, page?: number, perPage?: number)
```
**Critical Requirements**:
- Join: `release` → `release_label` → `release_artist` → `artist`
- Join: `release_format` for format display
- **Sort by `catno` from `release_label` table** - shadow_catno will be calculated in app for deduplication
- **Return all releases with their catno** - deduplication by shadow_catno happens in app layer (NOT in query)
- Include all necessary data for app-level deduplication: release_id, catno, format, artist names
- Aggregate artist names with proper ANV (artist name variation) handling
- **DO NOT join to image tables** (deleted - images come from Discogs API)

### 3.4 Artist Releases Query
**File**: `/lib/db/queries/artists.ts`
```typescript
export async function getArtistReleases(artistId: number)
```
- Similar structure to label releases
- Deduplicate by title instead of shadow_catno (per existing logic)

### 3.5 Release Details Query
**File**: `/lib/db/queries/releases.ts`
```typescript
export async function getReleaseDetails(releaseId: number)
```
**Critical Requirements**:
- Join all related tables: artists, labels, formats, genres, styles
- Aggregate all release metadata into arrays (artist_ids, artist_names, label_names, catnos, format_names, genres, styles)
- Use `COALESCE(release_artist.anv, artist.name)` for artist names
- Returns release metadata only (no tracks) - matches `DbReleaseWithTracks` type
- **DO NOT join to image tables** (deleted - images come from Discogs API)

**Track credits extraction** (deferred - see "Next Steps"):
- Current implementation returns release metadata only
- Future: Add `getReleaseTracks(releaseId)` function for track-level data
- Track credits will use SQL exact role matching:
  - **Writers**: `role IN ('Written By', 'Written-By', 'Composer', 'Music By')`
  - **Producers**: `role IN ('Producer', 'Produced By', 'Executive Producer')`
- This replaces JavaScript substring matching from `/app/api/discogs/release/[id]/route.ts:34-40`:
  - **Old approach**: `role.toLowerCase().includes('written')` (case-insensitive substring)
  - **New approach**: `role IN (...)` (case-sensitive exact match)
- Preserve exact track position format (A1, 1-1, etc.) from `release_track.position` column

---

## Phase 4: Replace API Routes (90 min)

### 4.1 Search Endpoint
**File**: `/app/api/discogs/search/route.ts`
- **HYBRID APPROACH**: Keep using Discogs API for search to leverage their relevancy sorting
- Returns Discogs search results directly (with their IDs, images, and metadata)
- **Key insight**: Discogs IDs in search results match database IDs
- Subsequent endpoints (releases, details) use database with these IDs
- Rate limiter still used but only for search queries (much lower volume)
- Benefits:
  - ✅ Proper relevancy ranking from Discogs
  - ✅ Images included in search results
  - ✅ No need to replicate Discogs' search algorithm
  - ✅ Minimal API usage (only search, not bulk data fetching)

### 4.2 Label Releases Endpoint
**File**: `/app/api/discogs/label/[id]/releases/route.ts`
- Replace Discogs API call with `getLabelReleases()`
- **KEEP shadow catalog number generation function** - still needed for sorting and deduplication
- **KEEP deduplication algorithm** - still performed in app after fetching from database
- Keep exact response format with `formatVariants[]`
- Verify sorting matches existing behavior
- **Image fetching deferred**: See "Next Steps" section below

### 4.3 Release Details Endpoint
**File**: `/app/api/discogs/release/[id]/route.ts`
- Replace Discogs API call with `getReleaseDetails()`
- **Writer/producer filtering**: Moved from JavaScript substring matching to SQL exact role matching in query
  - **Before**: `role.toLowerCase().includes('written')` in JavaScript (lines 34-40)
  - **After**: SQL exact match using `IN` clause for known role values
  - See Phase 3.5 notes for details on role extraction logic
- Keep exact response format with `processedTracks[]`
- Verify all credit extraction works correctly
- **Image fetching deferred**: See "Next Steps" section below

### 4.4 Artist Endpoints
**File**: `/app/api/discogs/artist/[id]/route.ts`
- Replace Discogs API call with database query using `searchArtists()` (Phase 3.2)
- Return artist details with profile, realname, release count
- **Image fetching deferred**: See "Next Steps" section below

**File**: `/app/api/discogs/artist/[id]/releases/route.ts`
- Replace Discogs API call with `getArtistReleases()` (Phase 3.4)
- **KEEP title-based deduplication algorithm** - different from label releases
- Keep exact response format with `formatVariants[]`
- Verify chronological sorting by release date

**Note**: Artist search is currently disabled in UI via `{false &&}` wrapper in [app/page.tsx:131-136](app/page.tsx#L131-L136). Backend implementation will be complete and ready to enable.

---

## Phase 5: Clean Up and Configuration (10 min)

### 5.1 Rate Limiter Decision
**DECISION**: Hybrid approach - keep rate limiter for search endpoint
- **KEEP `/lib/discogs-rate-limiter.ts`** - actively used for search queries
- Much lower volume than before (only search, not all data fetching)
- Significantly reduces rate limit pressure (90%+ reduction in API calls)
- Future: May also be used for image fetching if implemented

### 5.2 Update Environment
- **KEEP `DISCOGS_TOKEN`** - required for search endpoint
- Add comment in `.env.example` explaining hybrid approach:
  - PostgreSQL is primary data source for releases, tracks, details
  - Discogs API used only for search (leveraging their relevancy algorithm)
- Document that `DATABASE_URL` is now the critical configuration variable

---

## Phase 6: Testing & Validation (45 min)

### 6.1 Data Integrity Tests
- [ ] Search "Blue Note" - verify fuzzy matching works
- [ ] Get Blue Note label releases - verify shadow_catno sorting
- [ ] Check format variants grouped correctly (Vinyl vs CD vs Digital)
- [ ] Get release details - verify writers/composers extracted
- [ ] Compare responses to old Discogs API responses (structure)

### 6.2 Performance Tests
- [ ] Label search < 100ms response time
- [ ] Label releases < 500ms (even for large catalogs)
- [ ] Release details < 200ms with all tracks
- [ ] No rate limit errors (should be gone)

### 6.3 UI Integration Tests
- [ ] Search form works identically
- [ ] Releases display with correct artwork
- [ ] Track expansion shows credits
- [ ] Export to Excel works with new data
- [ ] Search history persists correctly

### 6.4 Edge Cases
- [ ] Labels with 1000+ releases (pagination)
- [ ] Releases with 50+ tracks
- [ ] Tracks with multiple writers
- [ ] Missing data (no writers, no images)
- [ ] Special characters in catalog numbers

---

## Phase 7: Documentation & Deployment (15 min)

### 7.1 Update CLAUDE.md
- Document PostgreSQL as primary data source
- Update architecture diagrams
- Remove rate limiting documentation
- Add database connection details
- Update "Data Flow" section

### 7.2 Vercel Deployment
- Add `DATABASE_URL` to Vercel environment variables
- Ensure Neon serverless driver works in edge runtime
- Test cold start performance
- Monitor connection pooling

---

## Next Steps / Future Enhancements

### Image Loading for Releases
**Status**: Deferred (search results already have images via Discogs API)

**Current state**:
- ✅ Search results include images (via Discogs API in Phase 4.1)
- ❌ Release listings don't have images (database only)
- ❌ Release detail pages don't have images (database only)

**Implementation approach** (if desired):
- Fetch images from Discogs API for releases and release details
- Use existing rate limiter (`/lib/discogs-rate-limiter.ts`)
- Batch image fetching to minimize API calls (top 20-30 results)
- Endpoints to modify:
  - `/app/api/discogs/label/[id]/releases/route.ts` - Add thumbnail fetching
  - `/app/api/discogs/release/[id]/route.ts` - Add cover image fetching
- API calls needed:
  - `https://api.discogs.com/releases/{id}` - Extract release images

**Note**: Search images are already handled by hybrid approach

### Enable Artist Search in UI
**Status**: Backend complete, UI disabled

**Implementation**:
- Edit [app/page.tsx:131](app/page.tsx#L131)
- Change `{false &&` to `{true &&` to enable artist search tab
- Verify artist search and releases work correctly with database backend
- All query functions already implemented (Phase 3.2, 3.4)

### Track Details with Credits
**Status**: Release metadata complete, track extraction not yet implemented

**Implementation**:
- Add `getReleaseTracks(releaseId)` function to `/lib/db/queries/releases.ts`
- Query should:
  - Join `release_track` ← `release_track_artist` ← `artist`
  - Extract writers using: `role IN ('Written By', 'Written-By', 'Composer', 'Music By')`
  - Extract producers using: `role IN ('Producer', 'Produced By', 'Executive Producer')`
  - Return array of tracks with position, title, duration, and credit arrays
- Integrate into `/app/api/discogs/release/[id]/route.ts`

### Performance Optimizations
- Add database query caching with Redis or similar
- Implement pagination for large result sets
- Add indexes for frequently queried fields
- Monitor and optimize slow queries

### Additional Features
- Offline mode with cached search results
- Export additional formats (CSV, JSON, PDF)
- Advanced filtering by year, format, country
- Collaborative lists and sharing

---

## Critical Preservation Checklist

**Must preserve exactly**:
- ✅ Shadow catalog number sorting (calculate in app, then sort)
- ✅ Format variant deduplication (calculate shadow_catno in app, then deduplicate)
- ✅ Writer/composer extraction (filter `role` field in query)
- ✅ Track position format (use `position` column as-is)
- ✅ Artist name variations (use `COALESCE(anv, name)`)
- ✅ Response JSON structure (frontend depends on exact shape)
- ✅ Image URLs (fetch from Discogs API - image tables deleted)

---

## Database Schema Reference

**Key Tables**:
- `artist` (3 related tables) - **NO images table**
- `label` (1 related table) - **NO images table**
- `release` (9 related tables) - **NO shadow_catno column (calculated in app), NO images table**
- `release_track` - Track listings with position
- `release_track_artist` - Track-level credits with roles
- `release_label` - Release-to-label mapping with `catno`

**Key Indexes**:
- `label_pkey` - Primary key on label(id)
- `label_idx_parent_label` - Index on label(parent_id)
- `idx_label_name_trgm` - GIN index on label(name) for fuzzy search (to be created)
- `idx_artist_name_trgm` - GIN index on artist(name) for fuzzy search (to be created)
- `idx_release_label_label_id` - Index on release_label(label_id)
- `idx_release_label_shadow` - Index on release_label(label_id, release_id)
- `idx_release_track_release_seq` - Index on release_track(release_id, sequence)
- `idx_release_track_artist_track` - Index on release_track_artist(release_id, track_sequence)

**Extensions Required**:
- `pg_trgm` - Trigram matching for fuzzy text search

---

## File Creation Summary

**New Files** (6):
1. `/lib/db.ts` - Database connection
2. `/lib/types.ts` - TypeScript definitions
3. `/lib/db/queries/labels.ts` - Label queries
4. `/lib/db/queries/artists.ts` - Artist queries
5. `/lib/db/queries/releases.ts` - Release queries
6. `/drizzle.config.ts` - Drizzle configuration (optional)

**Modified Files** (3-5):
1. `/app/api/discogs/search/route.ts`
2. `/app/api/discogs/label/[id]/releases/route.ts`
3. `/app/api/discogs/release/[id]/route.ts`
4. `/app/api/discogs/artist/[id]/route.ts` (if artist search enabled)
5. `/app/api/discogs/artist/[id]/releases/route.ts` (if artist search enabled)

**Deleted Files**: None (rate limiter kept for image fetching)

**Configuration Files** (2):
1. `.env.local` - Add `DATABASE_URL`
2. `CLAUDE.md` - Update documentation

---

## Total Estimated Time: ~4 hours

- Phase 1: 15 min
- Phase 2: 20 min
- Phase 3: 60 min
- Phase 4: 90 min
- Phase 5: 10 min
- Phase 6: 45 min
- Phase 7: 15 min

---

## Success Criteria

✅ All API endpoints return same response structure
✅ No Discogs API rate limit errors
✅ Sub-100ms search response times
✅ Export to Excel works identically
✅ All existing UI functionality preserved
✅ Zero frontend code changes required
✅ Database queries properly indexed and optimized
