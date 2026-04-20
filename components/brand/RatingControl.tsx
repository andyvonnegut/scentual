"use client";

import { useId, useState, useTransition } from "react";
import {
  setPersonalRating,
  type PersonalRatingScale,
} from "@/app/actions/library";
import { cn } from "@/lib/utils";

type RatingValue = number | null;

type ScaleConfig = {
  label: string;
  icon: "atomizer" | "heart" | "bottle";
};

type RatingControlProps = {
  perfumeId: number;
  scale: PersonalRatingScale;
  initialRating: RatingValue;
  size?: "sm" | "md";
  showLabel?: boolean;
  showValue?: boolean;
};

type RatingsControlGroupProps = {
  perfumeId: number;
  initialRatings: Record<PersonalRatingScale, RatingValue>;
  size?: "sm" | "md";
  showValues?: boolean;
  className?: string;
};

const SCALE_CONFIG: Record<PersonalRatingScale, ScaleConfig> = {
  projection: {
    label: "Projection",
    icon: "atomizer",
  },
  overall: {
    label: "Overall",
    icon: "heart",
  },
  design: {
    label: "Design",
    icon: "bottle",
  },
};

const SCALE_ORDER: PersonalRatingScale[] = ["overall", "projection", "design"];
const ICON_COUNT = 5;

export function RatingsControlGroup({
  perfumeId,
  initialRatings,
  size = "md",
  showValues = true,
  className,
}: RatingsControlGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {SCALE_ORDER.map((scale) => (
        <RatingControl
          key={scale}
          perfumeId={perfumeId}
          scale={scale}
          initialRating={initialRatings[scale]}
          size={size}
          showValue={showValues}
        />
      ))}
    </div>
  );
}

