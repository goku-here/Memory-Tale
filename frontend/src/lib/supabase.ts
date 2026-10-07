import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)
export const ORIGINALS = 'Originals'
/** originals above this size are skipped (the compressed copy is still used) */
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024

let client: SupabaseClient | null = null
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null
  return (client ??= createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } }))
}

const ext = (f: File) => (f.name.split('.').pop() || f.type.split('/')[1] || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'

/**
 * Uploads the untouched original photo. Returns its storage path, or null if it was skipped / failed
 * (callers must never block adding a photo on this).
 */
export async function uploadOriginal(file: File, folder: string): Promise<string | null> {
  const sb = getSupabase()
  if (!sb || file.size > MAX_ORIGINAL_BYTES) return null
  const path = `${folder}/${crypto.randomUUID()}.${ext(file)}`
  const { error } = await sb.storage.from(ORIGINALS).upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (error) { console.warn('[originals] upload failed:', error.message); return null }
  return path
}

export async function downloadOriginal(path: string): Promise<Blob | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.storage.from(ORIGINALS).download(path)
  if (error) { console.warn('[originals] download failed:', error.message); return null }
  return data
}
