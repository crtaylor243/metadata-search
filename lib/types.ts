// ============================================================================
// DATABASE ENTITY TYPES
// Raw data from PostgreSQL - maps directly to database tables
// ============================================================================

export interface DbArtist {
  id: number;
  name: string;
  realname: string | null;
  profile: string | null;
  data_quality: string | null;
  release_count?: number; // Computed field from JOIN with release_artist
}

export interface DbLabel {
  id: number;
  name: string;
  contact_info: string | null;
  profile: string | null;
  parent_id: number | null;
  parent_name: string | null;
  data_quality: string | null;
  release_count?: number; // Computed field from JOIN with release_label
}

export interface DbRelease {
  id: number;
  title: string;
  released: string | null;
  country: string | null;
  notes: string | null;
  master_id: number | null;
  status: string | null;
  data_quality: string | null;
}

export interface DbTrack {
  id: number;
  release_id: number;
  sequence: number;
  position: string | null;
  title: string | null;
  duration: string | null;
  track_id: string | null;
  parent: string | null;
}

export interface DbTrackCredit {
  artist_name: string | null;
  role: string | null;
  anv: string | null; // Artist name variation
}

export interface DbReleaseArtist {
  release_id: number;
  artist_id: number | null;
  artist_name: string | null;
  anv: string | null;
  position: number | null;
  join_string: string | null;
  role: string | null;
  tracks: string | null;
  extra: number; // 0 or 1 in database (boolean)
}

export interface DbReleaseLabel {
  id: number;
  release_id: number;
  label_id: number | null;
  label_name: string;
  catno: string | null;
}

export interface DbReleaseFormat {
  id: number;
  release_id: number;
  name: string | null;
  qty: number | null;
  text_string: string | null;
  descriptions: string | null;
}

export interface DbReleaseGenre {
  id: number;
  release_id: number;
  genre: string | null;
}

export interface DbReleaseStyle {
  release_id: number;
  style: string | null;
}

export interface DbReleaseTrackArtist {
  id: number;
  track_id: string | null;
  release_id: number;
  track_sequence: string | null;
  artist_id: number | null;
  artist_name: string | null;
  extra: boolean;
  anv: string | null;
  position: number | null;
  join_string: string | null;
  role: string | null;
  tracks: string | null;
}

// ============================================================================
// API RESPONSE TYPES
// Match current Discogs API format for frontend compatibility
// ============================================================================

export interface SearchResult {
  id: number;
  type: 'label' | 'artist';
  title: string; // from label.name or artist.name
  thumb: string; // from Discogs API
  cover_image: string; // from Discogs API
  resource_url: string; // e.g., "https://api.discogs.com/labels/281"
  uri: string; // e.g., "/label/281-Blue-Note"
  // Optional fields that can be omitted or set to defaults
  user_data?: {
    in_wantlist: boolean;
    in_collection: boolean;
  };
  master_id?: number | null;
  master_url?: string | null;
}

export interface SearchResponse {
  results: SearchResult[]; // All results in one response (no pagination)
}

export interface ReleaseArtist {
  id: number;
  name: string;
  anv?: string; // Artist name variation
  join?: string; // Join string (e.g., "&", "featuring")
  role?: string;
  tracks?: string;
}

export interface ReleaseLabel {
  id: number;
  name: string;
  catno: string;
}

export interface ReleaseFormat {
  name: string;
  qty: string;
  descriptions?: string;
  text?: string;
}

export interface Release {
  id: number;
  title: string;
  catno: string; // from release_label.catno
  year: string; // from release.released
  format: string; // aggregated from release_format
  artists: ReleaseArtist[];
  labels: ReleaseLabel[];
  thumb?: string; // from Discogs API (optional)
  cover_image?: string; // from Discogs API (optional)
  formatVariants?: Release[]; // for deduplicated releases
  // Additional fields that might be needed
  country?: string;
  released?: string;
  resource_url?: string;
  uri?: string;
  status?: string;
  genres?: string[];
  styles?: string[];
}

export interface Track {
  position: string; // e.g., "A1", "1-1"
  title: string;
  duration: string;
  artists: string[]; // main track artists
  writers: string[]; // extracted from role field
  producers: string[]; // extracted from role field
  // Optional fields
  type_?: string; // track type
  extraartists?: Array<{
    name: string;
    role: string;
    anv?: string;
  }>;
}

