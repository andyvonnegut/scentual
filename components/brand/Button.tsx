import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-strong)]",
        secondary:
          "bg-transparent text-[color:var(--text)] border border-[color:var(--line)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]",
        ghost:
          "bg-transparent text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
