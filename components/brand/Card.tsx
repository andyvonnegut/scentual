import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] bg-[color:var(--bg-elevated)] border border-[color:var(--line)] p-6 transition-shadow duration-[220ms] hover:shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
