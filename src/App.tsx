import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LoadingState } from './components/States'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './features/auth/AuthProvider'
import { ProtectedRoute, RoleProtectedRoute } from './features/auth/ProtectedRoute'
import { AdminLayout } from './layouts/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { ForbiddenPage, NotFoundPage } from './pages/SystemPages'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage').then((module) => ({ default: module.ReportDetailPage })))
const ListingsPage = lazy(() => import('./pages/ListingsPage').then((module) => ({ default: module.ListingsPage })))
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage').then((module) => ({ default: module.ListingDetailPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })))
const UserDetailPage = lazy(() => import('./pages/UserDetailPage').then((module) => ({ default: module.UserDetailPage })))
const ModerationLogPage = lazy(() => import('./pages/ModerationLogPage').then((module) => ({ default: module.ModerationLogPage })))
const SupportPage = lazy(() => import('./pages/SupportPage').then((module) => ({ default: module.SupportPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

export function App() {
  return <BrowserRouter><AuthProvider><ToastProvider><Suspense fallback={<LoadingState label="Indlæser side…" />}><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route element={<AdminLayout />}><Route index element={<DashboardPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="reports/:reportId" element={<ReportDetailPage />} /><Route path="listings" element={<ListingsPage />} /><Route path="listings/:listingId" element={<ListingDetailPage />} /><Route path="users" element={<UsersPage />} /><Route path="users/:userId" element={<UserDetailPage />} /><Route path="moderation-log" element={<ModerationLogPage />} /><Route path="support" element={<SupportPage />} /><Route path="forbidden" element={<ForbiddenPage />} /><Route element={<RoleProtectedRoute adminOnly />}><Route path="settings" element={<SettingsPage />} /></Route><Route path="*" element={<NotFoundPage />} /></Route></Route></Routes></Suspense></ToastProvider></AuthProvider></BrowserRouter>
}

export default App
