import { cn } from "@/lib/utils";
import { APP_LINE, APP_NAME } from "@/lib/version";

/** Monochrome pal-in-nest mark. Stays crisp in the tab and at 28px. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-primary", className)} aria-hidden>
      <path
        d="M6.2 16.6c-2.6-.4-4.2-2.6-3.6-4.2 1.4.4 3.6 1.6 3.6 4.2z"
        fill="currentColor"
        opacity="0.42"
      />
      <path
        d="M25.8 16.6c2.6-.4 4.2-2.6 3.6-4.2-1.4.4-3.6 1.6-3.6 4.2z"
        fill="currentColor"
        opacity="0.42"
      />
      <path
        d="M5.2 19.2c.5 6.8 4.6 10.2 10.8 10.2s10.3-3.4 10.8-10.2c-2.4 3.4-6.4 5.2-10.8 5.2s-8.4-1.8-10.8-5.2z"
        fill="currentColor"
        opacity="0.22"
      />
      <ellipse cx="10.5" cy="9.1" rx="3.15" ry="3.9" fill="currentColor" transform="rotate(-18 10.5 9.1)" />
      <ellipse cx="21.5" cy="9.1" rx="3.15" ry="3.9" fill="currentColor" transform="rotate(18 21.5 9.1)" />
      <circle cx="16" cy="14.15" r="7.7" fill="currentColor" />
      <circle cx="13.15" cy="13.55" r="1.55" fill="var(--color-background)" />
      <circle cx="18.85" cy="13.55" r="1.55" fill="var(--color-background)" />
      <path
        d="M13.45 16.55c.95 1.2 4.15 1.2 5.1 0"
        stroke="var(--color-background)"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Painted nest-pal icon for chrome and the setup lockup. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={512}
      height={512}
      draggable={false}
      className={cn("rounded-xl ring-1 ring-border", className)}
    />
  );
}

export function Wordmark({ className, withVersion }: { className?: string; withVersion?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col leading-tight", className)}>
      <span className="font-semibold tracking-tight">{APP_NAME}</span>
      {withVersion ? <span className="text-[10px] font-medium text-muted-foreground">{APP_LINE}</span> : null}
    </span>
  );
}