export interface ReleaseImage {
  uri: string;
  type: string;
  resource_url?: string;
  uri150?: string;
  width?: number;
  height?: number;
}

export interface ReleaseDetails {
  id: number;
  title: string;
  released: string;
  country: string;
  artists: ReleaseArtist[];
  labels: ReleaseLabel[];
  formats: ReleaseFormat[];
  genres: string[];
  styles: string[];
  tracks: Track[]; // Using Track type above
  thumb?: string; // from Discogs API
  images?: ReleaseImage[]; // from Discogs API
  // Additional fields
  year?: number;
  resource_url?: string;
  uri?: string;
  master_id?: number | null;
  master_url?: string | null;
  notes?: string;
  data_quality?: string;
  status?: string;
}

// Helper types for API responses

export interface LabelReleasesResponse {
  releases: Release[];
}

export interface ArtistReleasesResponse {
  releases: Release[];
}

// ============================================================================
// PROCESSED/TRANSFORMED TYPES
// For frontend display (maintains compatibility with existing UI components)
// ============================================================================

export interface ProcessedTrack {
  position: string;
  title: string;
  duration?: string;
  artists?: { name: string; id?: number }[];
  extraartists?: { name: string; role: string; id?: number }[];
  writers?: string[];
  producers?: string[];
  performers?: string[];
}

export interface ProcessedLabel {
  name: string;
  catno?: string;
  entity_type?: string;
}

export interface ProcessedFormat {
  name: string;
  qty?: number;
  descriptions?: string[];
}

export interface ReleaseDetailsResponse {
  id: number;
  title: string;
  artists: { name: string; id?: number }[];
  labels: ProcessedLabel[];
  year?: number;
  released?: string;
  country?: string;
  formats: ProcessedFormat[];
  genres?: string[];
  styles?: string[];
  tracklist: any[];
  notes?: string;
  processedTracks: ProcessedTrack[];
  processedLabels: ProcessedLabel[];
  processedFormats: ProcessedFormat[];
  displayFormat: string;
  displayLabel: string;
  displayYear: string;
  thumb?: string; // from Discogs API
  cover_image?: string; // from Discogs API
  images?: { type: string; uri: string; uri150: string }[]; // from Discogs API
}

export interface FormatVariant {
  id: number;
  format: string;
  year?: number;
  catno?: string;
}

export interface LabelRelease {
  id: string;
  title: string;
  year?: number;
  catno: string;
  format: string;
  artist: string;
  thumb?: string; // from Discogs API
  resource_url?: string;
  type: string;
  formatVariants: FormatVariant[];
}

// ============================================================================
// DATABASE QUERY RESULT TYPES
// Raw SQL query results with aggregated data (before transformation)
// ============================================================================

export interface DbLabelRelease {
  release_id: number;
  release_title: string;
  catno: string | null;
  released: string | null;
  country: string | null;
  format_name: string | null;
  format_qty: number | null;
  format_descriptions: string | null;
  artist_ids: number[];
  artist_names: string[];
  artist_anvs: (string | null)[];
  label_id: number;
  label_name: string;
  tracks: Array<{
    position: string;
    title: string;
    duration: string;
  }>;
}

export interface DbArtistRelease {
  release_id: number;
  release_title: string;
  released: string | null;
  country: string | null;
  master_id: number;
  format_names: string[];
  label_names: string[];
  catnos: string[];
  tracks: Array<{
    position: string;
    title: string;
    duration: string;
  }>;
}

export interface DbReleaseWithTracks {
  // Release info
  id: number;
  title: string;
  released: string | null;
  country: string | null;
  notes: string | null;
  // Arrays from aggregations
  artist_ids: number[];
  artist_names: string[];
  artist_anvs: (string | null)[];
  label_ids: number[];
  label_names: string[];
  catnos: string[];
  format_names: string[];
  format_qtys: string[];
  format_descriptions: (string | null)[];
  genres: string[];
  styles: string[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DataQuality =
  | 'Needs Vote'
  | 'Complete and Correct'
  | 'Correct'
  | 'Needs Minor Changes'
  | 'Needs Major Changes'
  | 'Entirely Incorrect';

export type ImageType = 'primary' | 'secondary';

export type ReleaseStatus = 'Accepted' | 'Draft' | 'Deleted' | 'Rejected';
