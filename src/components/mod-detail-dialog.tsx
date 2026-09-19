import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { filesForHit, kindFolderNote } from "@/lib/mod-kind";
import { fetchModFiles } from "@/lib/releases";
import { kindLabel, sourceLabel } from "@/lib/paths";
import { useAppStore } from "@/lib/store";
import { cn, formatCount } from "@/lib/utils";
import type { InstallTarget, ModFileChoice, SearchHit } from "@/lib/types";

export function ModDetailDialog({
  hit,
  open,
  onOpenChange,
  defaultTarget,
}: {
  hit: SearchHit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTarget: InstallTarget;
}) {
  const keys = useAppStore((s) => s.keys);
  const mode = useAppStore((s) => s.mode);
  const installHit = useAppStore((s) => s.installHit);
  const [tab, setTab] = useState("page");
  const [files, setFiles] = useState<ModFileChoice[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [note, setNote] = useState("");
  const [frameFailed, setFrameFailed] = useState(false);

  useEffect(() => {
    if (!hit || !open) return;
    setTab("page");
    setFrameFailed(false);
    const local = filesForHit(hit);
    setFiles(local);
    setSelected(local[0]?.id ?? "");
    setNote("");
    let live = true;
    void fetchModFiles({
      data: {
        source: hit.source,
        sourceId: hit.sourceId,
        name: hit.name,
        kind: hit.kind,
        nexusKey: keys.nexus || undefined,
        curseforgeKey: keys.curseforge || undefined,
      },
    })
      .then((res) => {
        if (!live || !res.files.length) return;
        setFiles(res.files);
        setSelected(res.files[0]?.id ?? "");
        setNote(res.note ?? "");
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [hit, open, keys.nexus, keys.curseforge]);

  if (!hit) return null;
  const file = files.find((f) => f.id === selected) ?? files[0];

  function install(target: InstallTarget) {
    if (!hit || !file) return;
    installHit(hit, target, file);
    toast.success(`${file.name} → ${kindLabel(file.kind)} on ${target}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(calc(100%-1.5rem),960px)] max-h-[88vh] overflow-hidden p-0 sm:max-w-[960px]">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="pr-8">{hit.name}</DialogTitle>
            <DialogDescription>
              {hit.author} · {sourceLabel(hit.source)} · {hit.version}
            </DialogDescription>
          </DialogHeader>
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="px-5 pt-3">
              <TabsList>
                <TabsTrigger value="page">Page</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="page" className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{kindLabel(hit.kind)}</Badge>
                {hit.downloads > 0 ? <span>{formatCount(hit.downloads)} dl</span> : null}
                {!hit.serverCompatible ? <span>Client only</span> : null}
                <a
                  href={hit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open on {sourceLabel(hit.source)}
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{hit.description}</p>
              {hit.url && !frameFailed ? (
                <iframe
                  title={`${hit.name} store page`}
                  src={hit.url}
                  className="h-[min(52vh,420px)] w-full rounded-lg border border-border bg-muted"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  referrerPolicy="no-referrer"
                  onError={() => setFrameFailed(true)}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  The store page cannot embed here. Use Open on {sourceLabel(hit.source)}, then pick a file on the Files tab.
                </div>
              )}
            </TabsContent>
            <TabsContent value="files" className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <p className="mb-3 text-sm text-muted-foreground">
                {note || "Choose the archive Palnest should drop. PAK files go to ~mods. Lua / enabled.txt packs go to UE4SS Mods. PalSchema JSON goes under PalSchema/mods."}
              </p>
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(f.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left",
                        selected === f.id ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1 size-2.5 shrink-0 rounded-full",
                          selected === f.id ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.name}</span>
                          <Badge variant="outline">{kindLabel(f.kind)}</Badge>
                          {f.sizeKb ? <span className="text-xs text-muted-foreground">{f.sizeKb} KB</span> : null}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{f.note || kindFolderNote(f.kind)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => install(defaultTarget)} disabled={!file}>
                  Install {file ? kindLabel(file.kind) : ""} to {defaultTarget}
                </Button>
                {mode === "both" ? (
                  <>
                    <Button variant="outline" onClick={() => install("client")} disabled={!file}>
                      Client
                    </Button>
                    <Button variant="outline" onClick={() => install("server")} disabled={!file}>
                      Server
                    </Button>
                  </>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
