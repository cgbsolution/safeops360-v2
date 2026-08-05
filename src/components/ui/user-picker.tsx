"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Loader2, Search, User as UserIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickerUser = {
  id: string;
  name: string;
  email?: string;
  designation?: string | null;
  department?: string | null;
  role?: string;
  plant?: { id: string; name: string; code?: string } | null;
};

export type UserPickerFilter = {
  role?: string | string[];
  plantId?: string;
  departmentId?: string;
  /** Narrow to users who hold this permission code (e.g. "INSPECTION.EXECUTE"). */
  permission?: string;
  excludeSelf?: boolean;
  /**
   * When a `role` filter is set but no user at the plant holds that role,
   * fall back to returning all (otherwise-filtered) users instead of an empty
   * list. Use for "preferred but not mandatory" pickers like the PTW Issuer,
   * where the server doesn't actually enforce the role — so an empty picker
   * would block the user for no reason.
   */
  roleFallback?: boolean;
};

type SingleProps = {
  multiple?: false;
  value: string | null | undefined;
  onChange: (userId: string | null, user: PickerUser | null) => void;
};

type MultiProps = {
  multiple: true;
  value: string[];
  onChange: (userIds: string[], users: PickerUser[]) => void;
};

type CommonProps = {
  filter?: UserPickerFilter;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
  emptyText?: string;
};

export type UserPickerProps = CommonProps & (SingleProps | MultiProps);

const RECENT_KEY = "safeops_recent_users";
const RECENT_MAX = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const cur = loadRecent().filter((x) => x !== id);
    cur.unshift(id);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

function buildQuery(filter: UserPickerFilter | undefined, q: string) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (filter?.plantId) sp.set("plantId", filter.plantId);
  if (filter?.departmentId) sp.set("departmentId", filter.departmentId);
  if (filter?.permission) sp.set("permission", filter.permission);
  if (filter?.excludeSelf) sp.set("excludeSelf", "true");
  if (filter?.roleFallback) sp.set("roleFallback", "true");
  if (filter?.role) {
    const roles = Array.isArray(filter.role) ? filter.role : [filter.role];
    roles.forEach((r) => sp.append("role", r));
  }
  sp.set("take", "20");
  return sp.toString();
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div className={cn("flex-shrink-0 rounded-full bg-primary-100 text-primary-800 font-semibold flex items-center justify-center", cls)}>
      {userInitials(name)}
    </div>
  );
}

function UserRow({ user, selected, onSelect, focused }: { user: PickerUser; selected?: boolean; onSelect: () => void; focused?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-focused={focused || undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 data-[focused]:bg-primary-50 transition",
        selected && "bg-primary-50"
      )}
    >
      <UserAvatar name={user.name} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{user.name}</div>
        <div className="text-xs text-slate-500 truncate">
          {user.designation ?? "—"}
          {user.plant?.name ? ` · ${user.plant.name}` : ""}
          {!user.plant?.name && user.department ? ` · ${user.department}` : ""}
        </div>
      </div>
      {selected && <Check size={14} className="flex-shrink-0 text-primary-700" />}
    </button>
  );
}

