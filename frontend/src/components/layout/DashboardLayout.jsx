import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Brand from "../Brand";
import Icon from "../ui/Icon";
import { useAuth } from "@/lib/auth";
import { navFor } from "./navConfig";

function SidebarContent({ groups, user, onLogout, onNavigate }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-stack-lg px-2">
        <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-heading font-bold text-lg">
          {(user?.display_name || "؟").charAt(0)}
        </div>
        <div className="min-w-0">
          <h2 className="text-headline-sm font-heading font-bold text-primary truncate">
            {user?.display_name}
          </h2>
          <p className="text-label-md font-heading text-on-surface-variant">{user?.role_display}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="text-body-sm text-on-surface-variant px-3 mb-2">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to.split("/").length <= 2}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex flex-row-reverse items-center justify-end gap-3 p-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-secondary-container text-on-secondary-container font-bold"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`
                  }
                >
                  <span className="text-label-md font-heading">{item.label}</span>
                  <Icon name={item.icon} />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-stack-md border-t border-outline-variant space-y-2">
        <Link
          to="/projects"
          onClick={onNavigate}
          className="w-full bg-primary text-on-primary py-2.5 px-4 rounded-full text-label-md font-heading font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
        >
          مساهمة جديدة
          <Icon name="add" className="text-[18px]" />
        </Link>
        <Link
          to="/"
          onClick={onNavigate}
          className="w-full text-on-surface-variant py-2 px-4 rounded-lg text-label-md font-heading flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
        >
          الصفحة الرئيسية
          <Icon name="home" className="text-[18px]" />
        </Link>
        <button
          onClick={onLogout}
          className="w-full text-on-surface-variant py-2 px-4 rounded-lg text-label-md font-heading flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
        >
          تسجيل الخروج
          <Icon name="logout" className="text-[18px]" />
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = navFor(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Fixed sidebar (right, RTL) */}
      <aside className="hidden md:flex flex-col fixed right-0 top-0 h-screen w-[280px] z-40 py-stack-md px-4 bg-surface-container-low border-l border-outline-variant">
        <SidebarContent groups={groups} user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex flex-row-reverse justify-between items-center w-full px-margin-mobile py-stack-sm bg-surface border-b border-outline-variant sticky top-0 z-30">
        <Brand size="sm" />
        <button onClick={() => setMobileOpen(true)} className="text-on-surface-variant p-2">
          <Icon name="menu" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-on-surface/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[280px] bg-surface-container-low border-l border-outline-variant py-stack-md px-4 flex flex-col">
            <button onClick={() => setMobileOpen(false)} className="self-start mb-2 p-2 text-on-surface-variant">
              <Icon name="close" />
            </button>
            <SidebarContent
              groups={groups}
              user={user}
              onLogout={handleLogout}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 md:mr-[280px] p-margin-mobile md:p-margin-desktop w-full max-w-container-max-width mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
