import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local."
  )
}

export const supabase = createClient<Database>(url, key)

export const DOCUMENTS_BUCKET = "documents"
export const SIGNED_BUCKET = "signed"

export function signedCopyPath(employeeId: string, assignmentId: string) {
  return `${employeeId}/${assignmentId}.pdf`
}

/** Short-lived URL for a private storage object. */
export async function getFileUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
