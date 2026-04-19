import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipStyles = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs leading-none transition-colors duration-[160ms]",
  {
    variants: {
      variant: {
        store:
          "bg-[color:var(--bg-elevated)] text-[color:var(--text-soft)] border border-[color:var(--line)]",
        "fragrance-note":
          "bg-[color:var(--surface)] text-[color:var(--accent-strong)] border border-[color:var(--accent)]/40",
        generic:
          "bg-transparent text-[color:var(--text)] border border-[color:var(--text)]/20",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        md: "text-xs px-3 py-1",
      },
    },
    defaultVariants: { variant: "store", size: "md" },
  },
);

type ChipProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chipStyles>;

export function Chip({ className, variant, size, ...props }: ChipProps) {
  return (
    <span className={cn(chipStyles({ variant, size }), className)} {...props} />
  );
}
