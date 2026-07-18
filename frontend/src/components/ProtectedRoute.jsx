import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loading } from "./ui/States";

// Guards authenticated routes; optionally restricts by role.
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
