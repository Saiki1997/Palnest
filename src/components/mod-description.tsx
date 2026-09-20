import { useMemo } from "react";
import { markupToHtml } from "@/lib/mod-markup";
import { cn } from "@/lib/utils";

export function ModDescription({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => markupToHtml(text), [text]);
  if (!html) {
    return <p className="text-sm text-muted-foreground">No description from the store.</p>;
  }
  return (
    <div
      className={cn(
        "mod-desc max-w-3xl text-sm leading-relaxed text-muted-foreground",
        "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground",
        "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_h4]:mt-4 [&_h4]:mb-1.5 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-foreground",
        "[&_p]:mb-3 [&_p]:last:mb-0",
        "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:mb-1",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_img]:my-3 [&_img]:max-h-80 [&_img]:rounded-lg [&_img]:border [&_img]:border-border",
        "[&_hr]:my-4 [&_hr]:border-border",
        "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
