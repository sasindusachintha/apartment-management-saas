import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import PropertiesPage from './pages/dashboard/PropertiesPage';
import BuildingsPage from './pages/dashboard/BuildingsPage';
import BuildingOwnersPage from './pages/dashboard/BuildingOwnersPage';
import RentersPage from './pages/dashboard/RentersPage';
import ApartmentsPage from './pages/dashboard/ApartmentsPage';
import MonthlyBillingPage from './pages/dashboard/MonthlyBillingPage';
import WaterReadingsPage from './pages/dashboard/WaterReadingsPage';
import InvoicesPage from './pages/dashboard/InvoicesPage';
import PaymentsPage from './pages/dashboard/PaymentsPage';
import ArrearsPage from './pages/dashboard/ArrearsPage';
import ReportsPage from './pages/dashboard/ReportsPage';
import BillingSettingsPage from './pages/dashboard/BillingSettingsPage';
import UsersPage from './pages/dashboard/UsersPage';
import AuditLogsPage from './pages/dashboard/AuditLogsPage';
import BuildingLayoutPage from './pages/dashboard/BuildingLayoutPage';
import MyApartmentPage from './pages/dashboard/MyApartmentPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected Dashboard Shell */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="properties" element={<PropertiesPage />} />
            
            {/* Super Admin: Building Owners Management */}
            <Route
              path="owners"
              element={
                <ProtectedRoute requiredPermission="users.manage">
                  <BuildingOwnersPage />
                </ProtectedRoute>
              }
            />

            {/* Building Owner & Admin: Renters Management */}
            <Route
              path="renters"
              element={
                <ProtectedRoute requiredPermission="apartments.read">
                  <RentersPage />
                </ProtectedRoute>
              }
            />
            {/* Backward-compatibility redirect from old /residents */}
            <Route path="residents" element={<Navigate to="/dashboard/renters" replace />} />

            <Route
              path="buildings"
              element={
                <ProtectedRoute requiredPermission="buildings.read">
                  <BuildingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="building-layout"
              element={
                <ProtectedRoute requiredPermission="apartments.read">
                  <BuildingLayoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-apartment"
              element={
                <ProtectedRoute>
                  <MyApartmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="apartments"
              element={
                <ProtectedRoute requiredPermission="apartments.read">
                  <ApartmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="monthly-billing"
              element={
                <ProtectedRoute requiredPermission="billing.read">
                  <MonthlyBillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="water-readings"
              element={
                <ProtectedRoute requiredPermission="apartments.read">
                  <WaterReadingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices"
              element={
                <ProtectedRoute requiredPermission="billing.read">
                  <InvoicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="payments"
              element={
                <ProtectedRoute requiredPermission="payments.read">
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="arrears"
              element={
                <ProtectedRoute requiredPermission="payments.read">
                  <ArrearsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute requiredPermission="reports.read">
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="billing-settings"
              element={
                <ProtectedRoute requiredPermission="billing.read">
                  <BillingSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute requiredPermission="users.read">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit"
              element={
                <ProtectedRoute requiredPermission="audit_logs.read">
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
