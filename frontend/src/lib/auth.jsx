import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { ensureCsrf } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/me/");
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      await ensureCsrf();
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const requestOtp = useCallback((phone, purpose = "login") => {
    return api.post("/auth/request-otp/", { phone, purpose });
  }, []);

  const verifyOtp = useCallback(async (phone, code, fullName = "", purpose = "login") => {
    const { data } = await api.post("/auth/verify-otp/", {
      phone,
      code,
      full_name: fullName,
      purpose,
    });
    setUser(data.user);
    return data.user;
  }, []);

  // Email + password login.
  const loginWithPassword = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login/", { email, password });
    setUser(data.user);
    return data.user;
  }, []);

  // Email + password registration. `info` = { full_name, email, password, phone? }.
  const register = useCallback(async (info) => {
    const { data } = await api.post("/auth/register/", info);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout/");
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    refresh,
    requestOtp,
    verifyOtp,
    loginWithPassword,
    register,
    logout,
    setUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Role helpers mirroring apps/core/roles.py
export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  ORG_MANAGER: "org_manager",
  PROJECT_OWNER: "project_owner",
  FINANCE_OFFICER: "finance_officer",
  AUDITOR: "auditor",
  CONTENT_OFFICER: "content_officer",
  CONTRIBUTOR: "contributor",
};

export const STAFF_ROLES = [
  ROLES.PLATFORM_ADMIN,
  ROLES.ORG_MANAGER,
  ROLES.PROJECT_OWNER,
  ROLES.FINANCE_OFFICER,
  ROLES.AUDITOR,
  ROLES.CONTENT_OFFICER,
];
