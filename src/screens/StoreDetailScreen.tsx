// ============================================================
// Store Detail — visit history, key contacts, internal notes
// Tables: ios_store_contacts, ios_store_internal_notes (created via SQL)
// ============================================================
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/db'
import type { Store } from '../types'

type StoreTab = 'visits' | 'contacts' | 'notes'

interface VisitRow {
  id: string
  checkin_at: string
  checkout_at: string | null
  duration_minutes: number | null
  visit_type: string
  ios_rep_profiles: { full_name: string } | null
}

interface Contact {
  id: string
  store_id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

interface StoreNote {
  id: string
  store_id: string
  author_id: string
  note: string
  created_at: string
  ios_rep_profiles?: { full_name: string } | null
}

export function StoreDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { repProfile } = useAuth()

  const [store,     setStore]    = useState<Store | null>(null)
  const [tab,       setTab]      = useState<StoreTab>('visits')
  const [visits,    setVisits]   = useState<VisitRow[]>([])
  const [contacts,  setContacts] = useState<Contact[]>([])
  const [notes,     setNotes]    = useState<StoreNote[]>([])
  const [loading,   setLoading]  = useState(true)
  const [contactErr, setContactErr] = useState(false)
  const [noteErr,    setNoteErr]    = useState(false)

  // Add contact form state
  const [addingContact, setAddingContact] = useState(false)
  const [cName,  setCName]  = useState('')
  const [cRole,  setCRole]  = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cNotes, setCNotes] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  // Add note form state
  const [addingNote,  setAddingNote]  = useState(false)
  const [noteText,    setNoteText]    = useState('')
  const [savingNote,  setSavingNote]  = useState(false)

  const isManager = repProfile?.role === 'manager' || repProfile?.role === 'admin'

  useEffect(() => {
    if (!id) return
    loadStore(id)
    loadVisits(id)
    loadContacts(id)
    loadNotes(id)
  }, [id])

  async function loadStore(storeId: string) {
    // Try Dexie cache first
    const cached = await db.stores.get(storeId)
    if (cached) { setStore(cached); setLoading(false); return }
    // Fallback to Supabase
    const { data } = await supabase
      .from('ios_stores')
      .select('*, ios_retailers(name)')
      .eq('id', storeId)
      .single()
    if (data) {
      const s = {
        ...data,
        retailer_name: (data.ios_retailers as { name: string } | null)?.name ?? '',
      } as Store
      setStore(s)
    }
    setLoading(false)
  }

  async function loadVisits(storeId: string) {
    const { data } = await supabase
      .from('ios_visits')
      .select('id, checkin_at, checkout_at, duration_minutes, visit_type, ios_rep_profiles(full_name)')
      .eq('store_id', storeId)
      .order('checkin_at', { ascending: false })
      .limit(50)
    setVisits((data ?? []) as unknown as VisitRow[])
  }

  async function loadContacts(storeId: string) {
    const { data, error } = await supabase
      .from('ios_store_contacts')
      .select('id, store_id, name, role, phone, email, notes')
      .eq('store_id', storeId)
      .order('name')
    if (error && error.code === '42P01') { setContactErr(true); return } // table not yet created
    setContacts((data ?? []) as Contact[])
  }

  async function loadNotes(storeId: string) {
    const { data, error } = await supabase
      .from('ios_store_internal_notes')
      .select('id, store_id, author_id, note, created_at, ios_rep_profiles(full_name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
    if (error && error.code === '42P01') { setNoteErr(true); return } // table not yet created
    setNotes((data ?? []) as unknown as StoreNote[])
  }

  async function saveContact() {
    if (!cName.trim() || !id || !repProfile) return
    setSavingContact(true)
    const { data, error } = await supabase
      .from('ios_store_contacts')
      .insert({
        store_id: id,
        name: cName.trim(),
        role: cRole.trim() || null,
        phone: cPhone.trim() || null,
        email: cEmail.trim() || null,
        notes: cNotes.trim() || null,
        created_by: repProfile.id,
      })
      .select('id, store_id, name, role, phone, email, notes')
      .single()
    if (!error && data) {
      setContacts(prev => [...prev, data as Contact].sort((a, b) => a.name.localeCompare(b.name)))
      setCName(''); setCRole(''); setCPhone(''); setCEmail(''); setCNotes('')
      setAddingContact(false)
    }
    setSavingContact(false)
  }

  async function deleteContact(contactId: string) {
    await supabase.from('ios_store_contacts').delete().eq('id', contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  async function saveNote() {
    if (!noteText.trim() || !id || !repProfile) return
    setSavingNote(true)
    const { data, error } = await supabase
      .from('ios_store_internal_notes')
      .insert({ store_id: id, author_id: repProfile.id, note: noteText.trim() })
      .select('id, store_id, author_id, note, created_at')
      .single()
    if (!error && data) {
      const enriched = { ...(data as StoreNote), ios_rep_profiles: { full_name: repProfile.full_name } }
      setNotes(prev => [enriched, ...prev])
      setNoteText('')
      setAddingNote(false)
    }
    setSavingNote(false)
  }

  async function deleteNote(noteId: string) {
    await supabase.from('ios_store_internal_notes').delete().eq('id', noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function formatShortDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  function lastVisitDays(): number | null {
    if (visits.length === 0) return null
    const ms = Date.now() - new Date(visits[0].checkin_at).getTime()
    return Math.floor(ms / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>Loading...</p>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={() => navigate(-1)} className="text-ios-blue text-sm mb-4">← Back</button>
        <p className="text-gray-400 text-sm">Store not found.</p>
      </div>
    )
  }

  const lastDays = lastVisitDays()
  const overdue = store.visit_frequency_days && lastDays !== null && lastDays > store.visit_frequency_days

  const TABS: [StoreTab, string][] = [
    ['visits',   `Visits${visits.length > 0 ? ` (${visits.length})` : ''}`],
    ['contacts', `Contacts${contacts.length > 0 ? ` (${contacts.length})` : ''}`],
    ['notes',    `Notes${notes.length > 0 ? ` (${notes.length})` : ''}`],
  ]

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="bg-ios-navy px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="text-blue-300 text-sm mb-2">← Stores</button>
        <p className="text-blue-300 text-xs uppercase tracking-wide">{store.retailer_name}</p>
        <p className="text-white font-bold text-lg leading-tight">{store.name}</p>
        <p className="text-blue-200 text-xs mt-0.5">
          {store.suburb}, {store.state}
          {store.postcode ? ` · ${store.postcode}` : ''}
          {store.store_number ? ` · #${store.store_number}` : ''}
        </p>

        {/* Stats row */}
        <div className="flex gap-4 mt-3">
          <div>
            <p className="text-white font-bold text-sm">{visits.length}</p>
            <p className="text-blue-300 text-xs">total visits</p>
          </div>
          <div>
            <p className={`font-bold text-sm ${overdue ? 'text-amber-400' : 'text-white'}`}>
              {lastDays === null ? 'Never' : lastDays === 0 ? 'Today' : `${lastDays}d ago`}
            </p>
            <p className="text-blue-300 text-xs">last visit</p>
          </div>
          {store.visit_frequency_days && (
            <div>
              <p className="text-white font-bold text-sm">Every {store.visit_frequency_days}d</p>
              <p className="text-blue-300 text-xs">frequency</p>
            </div>
          )}
        </div>

        {overdue && (
          <div className="mt-2 bg-amber-500 bg-opacity-20 rounded-lg px-3 py-1.5">
            <p className="text-amber-300 text-xs font-bold">Overdue — {lastDays}d since last visit</p>
          </div>
        )}

        {/* Check in button */}
        <button
          onClick={() => navigate('/check', { state: { preselectedStoreId: store.id } })}
          className="mt-3 w-full py-2 rounded-lg bg-ios-blue text-white text-sm font-bold"
        >
          Check In Here
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200 text-xs">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 font-bold ${
              tab === key ? 'text-ios-navy border-b-2 border-ios-navy' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">

        {/* VISITS TAB */}
        {tab === 'visits' && (
          <>
            {visits.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No visits recorded yet.</p>
            ) : visits.map(v => (
              <button
                key={v.id}
                onClick={() => navigate(`/visit/${v.id}`)}
                className="w-full bg-white rounded-lg px-4 py-3 border border-gray-200 text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-ios-navy text-sm">{formatDate(v.checkin_at)}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {v.visit_type === 'physical' ? '📍 Physical' : '💻 Remote'}
                      {v.duration_minutes ? ` · ${v.duration_minutes} min` : ''}
                      {isManager && v.ios_rep_profiles ? ` · ${v.ios_rep_profiles.full_name}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    v.checkout_at ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {v.checkout_at ? 'Done' : 'Open'}
                  </span>
                </div>
              </button>
            ))}
          </>
        )}

        {/* CONTACTS TAB */}
        {tab === 'contacts' && (
          <>
            {contactErr ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
                <p className="text-amber-700 text-sm font-bold">Store contacts table not set up yet</p>
                <p className="text-amber-600 text-xs mt-1">Run the 003_store_contacts_notes.sql in Supabase first.</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setAddingContact(!addingContact)}
                  className="w-full py-2.5 rounded-xl border border-ios-navy text-ios-navy text-sm font-bold"
                >
                  {addingContact ? 'Cancel' : '+ Add Contact'}
                </button>

                {addingContact && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">New Contact</p>
                    {[
                      { label: 'Name *', val: cName, set: setCName, type: 'text' },
                      { label: 'Role / Title', val: cRole, set: setCRole, type: 'text' },
                      { label: 'Phone', val: cPhone, set: setCPhone, type: 'tel' },
                      { label: 'Email', val: cEmail, set: setCEmail, type: 'email' },
                      { label: 'Notes', val: cNotes, set: setCNotes, type: 'text' },
                    ].map(({ label, val, set, type }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                        <input
                          type={type}
                          value={val}
                          onChange={e => set(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                    <button
                      onClick={saveContact}
                      disabled={savingContact || !cName.trim()}
                      className="w-full py-2.5 rounded-xl bg-ios-navy text-white text-sm font-bold disabled:opacity-50 mt-2"
                    >
                      {savingContact ? 'Saving...' : 'Save Contact'}
                    </button>
                  </div>
                )}

                {contacts.length === 0 && !addingContact && (
                  <p className="text-gray-400 text-sm text-center py-8">No contacts added yet.</p>
                )}

                {contacts.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-ios-navy text-sm">{c.name}</p>
                        {c.role && <p className="text-gray-500 text-xs">{c.role}</p>}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-ios-blue text-xs block mt-0.5">{c.phone}</a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-ios-blue text-xs block">{c.email}</a>
                        )}
                        {c.notes && <p className="text-gray-400 text-xs mt-1 italic">{c.notes}</p>}
                      </div>
                      <button
                        onClick={() => deleteContact(c.id)}
                        className="text-gray-300 text-lg px-1 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* NOTES TAB */}
        {tab === 'notes' && (
          <>
            {noteErr ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
                <p className="text-amber-700 text-sm font-bold">Store notes table not set up yet</p>
                <p className="text-amber-600 text-xs mt-1">Run the 003_store_contacts_notes.sql in Supabase first.</p>
              </div>
            ) : (
              <>
                {!addingNote ? (
                  <button
                    onClick={() => setAddingNote(true)}
                    className="w-full py-2.5 rounded-xl border border-ios-navy text-ios-navy text-sm font-bold"
                  >
                    + Add Note
                  </button>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Internal Note</p>
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="What's relevant about this store? Layout changes, upcoming promotions, key risks..."
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={saveNote}
                        disabled={savingNote || !noteText.trim()}
                        className="flex-1 py-2 rounded-xl bg-ios-navy text-white text-sm font-bold disabled:opacity-50"
                      >
                        {savingNote ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setAddingNote(false); setNoteText('') }}
                        className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {notes.length === 0 && !addingNote && (
                  <p className="text-gray-400 text-sm text-center py-8">No internal notes yet.</p>
                )}

                {notes.map(n => (
                  <div key={n.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-ios-navy text-sm flex-1">{n.note}</p>
                      {(isManager || n.author_id === repProfile?.id) && (
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="text-gray-300 text-lg px-1 shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mt-1.5">
                      {n.ios_rep_profiles?.full_name ?? 'Unknown'} · {formatShortDate(n.created_at)}
                    </p>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
