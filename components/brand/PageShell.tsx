import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1240px] px-6 py-12 md:px-10 md:py-16",
        className,
      )}
    >
      {children}
    </div>
  );
}
