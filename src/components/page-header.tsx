import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  action
}: {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <div className="flex items-center text-xs text-slate-500 mb-2">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center">
              {b.href ? (
                <Link href={b.href} className="hover:text-primary-700">{b.label}</Link>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight size={12} className="mx-1" />}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
