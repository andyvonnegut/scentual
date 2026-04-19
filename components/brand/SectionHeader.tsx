import { cn } from "@/lib/utils";

export function SectionHeader({
  label,
  title,
  className,
  children,
}: {
  label?: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {label && <span className="micro-label">{label}</span>}
      {title && (
        <h2 className="font-display text-3xl leading-tight text-[color:var(--text)]">
          {title}
        </h2>
      )}
      {children}
    </header>
  );
}