export function UserPicker(props: UserPickerProps) {
  const { filter, placeholder = "Search and select a person", required, disabled, className, name, id, emptyText } = props;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [users, setUsers] = React.useState<PickerUser[]>([]);
  const [selectedCache, setSelectedCache] = React.useState<Record<string, PickerUser>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch users when popover opens or query/filter changes
  const filterKey = JSON.stringify(filter ?? {});
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = buildQuery(filter, debounced);
    fetch(`/api/users?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const list: PickerUser[] = data.users ?? [];
        setUsers(list);
        // Cache so the trigger label still shows when search filters them out
        setSelectedCache((prev) => {
          const next = { ...prev };
          list.forEach((u) => {
            next[u.id] = u;
          });
          return next;
        });
        setFocusedIdx(0);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debounced, filterKey, filter]);

  // Pre-resolve currently selected user labels (so trigger shows name on first render)
  const selectedIds = React.useMemo<string[]>(() => {
    if (props.multiple) return props.value ?? [];
    return props.value ? [props.value] : [];
  }, [props]);

  React.useEffect(() => {
    const missing = selectedIds.filter((id) => !selectedCache[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        fetch(`/api/users?take=1&q=${encodeURIComponent("")}&id=${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then(() => {
      if (cancelled) return;
      // Fall back: if /api/users doesn't support id lookup, request all and pick by id
      fetch(`/api/users?take=100`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || cancelled) return;
          const list: PickerUser[] = data.users ?? [];
          setSelectedCache((prev) => {
            const next = { ...prev };
            list.forEach((u) => {
              if (selectedIds.includes(u.id)) next[u.id] = u;
            });
            return next;
          });
        })
        .catch(() => {
          /* ignore */
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(",")]);

  // Sort: recently selected first, then alphabetical (the API already sorts alphabetical)
  const recentIds = React.useMemo(() => loadRecent(), [open]);
  const sortedUsers = React.useMemo(() => {
    if (!users.length) return users;
    const recentSet = new Set(recentIds);
    const recent = users.filter((u) => recentSet.has(u.id));
    const rest = users.filter((u) => !recentSet.has(u.id));
    recent.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
    return [...recent, ...rest];
  }, [users, recentIds]);

  function selectUser(u: PickerUser) {
    pushRecent(u.id);
    setSelectedCache((prev) => ({ ...prev, [u.id]: u }));
    if (props.multiple) {
      const cur = props.value ?? [];
      const next = cur.includes(u.id) ? cur.filter((x) => x !== u.id) : [...cur, u.id];
      const nextUsers = next.map((id) => ({ ...(selectedCache[id] ?? {}), ...(id === u.id ? u : selectedCache[id]) })).filter(Boolean) as PickerUser[];
      props.onChange(next, nextUsers);
    } else {
      props.onChange(u.id, u);
      setOpen(false);
      setQuery("");
    }
  }

  function clearSelection(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (props.multiple) {
      props.onChange([], []);
    } else {
      props.onChange(null, null);
    }
  }

  function removeOne(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!props.multiple) return;
    const next = (props.value ?? []).filter((x) => x !== id);
    const nextUsers = next.map((i) => selectedCache[i]).filter(Boolean) as PickerUser[];
    props.onChange(next, nextUsers);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, sortedUsers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const u = sortedUsers[focusedIdx];
      if (u) selectUser(u);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Trigger display
  const singleSelected = !props.multiple && props.value ? selectedCache[props.value] : null;
  const multiSelected = props.multiple ? (props.value ?? []).map((id) => selectedCache[id]).filter(Boolean) as PickerUser[] : [];
  const hasValue = props.multiple ? multiSelected.length > 0 : !!props.value;

  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (v) { setTimeout(() => inputRef.current?.focus(), 0); } else { setQuery(""); } }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !hasValue && "text-slate-500",
            className
          )}
        >
          <span className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {!hasValue && <span>{placeholder}</span>}
            {!props.multiple && singleSelected && (
              <span className="flex items-center gap-2 min-w-0">
                <UserAvatar name={singleSelected.name} size="sm" />
                <span className="font-medium text-slate-900 truncate">{singleSelected.name}</span>
                <span className="text-xs text-slate-500 truncate">
                  {singleSelected.designation ?? ""}
                  {singleSelected.plant?.name ? `, ${singleSelected.plant.name}` : ""}
                </span>
              </span>
            )}
            {props.multiple &&
              multiSelected.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 rounded bg-primary-100 text-primary-800 px-2 py-0.5 text-xs">
                  {u.name}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => removeOne(u.id, e)}
                    className="ml-0.5 hover:text-primary-900 cursor-pointer"
                    aria-label={`Remove ${u.name}`}
                  >
                    <X size={12} />
                  </span>
                </span>
              ))}
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            {hasValue && !disabled && !required && (
              <span
                role="button"
                tabIndex={0}
                onClick={clearSelection}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Clear selection"
              >
                <X size={14} />
              </span>
            )}
            <ChevronDown size={14} className="text-slate-400" />
          </span>
        </button>
      </Popover.Trigger>

      {/* Hidden input for native form submit */}
      {name && !props.multiple && (
        <input type="hidden" name={name} value={props.value ?? ""} required={required} />
      )}
      {name && props.multiple && (
        <input type="hidden" name={name} value={(props.value ?? []).join(",")} required={required && (props.value ?? []).length === 0} />
      )}

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[--radix-popover-trigger-width] min-w-[280px] rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b p-2">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search by name, designation…"
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div ref={listRef} className="max-h-72 overflow-y-auto py-1" role="listbox">
            {loading && (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-1/2 rounded bg-slate-200" />
                      <div className="h-2 w-3/4 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="p-3 text-xs text-rose-600 flex items-center gap-2">
                <span>Failed to load: {error}</span>
              </div>
            )}

            {!loading && !error && sortedUsers.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                <UserIcon size={20} className="mx-auto text-slate-300 mb-1" />
                {emptyText ?? "No users match — adjust filters or contact admin"}
              </div>
            )}

            {!loading && !error && sortedUsers.length > 0 && (
              <>
                {recentIds.length > 0 && sortedUsers.some((u) => recentIds.includes(u.id)) && (
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recent</div>
                )}
                {sortedUsers.map((u, i) => {
                  const sel = props.multiple ? (props.value ?? []).includes(u.id) : props.value === u.id;
                  const isLastRecent = recentIds.includes(u.id) && (sortedUsers[i + 1] ? !recentIds.includes(sortedUsers[i + 1].id) : false);
                  return (
                    <React.Fragment key={u.id}>
                      <UserRow user={u} selected={sel} onSelect={() => selectUser(u)} focused={i === focusedIdx} />
                      {isLastRecent && <div className="my-1 border-t border-slate-100" />}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>

          {props.multiple && multiSelected.length > 0 && (
            <div className="border-t p-2 flex items-center justify-between text-xs text-slate-500">
              <span>{multiSelected.length} selected</span>
              <button
                type="button"
                onClick={() => (props as MultiProps).onChange([], [])}
                className="hover:text-rose-600"
              >
                Clear all
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default UserPicker;
