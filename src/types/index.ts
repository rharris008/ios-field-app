// ============================================================
// IOS Field App — Core Types
// Supabase tables all use ios_ prefix.
// ============================================================

export type UserRole = 'rep' | 'manager' | 'admin'
export type SyncStatus = 'pending' | 'synced' | 'error'
export type VisitType = 'physical' | 'remote'
export type ActionStatus = 'identified' | 'assigned' | 'in_progress' | 'resolved'

// --- Reference data (cached in Dexie) -------------------------

export interface Retailer {
  id: string
  name: string
  is_active: boolean
}

export interface Brand {
  id: string
  name: string
  is_active: boolean
}

export interface Store {
  id: string
  retailer_id: string
  retailer_name?: string        // joined from ios_retailers
  store_number: string | null
  name: string
  address: string | null
  suburb: string
  state: string
  postcode: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
  visit_frequency_days: number | null
}

// --- Auth / profile -------------------------------------------

export interface RepProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  state_territory: string | null
  headshot_url: string | null
  is_active: boolean
  terms_accepted_at: string | null
}

// --- Offline queue types (Dexie) ------------------------------

export interface OfflineVisit {
  localId: string
  storeId: string
  repId: string
  visitType: VisitType
  checkinAt: string      // ISO, AEST local
  checkinLat: number | null
  checkinLng: number | null
  checkoutAt: string | null
  checkoutLat: number | null
  checkoutLng: number | null
  durationMinutes: number | null
  brandIds: string[]
  callNotes: string | null
  contactName?: string | null
  contactMethod?: string | null
  attempts: number
  lastAttempt: string | null
}

export interface OfflineFeedback {
  localId: string
  visitLocalId: string
  storeVibe: string | null
  salesSentiment: string | null
  affectingSales: string[]
  whatWouldHelp: string[]
  storeChanges: string[]
  storeChangesNotes: string
  relationshipRating: string | null
  potentialIssues: string[]
  followUpRequired: boolean
  attempts: number
}

export interface OfflinePhoto {
  localId: string
  visitId: string
  storeId: string
  brandId: string | null
  repId: string
  category: PhotoCategory
  photoBlob: string        // base64 JPEG, compressed client-side
  isBefore: boolean
  isAfter: boolean
  beforeAfterGroupId: string | null
  visitDate: string        // YYYY-MM-DD AEST
  retailerId: string
  notes: string
  attempts: number
}

export type PhotoCategory =
  | 'product'
  | 'merchandising'
  | 'pos'
  | 'display'
  | 'bulk_stack'
  | 'pricing'
  | 'training'
  | 'competitor'
  | 'staff_product'
  | 'rep_staff'
  | 'field_team'

export const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: 'product',      label: 'Product' },
  { value: 'merchandising',label: 'Merchandising' },
  { value: 'pos',          label: 'POS' },
  { value: 'display',      label: 'Display' },
  { value: 'bulk_stack',   label: 'Bulk Stack' },
  { value: 'pricing',      label: 'Pricing' },
  { value: 'training',     label: 'Training' },
  { value: 'competitor',   label: 'Competitor' },
  { value: 'staff_product',label: 'Staff + Product' },
  { value: 'rep_staff',    label: 'Rep + Staff' },
  { value: 'field_team',   label: 'Field Team' },
]

// --- Store feedback options -----------------------------------

export const STORE_VIBE_OPTIONS = [
  { value: 'very_positive', label: 'Very Positive' },
  { value: 'positive',      label: 'Positive' },
  { value: 'neutral',       label: 'Neutral' },
  { value: 'challenging',   label: 'Challenging' },
  { value: 'poor',          label: 'Poor' },
]

export const SALES_SENTIMENT_OPTIONS = [
  { value: 'very_strong', label: 'Very Strong' },
  { value: 'strong',      label: 'Strong' },
  { value: 'average',     label: 'Average' },
  { value: 'slow',        label: 'Slow' },
  { value: 'very_slow',   label: 'Very Slow' },
  { value: 'unsure',      label: 'Unsure' },
]

export const AFFECTING_SALES_OPTIONS = [
  'Stock', 'Pricing', 'Range', 'Staff knowledge', 'Competition',
  'Customer traffic', 'Positioning/display', 'Promotion', 'Other',
]

export const WHAT_WOULD_HELP_OPTIONS = [
  'Stock', 'Training', 'POS', 'Better display', 'Range',
  'Pricing/promotion', 'Account manager support', 'Other',
]

export const STORE_CHANGE_OPTIONS = [
  'Franchisee change', 'Store manager change', 'Department manager change',
  'Staff change', 'Stocktake', 'Renovation', 'Range change',
  'Store restructure', 'Closure/relocation', 'No significant change', 'Other',
]

export const RELATIONSHIP_OPTIONS = [
  { value: 'excellent',      label: 'Excellent' },
  { value: 'good',           label: 'Good' },
  { value: 'neutral',        label: 'Neutral' },
  { value: 'needs_attention',label: 'Needs Attention' },
  { value: 'poor',           label: 'Poor' },
]

export const POTENTIAL_ISSUE_OPTIONS = [
  'Credit claim', 'Outstanding credit', 'Stock', 'Delivery/freight',
  'Returns', 'Warranty', 'Pricing', 'Communication',
  'Service/support', 'Product issue', 'Other',
]
