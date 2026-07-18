import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatNumber } from "@/lib/format";
import {
  Icon,
  ProjectCard,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";

// Ordering presets exposed in the filter bar (maps label → DRF ordering param).
const ORDERINGS = [
  { value: "-published_at", label: "الأحدث" },
  { value: "-collected_amount", label: "الأعلى تحصيلاً" },
  { value: "-financial_progress", label: "الأقرب للاكتمال" },
];

// Publishable public statuses (contract §2 — only published lifecycle states).
const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "funded", label: "مكتمل التمويل" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "completed", label: "مكتمل" },
];

const selectClass =
  "w-full appearance-none bg-surface border border-outline-variant rounded-lg pr-4 pl-10 py-2.5 text-body-sm text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-right cursor-pointer";

// A native <select> wrapped with an RTL leading label icon on the left edge.
function FilterSelect({ icon, value, onChange, children }) {
  return (
    <div className="relative w-full md:flex-1">
      <select className={selectClass} dir="rtl" value={value} onChange={onChange}>
        {children}
      </select>
      <Icon
        name={icon}
        className="text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
      />
    </div>
  );
}

export default function Projects() {
  const [params, setParams] = useSearchParams();

  // URL is the source of truth for shareable/back-button friendly filters.
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const state = params.get("state") ?? "";
  const status = params.get("status") ?? "";
  const ordering = params.get("ordering") ?? ORDERINGS[0].value;
  const page = Number(params.get("page") ?? "1") || 1;

  // Local search text so typing feels instant; committed to URL after debounce.
  const [searchText, setSearchText] = useState(search);
  useEffect(() => setSearchText(search), [search]);

  // Merge patch into the URL, always resetting to page 1 unless page is set.
  const updateParams = (patch) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => {
          if (v === "" || v == null) next.delete(k);
          else next.set(k, v);
        });
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  // Debounce search input → URL (350ms). Skip if unchanged to avoid loops.
  useEffect(() => {
    if (searchText === search) return;
    const t = setTimeout(() => updateParams({ search: searchText }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const queryParams = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(state ? { state } : {}),
      ...(status ? { status } : {}),
      ordering,
      page,
    }),
    [search, category, state, status, ordering, page]
  );

  const categoriesQuery = useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => (await api.get("/public/categories/")).data,
    staleTime: 5 * 60 * 1000,
  });

  const projectsQuery = useQuery({
    queryKey: ["public-projects", queryParams],
    queryFn: async () =>
      (await api.get("/public/projects/", { params: queryParams })).data,
    placeholderData: keepPreviousData,
  });

  const categories = Array.isArray(categoriesQuery.data)
    ? categoriesQuery.data
    : categoriesQuery.data?.results ?? [];

  const data = projectsQuery.data;
  const projects = data?.results ?? (Array.isArray(data) ? data : []);
  const count = data?.count ?? projects.length;
  const numPages = data?.num_pages ?? 1;
  const currentPage = data?.current_page ?? page;

  const hasActiveFilters = Boolean(search || category || state || status);

  const clearFilters = () =>
    setParams({ ...(ordering !== ORDERINGS[0].value ? { ordering } : {}) }, { replace: true });

  return (
    <div className="max-w-container-max-width mx-auto w-full px-margin-mobile md:px-margin-desktop py-margin-mobile md:py-margin-desktop flex flex-col gap-stack-lg">
      {/* Header */}
      <section className="flex flex-col gap-stack-md">
        <div className="flex flex-row-reverse items-end justify-between gap-4 flex-wrap">
          <h1 className="text-headline-lg font-heading font-bold text-primary">استعراض المشاريع</h1>
          {!projectsQuery.isLoading && !projectsQuery.isError && (
            <span className="text-body-sm text-on-surface-variant">
              {formatNumber(count)} مشروع
            </span>
          )}
        </div>

        {/* Filter bar */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-4 flex flex-col md:flex-row-reverse gap-4 items-stretch md:items-center">
          {/* Search */}
          <div className="relative w-full md:w-1/3">
            <Icon
              name="search"
              className="text-[20px] absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
            <input
              type="text"
              dir="rtl"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ابحث عن مشروع..."
              className="w-full pr-10 pl-4 py-2.5 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-right"
            />
          </div>

          {/* Category */}
          <FilterSelect
            icon="category"
            value={category}
            onChange={(e) => updateParams({ category: e.target.value })}
          >
            <option value="">جميع التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id ?? c.slug ?? c.name} value={c.id ?? c.slug ?? c.name}>
                {c.name}
              </option>
            ))}
          </FilterSelect>

          {/* State / region */}
          <FilterSelect
            icon="location_on"
            value={state}
            onChange={(e) => updateParams({ state: e.target.value })}
          >
            <option value="">جميع المناطق</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FilterSelect>

          {/* Status */}
          <FilterSelect
            icon="flag"
            value={status}
            onChange={(e) => updateParams({ status: e.target.value })}
          >
            <option value="">جميع الحالات</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FilterSelect>

          {/* Ordering */}
          <FilterSelect
            icon="sort"
            value={ordering}
            onChange={(e) => updateParams({ ordering: e.target.value })}
          >
            {ORDERINGS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
        </div>
      </section>

      {/* Grid / states */}
      {projectsQuery.isLoading ? (
        <Loading label="جارٍ تحميل المشاريع…" />
      ) : projectsQuery.isError ? (
        <ErrorState
          title="تعذّر تحميل المشاريع"
          description="حدث خطأ أثناء جلب قائمة المشاريع. حاول مرة أخرى."
          onRetry={() => projectsQuery.refetch()}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="لا توجد مشاريع مطابقة"
          description={
            hasActiveFilters
              ? "لم نعثر على مشاريع تطابق معايير البحث. جرّب تعديل عوامل التصفية."
              : "لا توجد مشاريع منشورة حاليًا. تفقّد المنصة لاحقًا."
          }
          action={
            hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-primary font-bold hover:underline"
              >
                مسح عوامل التصفية
              </button>
            )
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
            {projects.map((project) => (
              <ProjectCard key={project.id ?? project.public_slug} project={project} />
            ))}
          </section>

          {numPages > 1 && (
            <Pagination
              currentPage={currentPage}
              numPages={numPages}
              onChange={(p) => updateParams({ page: String(p) })}
            />
          )}
        </>
      )}
    </div>
  );
}

