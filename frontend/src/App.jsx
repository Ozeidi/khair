import { Routes, Route } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { ROLES } from "./lib/auth";

// Public
import Home from "./pages/public/Home";
import Projects from "./pages/public/Projects";
import ProjectDetail from "./pages/public/ProjectDetail";
import About from "./pages/public/About";
import PublicReports from "./pages/public/PublicReports";
import ReceiptVerify from "./pages/public/ReceiptVerify";
import Contribute from "./pages/public/Contribute";

// Auth
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Contributor
import ContributorDashboard from "./pages/dashboard/ContributorDashboard";
import Subscriptions from "./pages/dashboard/Subscriptions";
import SubscriptionDetail from "./pages/dashboard/SubscriptionDetail";
import Receipts from "./pages/dashboard/Receipts";
import AccountSettings from "./pages/dashboard/AccountSettings";

// Management (organization / project workspace)
import ManageHome from "./pages/manage/ManageHome";
import ManageProjects from "./pages/manage/ManageProjects";
import ProjectForm from "./pages/manage/ProjectForm";
import ProjectWorkspace from "./pages/manage/ProjectWorkspace";
import Contributors from "./pages/manage/Contributors";
import Payments from "./pages/manage/Payments";
import Revenues from "./pages/manage/Revenues";
import Expenses from "./pages/manage/Expenses";
import Budget from "./pages/manage/Budget";
import Updates from "./pages/manage/Updates";
import Campaigns from "./pages/manage/Campaigns";
import ManageReports from "./pages/manage/ManageReports";

// Admin console
import AdminHome from "./pages/admin/AdminHome";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import AdminApproveProjects from "./pages/admin/AdminApproveProjects";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAudit from "./pages/admin/AdminAudit";

import NotFound from "./pages/NotFound";

const STAFF = [
  ROLES.PLATFORM_ADMIN,
  ROLES.ORG_MANAGER,
  ROLES.PROJECT_OWNER,
  ROLES.FINANCE_OFFICER,
  ROLES.AUDITOR,
  ROLES.CONTENT_OFFICER,
];

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:slug" element={<ProjectDetail />} />
        <Route path="/projects/:slug/contribute" element={<Contribute />} />
        <Route path="/about" element={<About />} />
        <Route path="/reports/public" element={<PublicReports />} />
        <Route path="/verify" element={<ReceiptVerify />} />
        <Route path="/verify/:code" element={<ReceiptVerify />} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Contributor dashboard */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<ContributorDashboard />} />
        <Route path="/dashboard/subscriptions" element={<Subscriptions />} />
        <Route path="/dashboard/subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="/dashboard/receipts" element={<Receipts />} />
        <Route path="/dashboard/settings" element={<AccountSettings />} />
      </Route>

      {/* Management workspace */}
      <Route
        element={
          <ProtectedRoute roles={STAFF}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/manage" element={<ManageHome />} />
        <Route path="/manage/projects" element={<ManageProjects />} />
        <Route path="/manage/projects/new" element={<ProjectForm />} />
        <Route path="/manage/projects/:id" element={<ProjectWorkspace />} />
        <Route path="/manage/projects/:id/edit" element={<ProjectForm />} />
        <Route path="/manage/contributors" element={<Contributors />} />
        <Route path="/manage/payments" element={<Payments />} />
        <Route path="/manage/revenues" element={<Revenues />} />
        <Route path="/manage/expenses" element={<Expenses />} />
        <Route path="/manage/budget" element={<Budget />} />
        <Route path="/manage/updates" element={<Updates />} />
        <Route path="/manage/campaigns" element={<Campaigns />} />
        <Route path="/manage/reports" element={<ManageReports />} />
      </Route>

      {/* Admin console */}
      <Route
        element={
          <ProtectedRoute roles={[ROLES.PLATFORM_ADMIN]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin-console" element={<AdminHome />} />
        <Route path="/admin-console/organizations" element={<AdminOrganizations />} />
        <Route path="/admin-console/projects" element={<AdminApproveProjects />} />
        <Route path="/admin-console/users" element={<AdminUsers />} />
        <Route path="/admin-console/audit" element={<AdminAudit />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
