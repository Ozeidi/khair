import { Link, NavLink } from "react-router-dom";
import Brand from "../Brand";
import Icon from "../ui/Icon";
import { useAuth } from "@/lib/auth";

const links = [
  { to: "/projects", label: "المشاريع" },
  { to: "/about", label: "عن المنصة" },
  { to: "/reports/public", label: "التقارير" },
];

export default function PublicNav() {
  const { user } = useAuth();

  return (
    <nav className="bg-surface border-b border-outline-variant w-full z-50 sticky top-0">
      <div className="flex flex-row-reverse justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto h-16">
        <Brand />

        <div className="hidden md:flex flex-row-reverse items-center gap-8 h-full">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center h-full transition-colors ${
                  isActive
                    ? "text-primary border-b-2 border-primary font-bold pb-1"
                    : "text-on-surface-variant hover:text-primary"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-row-reverse items-center gap-2 md:gap-4">
          <Link
            to="/projects"
            className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant"
            aria-label="بحث"
          >
            <Icon name="search" />
          </Link>
          {user ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-label-md font-heading font-bold hover:bg-primary/90 transition-colors"
            >
              <Icon name="dashboard" className="text-[18px]" />
              <span className="hidden sm:inline">لوحتي</span>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center gap-2 text-on-surface-variant hover:text-primary px-3 py-2 rounded-full text-label-md font-heading font-bold transition-colors"
              >
                <Icon name="login" className="text-[18px]" />
                <span className="hidden sm:inline">تسجيل الدخول</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-label-md font-heading font-bold hover:bg-primary/90 transition-colors"
              >
                <Icon name="person_add" className="text-[18px]" />
                <span>إنشاء حساب</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
