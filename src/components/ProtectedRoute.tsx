import { Navigate, Outlet } from "react-router-dom"
import { Loader2Icon } from "lucide-react"

import { useAuth } from "@/context/AuthProvider"
import type { Enums } from "@/lib/database.types"

export function homePathFor(role: Enums<"user_role">) {
  return role === "manager" ? "/manager" : "/employee"
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function ProtectedRoute({ role }: { role?: Enums<"user_role"> }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (!session || !profile) return <Navigate to="/login" replace />
  if (role && profile.role !== role) {
    return <Navigate to={homePathFor(profile.role)} replace />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (session && profile) return <Navigate to={homePathFor(profile.role)} replace />
  return <Outlet />
}

export function HomeRedirect() {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (!session || !profile) return <Navigate to="/login" replace />
  return <Navigate to={homePathFor(profile.role)} replace />
}