// Omani governorates used for the state/region filter (matches Project.state values).
const STATES = [
  "مسقط",
  "ظفار",
  "مسندم",
  "البريمي",
  "الداخلية",
  "شمال الباطنة",
  "جنوب الباطنة",
  "شمال الشرقية",
  "جنوب الشرقية",
  "الظاهرة",
  "الوسطى",
];

// Build a windowed list of page numbers with ellipsis gaps.
function pageRange(current, total) {
  const pages = [];
  const push = (p) => pages.push(p);
  if (total <= 7) {
    for (let i = 1; i <= total; i++) push(i);
    return pages;
  }
  push(1);
  if (current > 3) push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) push(i);
  if (current < total - 2) push("…");
  push(total);
  return pages;
}

function Pagination({ currentPage, numPages, onChange }) {
  const pages = pageRange(currentPage, numPages);
  const btn =
    "w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40 disabled:pointer-events-none";

  return (
    <nav className="flex justify-center items-center gap-2 flex-row-reverse mt-stack-md">
      {/* Previous (visually right in RTL) */}
      <button
        className={btn}
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="الصفحة السابقة"
      >
        <Icon name="chevron_right" className="text-[22px]" />
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-on-surface-variant select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === currentPage ? "page" : undefined}
            className={
              p === currentPage
                ? "w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary font-bold shadow-sm"
                : btn
            }
          >
            {formatNumber(p)}
          </button>
        )
      )}

      {/* Next (visually left in RTL) */}
      <button
        className={btn}
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage >= numPages}
        aria-label="الصفحة التالية"
      >
        <Icon name="chevron_left" className="text-[22px]" />
      </button>
    </nav>
  );
}
