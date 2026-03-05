/**
 * Runtime implementations for all studio:template components.
 * Loaded dynamically by component-registry.ts when importPath === "studio:template".
 *
 * Primitives render as semantic HTML with Tailwind.
 * Composition components (Hero, BlogCard, Footer etc.) are styled layout
 * containers that render their children — or a representative mock when no
 * children are present.
 */

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Strip non-DOM props before spreading onto HTML elements.
 * Only className, style, id, data-*, and aria-* are safe for all elements.
 * All design-system props (variant, level, size, columns, etc.) are
 * already destructured explicitly in each component signature.
 */
function filterDOMProps(props: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (
      k === "className" || k === "style" || k === "id" ||
      k.startsWith("data-") || k.startsWith("aria-")
    ) {
      safe[k] = v;
    }
  }
  return safe;
}

// ─── Basic Primitives ─────────────────────────────────────────────────────────

export function Spinner({ size = "md", className, ...props }: { size?: "sm" | "md" | "lg"; className?: string; [k: string]: unknown }) {
  const s = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-8 w-8 border-[3px]" };
  return <div className={cn("animate-spin rounded-full border-current border-t-transparent", s[size as keyof typeof s] ?? s.md, className)} {...filterDOMProps(props)} />;
}

export function Heading({ level = "h2", size = "lg", children = "Heading", className, ...props }: { level?: string; size?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const Tag = (["h1","h2","h3","h4","h5","h6"].includes(String(level)) ? level : "h2") as "h1"|"h2"|"h3"|"h4"|"h5"|"h6";
  const sizes: Record<string, string> = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-2xl", "2xl": "text-3xl", "3xl": "text-4xl" };
  return <Tag className={cn("font-semibold tracking-tight", sizes[String(size)] ?? "text-xl", className)} {...filterDOMProps(props)}>{children}</Tag>;
}

export function Text({ size = "md", children = "Text", className, ...props }: { size?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const sizes: Record<string, string> = { xs: "text-xs", sm: "text-sm", md: "text-sm", lg: "text-base" };
  return <p className={cn("text-muted-foreground leading-relaxed", sizes[String(size)] ?? "text-sm", className)} {...filterDOMProps(props)}>{children}</p>;
}

export function Link({ href = "#", children = "Link", className, ...props }: { href?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return <a href={href} className={cn("text-primary underline-offset-4 hover:underline text-sm", className)} {...filterDOMProps(props)}>{children}</a>;
}

export function Stack({ direction = "column", children, className, ...props }: { direction?: "row" | "column"; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return <div className={cn("flex gap-4", direction === "row" ? "flex-row items-center" : "flex-col", className)} {...filterDOMProps(props)}>{children}</div>;
}

export function Grid({ columns = 2, children, className, ...props }: { columns?: number; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const cols = Number(columns);
  return <div className={cn("grid gap-4", cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-4" : "grid-cols-2", className)} {...filterDOMProps(props)}>{children}</div>;
}

export function StatusBadge({ status = "active", children, className }: { status?: string; children?: React.ReactNode; className?: string }) {
  const c: Record<string, string> = { active: "bg-green-100 text-green-700 border-green-200", inactive: "bg-gray-100 text-gray-600 border-gray-200", pending: "bg-yellow-100 text-yellow-700 border-yellow-200", error: "bg-red-100 text-red-700 border-red-200" };
  return <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", c[status] ?? c.active, className)}>{children ?? status}</span>;
}

// ─── Form Components ──────────────────────────────────────────────────────────

export function Toast({ title = "Notification", description = "Your action was successful.", variant = "default", children, className }: { title?: string; description?: string; variant?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4 shadow-sm bg-background max-w-sm", variant === "destructive" && "border-destructive/50 bg-destructive/10", className)}>
      <div className="flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}

export function FormSection({ title, description, children, className, ...props }: { title?: string; description?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("space-y-4", className)} {...filterDOMProps(props)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function PickerInput({ icon, placeholder, disabled, className, ...props }: { icon: React.ReactNode; placeholder: string; disabled?: boolean; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm cursor-pointer hover:bg-accent/50", disabled && "opacity-50 pointer-events-none", className)} {...filterDOMProps(props)}>
      {icon}
      <span className="text-muted-foreground">{placeholder}</span>
    </div>
  );
}

const CalIcon = () => <svg className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const ClockIcon = () => <svg className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export function DatePicker({ placeholder = "Pick a date", disabled = false, className, ...props }: { placeholder?: string; disabled?: boolean; className?: string; [k: string]: unknown }) {
  return <PickerInput icon={<CalIcon />} placeholder={placeholder} disabled={disabled} className={className} {...filterDOMProps(props)} />;
}

export function DateRangePicker({ placeholder = "Pick a date range", disabled = false, className, ...props }: { placeholder?: string; disabled?: boolean; className?: string; [k: string]: unknown }) {
  return <PickerInput icon={<CalIcon />} placeholder={placeholder} disabled={disabled} className={className} {...filterDOMProps(props)} />;
}

export function TimePicker({ placeholder = "Pick a time", disabled = false, className, ...props }: { placeholder?: string; disabled?: boolean; className?: string; [k: string]: unknown }) {
  return <PickerInput icon={<ClockIcon />} placeholder={placeholder} disabled={disabled} className={className} {...filterDOMProps(props)} />;
}

export function Combobox({ placeholder = "Select…", disabled = false, className, ...props }: { placeholder?: string; disabled?: boolean; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm cursor-pointer hover:bg-accent/50", disabled && "opacity-50 pointer-events-none", className)} {...filterDOMProps(props)}>
      <span className="text-muted-foreground">{placeholder}</span>
      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
    </div>
  );
}

export function MultiSelect({ placeholder = "Select items…", disabled = false, className, ...props }: { placeholder?: string; disabled?: boolean; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm cursor-pointer hover:bg-accent/50", disabled && "opacity-50 pointer-events-none", className)} {...filterDOMProps(props)}>
      <span className="text-muted-foreground">{placeholder}</span>
    </div>
  );
}

export function FileUpload({ label = "Upload files", className, ...props }: { label?: string; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors", className)} {...filterDOMProps(props)}>
      <svg className="mb-2 h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Drag & drop or click to browse</p>
    </div>
  );
}

export function ColorPicker({ value = "#6366f1", label = "Pick a colour", className, ...props }: { value?: string; label?: string; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex items-center gap-3 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm cursor-pointer hover:bg-accent/50 w-full", className)} {...filterDOMProps(props)}>
      <span className="h-5 w-5 rounded-full border shadow-inner flex-shrink-0" style={{ backgroundColor: value }} />
      <span className="text-muted-foreground font-mono text-xs">{label}: {value}</span>
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export function Navbar({ brand = "Brand", children, className, ...props }: { brand?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <nav className={cn("flex items-center justify-between h-16 px-6 border-b bg-background w-full", className)} {...filterDOMProps(props)}>
      <span className="font-bold text-base">{brand}</span>
      <div className="flex items-center gap-4">
        {children ?? (
          <>
            {["Home","Features","Pricing"].map(l => <a key={l} href="#" className="text-sm text-muted-foreground hover:text-foreground">{l}</a>)}
            <button className="h-8 px-3 bg-primary text-primary-foreground text-sm rounded-md">Get started</button>
          </>
        )}
      </div>
    </nav>
  );
}

export function Sidebar({ collapsed = false, children, className, ...props }: { collapsed?: boolean; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <aside className={cn("flex flex-col bg-background border-r h-full transition-all", collapsed ? "w-16" : "w-60", className)} {...filterDOMProps(props)}>
      <div className="flex items-center gap-2 h-16 px-4 border-b">
        <div className="h-7 w-7 rounded-md bg-primary/20 flex-shrink-0" />
        {!collapsed && <span className="font-semibold text-sm">App Name</span>}
      </div>
      <div className="flex flex-col gap-1 p-2 flex-1">
        {children ?? ["Dashboard","Projects","Team","Settings"].map((item, i) => (
          <div key={item} className={cn("flex items-center gap-2 h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent cursor-pointer", i === 0 && "bg-accent text-foreground font-medium")}>
            <div className="h-4 w-4 rounded bg-muted flex-shrink-0" />
            {!collapsed && item}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function Stepper({ steps = ["Step 1","Step 2","Step 3"], currentStep = 0, children, className, ...props }: { steps?: string[]; currentStep?: number; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const s = Array.isArray(steps) ? steps : ["Step 1","Step 2","Step 3"];
  const cur = Number(currentStep) || 0;
  return (
    <div className={cn("w-full", className)} {...filterDOMProps(props)}>
      <div className="flex items-center">
        {s.map((step, i) => (
          <React.Fragment key={String(step)}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border-2", i < cur ? "bg-primary border-primary text-primary-foreground" : i === cur ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                {i < cur ? "✓" : i + 1}
              </div>
              <span className={cn("text-xs whitespace-nowrap", i === cur ? "text-foreground font-medium" : "text-muted-foreground")}>{String(step)}</span>
            </div>
            {i < s.length - 1 && <div className={cn("flex-1 h-0.5 mx-2 mb-4", i < cur ? "bg-primary" : "bg-border")} />}
          </React.Fragment>
        ))}
      </div>
      {children}
    </div>
  );
}

export function CommandBar({ placeholder = "Search commands…", children, className, ...props }: { placeholder?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex items-center gap-2 h-10 w-full rounded-lg border bg-background px-3 shadow-sm", className)} {...filterDOMProps(props)}>
      <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      <span className="text-sm text-muted-foreground flex-1">{placeholder}</span>
      <kbd className="px-1.5 py-0.5 text-xs rounded border bg-muted text-muted-foreground">⌘K</kbd>
      {children}
    </div>
  );
}

export function PageHeader({ title = "Page title", description, children, className, ...props }: { title?: string; description?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("space-y-1 pb-4 border-b", className)} {...filterDOMProps(props)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Section({ children, className, ...props }: { children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return <section className={cn("py-12 px-6", className)} {...filterDOMProps(props)}>{children}</section>;
}

// ─── Data & SaaS ──────────────────────────────────────────────────────────────

export function DataGrid({ rows = 3, children, className, ...props }: { rows?: number; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const r = Math.min(Number(rows) || 3, 8);
  return (
    <div className={cn("w-full rounded-lg border overflow-hidden", className)} {...filterDOMProps(props)}>
      <div className="grid grid-cols-4 bg-muted/40 border-b">
        {["Name","Status","Role","Actions"].map(h => <div key={h} className="px-3 py-2 text-xs font-medium text-muted-foreground">{h}</div>)}
      </div>
      {Array.from({ length: r }).map((_, i) => (
        <div key={i} className="grid grid-cols-4 border-b last:border-0 hover:bg-muted/20">
          <div className="px-3 py-2.5 text-sm">User {i + 1}</div>
          <div className="px-3 py-2.5"><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span></div>
          <div className="px-3 py-2.5 text-sm text-muted-foreground">Member</div>
          <div className="px-3 py-2.5 text-sm text-primary cursor-pointer">Edit</div>
        </div>
      ))}
      {children}
    </div>
  );
}

export function FilterBar({ children, className, ...props }: { children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex items-center gap-2 py-2", className)} {...filterDOMProps(props)}>
      <div className="flex items-center gap-2 h-8 rounded-md border bg-transparent px-3 text-sm text-muted-foreground flex-1">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        Search…
      </div>
      <button className="h-8 px-3 rounded-md border text-sm text-muted-foreground hover:bg-accent flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" /></svg>
        Filter
      </button>
      {children}
    </div>
  );
}

export function KPICard({ label = "Total Revenue", value = "$48,295", change = "+12.5%", trend = "up", children, className, ...props }: { label?: string; value?: string; change?: string; trend?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground";
  return (
    <div className={cn("rounded-lg border bg-card p-6 flex flex-col gap-2", className)} {...filterDOMProps(props)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className={cn("text-xs font-medium", trendColor)}>{change} vs last period</p>
      {children}
    </div>
  );
}

export function ActivityFeed({ items = 3, children, className, ...props }: { items?: number; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const mocks = ["User signed up","Payment received","New comment posted","File uploaded"];
  return (
    <div className={cn("space-y-3", className)} {...filterDOMProps(props)}>
      {Array.from({ length: Math.min(Number(items) || 3, mocks.length) }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium">U</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{mocks[i]}</p>
            <p className="text-xs text-muted-foreground">{i + 1}h ago</p>
          </div>
        </div>
      ))}
      {children}
    </div>
  );
}

export function UserMenu({ name = "Alex Connor", email = "alex@example.com", children, className, ...props }: { name?: string; email?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex items-center gap-2 p-2 rounded-lg hover:bg-accent cursor-pointer", className)} {...filterDOMProps(props)}>
      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold flex-shrink-0">{String(name).charAt(0).toUpperCase()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
      <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </div>
  );
}

export function NotificationBell({ count = 3, className, ...props }: { count?: number; className?: string; [k: string]: unknown }) {
  const n = Number(count) || 0;
  return (
    <button className={cn("relative h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center", className)} {...filterDOMProps(props)}>
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
      {n > 0 && <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">{n > 9 ? "9+" : n}</span>}
    </button>
  );
}

export function BoardCard({ title = "Task title", status = "In Progress", priority = "Medium", children, className, ...props }: { title?: string; status?: string; priority?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow cursor-pointer", className)} {...filterDOMProps(props)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">{priority}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{status}</span>
        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">A</div>
      </div>
      {children}
    </div>
  );
}

export function ChartCard({ title = "Monthly Revenue", children, className, ...props }: { title?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const bars = [40, 65, 50, 80, 55, 90, 70, 85];
  return (
    <div className={cn("rounded-lg border bg-card p-6 flex flex-col gap-4", className)} {...filterDOMProps(props)}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex items-end gap-1.5 h-24">
        {bars.map((h, i) => <div key={i} className="flex-1 bg-primary/80 rounded-sm" style={{ height: `${h}%` }} />)}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title = "No results", description = "Try adjusting your search or filters.", children, className, ...props }: { title?: string; description?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-8 text-center gap-3", className)} {...filterDOMProps(props)}>
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      {children}
    </div>
  );
}

export function FormWizard({ steps = ["Details","Review","Confirm"], currentStep = 0, children, className, ...props }: { steps?: string[]; currentStep?: number; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const s = Array.isArray(steps) ? steps : ["Details","Review","Confirm"];
  const cur = Number(currentStep) || 0;
  return (
    <div className={cn("space-y-6 w-full", className)} {...filterDOMProps(props)}>
      <Stepper steps={s} currentStep={cur} />
      <div className="rounded-lg border p-4">{children ?? <p className="text-sm text-muted-foreground">Step {cur + 1} content</p>}</div>
      <div className="flex justify-between">
        <button className="h-8 px-3 rounded-md border text-sm hover:bg-accent disabled:opacity-50" disabled={cur === 0}>Back</button>
        <button className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">{cur === s.length - 1 ? "Submit" : "Next"}</button>
      </div>
    </div>
  );
}

// ─── Website / Marketing ──────────────────────────────────────────────────────

export function Hero({ variant = "centered", children, className, ...props }: { variant?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const isCentered = variant === "centered";
  return (
    <section className={cn("w-full py-16 px-8 bg-background", isCentered ? "flex flex-col items-center text-center" : "flex flex-col gap-6", className)} {...filterDOMProps(props)}>
      {children ?? (
        <div className={cn("flex flex-col gap-4", isCentered && "items-center")}>
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full w-fit">New feature</span>
          <h1 className={cn("text-4xl font-bold tracking-tight", isCentered && "max-w-2xl")}>Build something great</h1>
          <p className={cn("text-muted-foreground text-lg", isCentered && "max-w-xl")}>The fastest way to build and ship your ideas.</p>
          <div className="flex gap-3 mt-2">
            <button className="h-10 px-6 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Get started</button>
            <button className="h-10 px-6 border rounded-lg text-sm font-medium hover:bg-accent">Learn more</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function FeatureGrid({ columns = 3, children, className, ...props }: { columns?: number; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const cols = Number(columns) || 3;
  const feats = ["Fast","Reliable","Scalable","Secure","Beautiful","Accessible"];
  return (
    <section className={cn("py-12 px-6", className)} {...filterDOMProps(props)}>
      {children ?? (
        <div className={cn("grid gap-6", cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-4" : "grid-cols-3")}>
          {feats.slice(0, cols * 2).map(f => (
            <div key={f} className="flex flex-col gap-2 p-4 rounded-lg border bg-card">
              <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center"><div className="h-4 w-4 rounded bg-primary/40" /></div>
              <p className="text-sm font-semibold">{f}</p>
              <p className="text-xs text-muted-foreground">A powerful feature that helps you build better products.</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function CTABanner({ title = "Ready to get started?", description = "Join thousands of teams already using our platform.", children, className, ...props }: { title?: string; description?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("rounded-xl bg-primary/10 border border-primary/20 p-8 flex flex-col items-center text-center gap-4", className)} {...filterDOMProps(props)}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      {children ?? (
        <div className="flex gap-3">
          <button className="h-10 px-6 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Get started free</button>
          <button className="h-10 px-6 border rounded-lg text-sm font-medium hover:bg-accent">Talk to sales</button>
        </div>
      )}
    </div>
  );
}

export function PricingCard({ plan = "Pro", price = "$29", period = "month", features = ["Unlimited projects","Team collaboration","Priority support","Advanced analytics"], highlighted = false, children, className, ...props }: { plan?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const feats = Array.isArray(features) ? features : ["Feature one","Feature two","Feature three"];
  return (
    <div className={cn("rounded-xl border p-8 flex flex-col gap-6", highlighted && "border-primary bg-primary/5 shadow-md", className)} {...filterDOMProps(props)}>
      {highlighted && <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full w-fit">Most popular</span>}
      <div>
        <p className="text-sm font-medium text-muted-foreground">{plan}</p>
        <div className="flex items-end gap-1 mt-1">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-sm text-muted-foreground mb-1">/{period}</span>
        </div>
      </div>
      <ul className="space-y-2">
        {feats.map(f => (
          <li key={String(f)} className="flex items-center gap-2 text-sm">
            <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {String(f)}
          </li>
        ))}
      </ul>
      {children ?? <button className={cn("w-full h-10 rounded-lg text-sm font-medium", highlighted ? "bg-primary text-primary-foreground" : "border hover:bg-accent")}>Get started</button>}
    </div>
  );
}

export function TestimonialCard({ quote = "This product has completely transformed how our team works.", author = "Sarah Johnson", role = "CTO, Acme Corp", children, className, ...props }: { quote?: string; author?: string; role?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 flex flex-col gap-4", className)} {...filterDOMProps(props)}>
      <svg className="h-6 w-6 text-primary/40" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
      <p className="text-sm text-muted-foreground leading-relaxed">{quote}</p>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold flex-shrink-0">{String(author).charAt(0)}</div>
        <div>
          <p className="text-sm font-medium">{author}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function LogoCloud({ logos = ["Acme","Vercel","Stripe","Linear","Figma","GitHub"], children, className, ...props }: { logos?: string[]; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const ls = Array.isArray(logos) ? logos : ["Acme","Vercel","Stripe"];
  return (
    <section className={cn("py-8 px-6", className)} {...filterDOMProps(props)}>
      {children ?? (
        <>
          <p className="text-center text-sm text-muted-foreground mb-6">Trusted by the world&apos;s best teams</p>
          <div className="flex flex-wrap justify-center items-center gap-8">
            {ls.map(logo => <span key={String(logo)} className="text-sm font-semibold text-muted-foreground/60 tracking-wider uppercase">{String(logo)}</span>)}
          </div>
        </>
      )}
    </section>
  );
}

export function FAQ({ items = [{ question: "How does pricing work?", answer: "We offer flexible monthly and annual plans." }, { question: "Can I cancel anytime?", answer: "Yes, you can cancel at any time." }], children, className, ...props }: { items?: { question: string; answer: string }[]; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  const its = Array.isArray(items) ? items : [];
  return (
    <section className={cn("py-12 px-6", className)} {...filterDOMProps(props)}>
      {children ?? (
        <div className="space-y-3 max-w-2xl mx-auto">
          {its.map((item, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-semibold">{item.question}</p>
              <p className="text-sm text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BlogCard({ children, className, ...props }: { children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <article className={cn("rounded-lg border bg-card overflow-hidden hover:shadow-sm transition-shadow", className)} {...filterDOMProps(props)}>
      {children ?? (
        <>
          <div className="h-40 bg-muted flex items-center justify-center">
            <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-primary">Design</span>
            <h3 className="text-sm font-semibold leading-snug">How to build a great design system from scratch</h3>
            <p className="text-xs text-muted-foreground">A practical guide to creating scalable design systems for modern teams.</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-5 w-5 rounded-full bg-primary/20" />
              <span className="text-xs text-muted-foreground">Alex Connor · Feb 27</span>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

export function TeamCard({ name = "Alex Connor", role = "Designer", bio = "Passionate about creating beautiful, functional user experiences.", children, className, ...props }: { name?: string; role?: string; bio?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 flex flex-col items-center text-center gap-3", className)} {...filterDOMProps(props)}>
      <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold">{String(name).charAt(0)}</div>
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
      <p className="text-xs text-muted-foreground">{bio}</p>
      {children}
    </div>
  );
}

export function Footer({ variant = "default", children, className, ...props }: { variant?: string; children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <footer className={cn("border-t bg-background", variant === "dark" && "bg-foreground text-background", className)} {...filterDOMProps(props)}>
      {children ?? (
        <>
          <div className="py-8 px-6 grid grid-cols-4 gap-8">
            <div className="col-span-1">
              <p className="font-bold text-sm">Studio</p>
              <p className="text-xs text-muted-foreground mt-1">Build better products, faster.</p>
            </div>
            {[{ title: "Product", links: ["Features","Pricing","Changelog"] }, { title: "Company", links: ["About","Blog","Careers"] }, { title: "Legal", links: ["Privacy","Terms","Cookies"] }].map(col => (
              <div key={col.title}>
                <p className="text-xs font-semibold mb-2">{col.title}</p>
                <ul className="space-y-1.5">{col.links.map(link => <li key={link}><a href="#" className="text-xs text-muted-foreground hover:text-foreground">{link}</a></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="border-t py-4 px-6"><p className="text-xs text-muted-foreground">© 2026 Studio. All rights reserved.</p></div>
        </>
      )}
    </footer>
  );
}

export function ContactForm({ children, className, ...props }: { children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4 w-full max-w-md", className)} {...filterDOMProps(props)}>
      {children ?? (
        <>
          <h2 className="text-lg font-semibold">Get in touch</h2>
          {["Name","Email"].map(f => (
            <div key={f} className="space-y-1">
              <label className="text-xs font-medium">{f}</label>
              <div className="h-9 rounded-md border bg-transparent px-3 flex items-center text-sm text-muted-foreground">Enter {f.toLowerCase()}</div>
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs font-medium">Message</label>
            <div className="h-24 rounded-md border bg-transparent px-3 py-2 text-sm text-muted-foreground">Your message…</div>
          </div>
          <button className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Send message</button>
        </>
      )}
    </div>
  );
}

export function BentoGrid({ children, className, ...props }: { children?: React.ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={cn("grid grid-cols-3 gap-3 auto-rows-[160px]", className)} {...filterDOMProps(props)}>
      {children ?? (
        <>
          <div className="col-span-2 rounded-xl border bg-card p-5 flex flex-col gap-2"><p className="text-sm font-semibold">Main feature</p><p className="text-xs text-muted-foreground">A large card spanning two columns</p></div>
          <div className="col-span-1 rounded-xl border bg-primary/10 p-5"><p className="text-sm font-semibold">Highlight</p></div>
          <div className="col-span-1 rounded-xl border bg-card p-5"><p className="text-sm font-semibold">Feature</p></div>
          <div className="col-span-2 rounded-xl border bg-card p-5 flex flex-col gap-2"><p className="text-sm font-semibold">Secondary feature</p><p className="text-xs text-muted-foreground">Another card spanning two columns</p></div>
        </>
      )}
    </div>
  );
}