export function RatingControl({
  perfumeId,
  scale,
  initialRating,
  size = "md",
  showLabel = true,
  showValue = true,
}: RatingControlProps) {
  const [rating, setLocalRating] = useState<RatingValue>(initialRating);
  const [hover, setHover] = useState<RatingValue>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const labelId = useId();
  const active = hover ?? rating ?? 0;
  const iconSize = size === "sm" ? 16 : 22;
  const rowGap = size === "sm" ? "gap-2.5" : "gap-3";
  const buttonGap = size === "sm" ? "gap-0.5" : "gap-1";
  const metaText = size === "sm" ? "text-[11px]" : "text-xs";
  const valueGap = size === "sm" ? "gap-2" : "gap-2.5";
  const labelText =
    size === "sm"
      ? "text-[11px] uppercase tracking-[0.12em]"
      : "text-xs uppercase tracking-[0.14em]";
  const labelWidth = size === "sm" ? "w-[4.75rem]" : "w-[5.5rem]";
  const config = SCALE_CONFIG[scale];

  const handleClick = (value: number) => {
    const prev = rating;
    const next = prev === value ? null : value;
    setLocalRating(next);
    setError(null);
    startTransition(async () => {
      try {
        await setPersonalRating(perfumeId, scale, next);
      } catch {
        setLocalRating(prev);
        setError("Couldn't save rating");
      }
    });
  };

  return (
    <div className={cn("flex items-center justify-start", rowGap)}>
      <div className={cn("flex min-w-0 items-center justify-start", rowGap)}>
        {showLabel && (
          <span
            id={labelId}
            className={cn("micro-label shrink-0 text-left", labelText, labelWidth)}
          >
            {config.label}
          </span>
        )}
        <div className={cn("flex items-center", valueGap)}>
          <div
            role="radiogroup"
            aria-label={showLabel ? undefined : `${config.label} rating`}
            aria-labelledby={showLabel ? labelId : undefined}
            className={cn("flex items-center", buttonGap)}
            onMouseLeave={() => setHover(null)}
          >
            {Array.from({ length: ICON_COUNT }, (_, i) => i + 1).map((value) => {
              const isFilled = value <= active;
              const isSelected = rating === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${config.label} ${value} out of 5`}
                  disabled={isPending}
                  onMouseEnter={() => setHover(value)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(null)}
                  onClick={() => handleClick(value)}
                  className={cn(
                    "relative grid place-items-center rounded-full transition-all duration-[160ms] disabled:opacity-60",
                    "p-1 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]",
                  )}
                >
                  <RatingGlyph
                    filled={isFilled}
                    icon={config.icon}
                    size={iconSize}
                  />
                </button>
              );
            })}
          </div>
          {showValue && (
            <span
              className={cn(
                "shrink-0 tabular-nums text-[color:var(--text-soft)]",
                metaText,
              )}
            >
              {error ? error : rating != null ? `${rating} / 5` : "Not rated"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const ATOMIZER_BOTTLE_PATH =
  "M 10 1.8 C 11.5 1.8, 11.5 4, 10.5 4.2 L 10.5 5.5 L 11.5 5.5 L 11.5 7 L 10.5 7 C 14 8, 14.5 13, 13 18 C 12.5 20, 11 21, 11 21.7 L 12.5 21.7 L 12.5 22.5 L 7.5 22.5 L 7.5 21.7 L 9 21.7 C 9 21, 7.5 20, 7 18 C 5.5 13, 6 8, 9.5 7 L 8.5 7 L 8.5 5.5 L 9.5 5.5 L 9.5 4.2 C 8.5 4, 8.5 1.8, 10 1.8 Z";
const ATOMIZER_TUBE_PATH = "M 8.5 6.3 C 4 2, 0 11, 2.5 17";
const ATOMIZER_CLOUD_PATH =
  "M 15 3.5 Q 14.8 1.8, 16 1.7 Q 16.7 0.5, 17.7 1.2 Q 18.5 0.3, 19.5 1.3 Q 20.3 0.5, 21 1.8 Q 22 1.5, 22 3 Q 22.7 3.5, 22 4.5 Q 22.5 5.8, 21.2 5.5 Q 20.5 6.5, 19.2 5.8 Q 18 6.8, 17 5.5 Q 15.5 6.3, 15 5 Q 14.3 4.3, 15 3.5 Z";
const ATOMIZER_SPRAY_PATH =
  "M 11.5 2.3 L 14.5 2.7 M 11.5 2.8 L 14.8 3.5 M 11.5 3.4 L 14.5 4.3";
const HEART_PATH =
  "M12 20.2 10.8 19.1C5.4 14.2 2 11.1 2 7.3 2 4.7 4 2.8 6.7 2.8 8.2 2.8 9.7 3.5 10.7 4.8 11.1 5.3 11.7 5.3 12.1 4.8 13.1 3.5 14.6 2.8 16.1 2.8 18.8 2.8 20.8 4.7 20.8 7.3 20.8 11.1 17.4 14.2 12 19.1Z";
const BOTTLE_CAP_PATH = "M9 2.2h6v2.4H9z";
const BOTTLE_COLLAR_PATH = "M9.8 4.6h4.4v2.1H9.8z";
const BOTTLE_BODY_PATH =
  "M8.1 6.7h7.8c1 0 1.8.8 1.8 1.8v11.1c0 1.2-1 2.2-2.2 2.2H8.5c-1.2 0-2.2-1-2.2-2.2V8.5c0-1 .8-1.8 1.8-1.8Z";
const BOTTLE_LABEL_PATH = "M9.4 11.2h5.2v4.2H9.4z";

function RatingGlyph({
  filled,
  icon,
  size,
}: {
  filled: boolean;
  icon: ScaleConfig["icon"];
  size: number;
}) {
  if (icon === "heart") return <HeartGlyph filled={filled} size={size} />;
  if (icon === "bottle") return <PerfumeBottleGlyph filled={filled} size={size} />;
  return <AtomizerGlyph filled={filled} size={size} />;
}

function AtomizerGlyph({ filled, size }: { filled: boolean; size: number }) {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-[color:var(--accent)] transition-colors duration-[160ms]"
      >
        <path d={ATOMIZER_BOTTLE_PATH} fill="currentColor" />
        <ellipse cx="2.5" cy="18" rx="1.5" ry="1" fill="currentColor" />
        <path
          d={ATOMIZER_TUBE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path d={ATOMIZER_CLOUD_PATH} fill="currentColor" />
        <path
          d={ATOMIZER_SPRAY_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--text-soft)] transition-colors duration-[160ms] hover:text-[color:var(--accent)]"
    >
      <path d={ATOMIZER_BOTTLE_PATH} />
      <ellipse cx="2.5" cy="18" rx="1.5" ry="1" />
      <path d={ATOMIZER_TUBE_PATH} />
      <path d={ATOMIZER_CLOUD_PATH} />
      <path d={ATOMIZER_SPRAY_PATH} strokeWidth="1" />
    </svg>
  );
}

function HeartGlyph({ filled, size }: { filled: boolean; size: number }) {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-[color:var(--accent)] transition-colors duration-[160ms]"
      >
        <path d={HEART_PATH} fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--text-soft)] transition-colors duration-[160ms] hover:text-[color:var(--accent)]"
    >
      <path d={HEART_PATH} />
    </svg>
  );
}

function PerfumeBottleGlyph({ filled, size }: { filled: boolean; size: number }) {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-[color:var(--accent)] transition-colors duration-[160ms]"
      >
        <path d={BOTTLE_CAP_PATH} fill="currentColor" />
        <path d={BOTTLE_COLLAR_PATH} fill="currentColor" />
        <path d={BOTTLE_BODY_PATH} fill="currentColor" />
        <path d={BOTTLE_LABEL_PATH} fill="white" opacity="0.9" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--text-soft)] transition-colors duration-[160ms] hover:text-[color:var(--accent)]"
    >
      <path d={BOTTLE_CAP_PATH} />
      <path d={BOTTLE_COLLAR_PATH} />
      <path d={BOTTLE_BODY_PATH} />
      <path d={BOTTLE_LABEL_PATH} />
    </svg>
  );
}
