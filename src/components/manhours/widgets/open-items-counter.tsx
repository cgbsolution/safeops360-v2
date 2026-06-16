import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, ClipboardCheck, FileText, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpenItem {
  label: string;
  count: number;
  /** Tone drives the chip colour — alarming numbers in rose. */
  tone: "neutral" | "warning" | "alert";
  href: string;
  icon: "findings" | "capas" | "submissions" | "tasks";
}

/**
 * Counter strip — surfaces the four most-used "what needs my action"
 * lists with a count + direct link. Drives the operational rhythm of
 * the dashboard.
 */
export function OpenItemsCounter({ items }: { items: OpenItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Open items</CardTitle>
        <CardDescription>Items requiring attention in your scope.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {items.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className={cn(
                "block rounded-md border p-3 transition hover:shadow-sm hover:border-primary-300",
                TONE[item.tone].card
              )}
            >
              <div className="flex items-center gap-2">
                <Icon name={item.icon} className={TONE[item.tone].icon} />
                <span className={cn("text-[10px] uppercase tracking-wider", TONE[item.tone].text)}>{item.label}</span>
              </div>
              <div className={cn("text-2xl font-bold tabular-nums mt-1", TONE[item.tone].text)}>{item.count}</div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const TONE = {
  neutral: { card: "bg-slate-50 border-slate-200", text: "text-slate-700", icon: "text-slate-500" },
  warning: { card: "bg-amber-50 border-amber-200", text: "text-amber-800", icon: "text-amber-700" },
  alert: { card: "bg-rose-50 border-rose-200", text: "text-rose-800", icon: "text-rose-700" }
};

function Icon({ name, className }: { name: OpenItem["icon"]; className: string }) {
  const props = { size: 14, className };
  if (name === "findings") return <AlertTriangle {...props} />;
  if (name === "capas") return <ClipboardCheck {...props} />;
  if (name === "submissions") return <FileText {...props} />;
  return <Hourglass {...props} />;
}
