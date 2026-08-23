import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import AddTransaction from '../pages/AddTransaction';
import TransactionHistory from '../pages/TransactionHistory';
import CustomerLedger from '../pages/CustomerLedger';
import BankLedger from '../pages/BankLedger';
import TransactionDetail from '../pages/TransactionDetail';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import UserManagement from '../pages/UserManagement';
import BackupRestore from '../pages/BackupRestore';
import SarafiLedger from '../pages/SarafiLedger';
import RouteErrorBoundary from '../components/RouteErrorBoundary';
import { safeGetStoredUser } from '../utils/formatters';

function isValidToken(token) {
  return Boolean(token && token !== 'null' && token !== 'undefined' && String(token).trim() !== '');
}

function PrivateRoute({ children }) {
  const token = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('sky_banking_token') : null;
  return isValidToken(token) ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ children, allowedRoles }) {
  const user = safeGetStoredUser();
  const userRole = user.role || 'Viewer';
  return allowedRoles.includes(userRole) ? children : <Navigate to="/" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="add-transaction" element={<RoleRoute allowedRoles={['Admin', 'Accountant']}><AddTransaction /></RoleRoute>} />
        <Route path="edit-transaction/:id" element={<RoleRoute allowedRoles={['Admin', 'Accountant']}><AddTransaction /></RoleRoute>} />
        <Route path="transactions" element={<TransactionHistory />} />
        <Route path="transactions/:id" element={<TransactionDetail />} />
        <Route path="customer-ledger" element={<CustomerLedger />} />
        <Route path="sarafi-ledger" element={<SarafiLedger />} />
        <Route path="bank-ledger" element={<BankLedger />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<RoleRoute allowedRoles={['Admin']}><Settings /></RoleRoute>} />
        <Route
          path="users"
          element={
            <RoleRoute allowedRoles={['Admin']}>
              <RouteErrorBoundary
                title="User Directory could not load"
                message="Something went wrong while initializing the users directory. Your data is safe. Please try again."
              >
                <UserManagement />
              </RouteErrorBoundary>
            </RoleRoute>
          }
        />
        <Route path="backup" element={<RoleRoute allowedRoles={['Admin']}><BackupRestore /></RoleRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

