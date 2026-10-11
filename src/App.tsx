import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/components/AppLayout"
import {
  FullPageSpinner,
  HomeRedirect,
  ProtectedRoute,
  PublicOnlyRoute,
} from "@/components/ProtectedRoute"
import { AuthProvider } from "@/context/AuthProvider"
import { AuthPage } from "@/pages/AuthPage"
import { EmployeeDashboard } from "@/pages/employee/EmployeeDashboard"
import { ManagerDashboard } from "@/pages/manager/ManagerDashboard"
import { TeamPage } from "@/pages/manager/TeamPage"
import { UploadDocument } from "@/pages/manager/UploadDocument"

// PDF rendering and stamping libraries are heavy; load them only on these pages.
const SignDocument = lazy(() =>
  import("@/pages/employee/SignDocument").then((m) => ({ default: m.SignDocument }))
)
const DocumentDetail = lazy(() =>
  import("@/pages/manager/DocumentDetail").then((m) => ({ default: m.DocumentDetail }))
)

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<FullPageSpinner />}>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
            </Route>

            <Route element={<ProtectedRoute role="employee" />}>
              <Route element={<AppLayout />}>
                <Route path="/employee" element={<EmployeeDashboard />} />
                <Route path="/employee/sign/:assignmentId" element={<SignDocument />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute role="manager" />}>
              <Route element={<AppLayout />}>
                <Route path="/manager" element={<ManagerDashboard />} />
                <Route path="/manager/team" element={<TeamPage />} />
                <Route path="/manager/upload" element={<UploadDocument />} />
                <Route path="/manager/documents/:documentId" element={<DocumentDetail />} />
              </Route>
            </Route>

            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
