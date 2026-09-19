using System.Text.RegularExpressions;

namespace Palnest.Core;

public static class Mods
{
    public static string KindFolder(ModKind kind) => kind switch
    {
        ModKind.Pak => @"Pal\Content\Paks\~mods",
        ModKind.PalSchema => @"Pal\Binaries\Win64\ue4ss\Mods\PalSchema\mods",
        ModKind.Ue4ss => @"Pal\Binaries\Win64\ue4ss\Mods",
        _ => @"Pal\Binaries\Win64",
    };

    public static ModKind GuessZipKind(string name)
    {
        var n = name.Replace('\\', '/').ToLowerInvariant();
        if (n.EndsWith(".pak") || n.EndsWith(".pak.off")) return ModKind.Pak;
        if (n.EndsWith(".lua")) return ModKind.Ue4ss;
        if (n.Contains("schema") || n.Contains("palschema")) return ModKind.PalSchema;
        if (n.Contains("pak") || n.EndsWith(".pak.zip")) return ModKind.Pak;
        if (n.Contains("lua") || n.Contains("ue4ss") || n.Contains("script")) return ModKind.Ue4ss;
        return ModKind.Ue4ss;
    }

    public static ModKind GuessKindFromListing(IEnumerable<string> paths, string fallbackName = "")
    {
        int pak = 0, lua = 0, schema = 0;
        foreach (var raw in paths)
        {
            var p = raw.Replace('\\', '/');
            if (Regex.IsMatch(p, @"\.pak(\.off)?$", RegexOptions.IgnoreCase) &&
                !Regex.IsMatch(p, "pakchunk", RegexOptions.IgnoreCase))
                pak++;
            if (Regex.IsMatch(p, @"scripts/main\.lua$|/enabled\.txt$|\.lua$", RegexOptions.IgnoreCase))
                lua++;
            if (Regex.IsMatch(p, "palschema|/mods/.+\\.json$", RegexOptions.IgnoreCase))
                schema++;
        }
        if (pak >= lua && pak >= schema && pak > 0) return ModKind.Pak;
        if (schema >= lua && schema > 0) return ModKind.PalSchema;
        if (lua > 0) return ModKind.Ue4ss;
        if (pak > 0) return ModKind.Pak;
        return GuessZipKind(fallbackName);
    }

    public static IReadOnlyList<Finding> BootConflicts(IEnumerable<InstalledMod> mods)
    {
        var live = mods.Where(m => m.Enabled).ToList();
        var findings = new List<Finding>();
        for (var i = 0; i < live.Count; i++)
        {
            for (var j = i + 1; j < live.Count; j++)
            {
                var a = live[i];
                var b = live[j];
                var aBase = Path.GetFileName(a.InstallPath.Replace('/', '\\')).ToLowerInvariant();
                var bBase = Path.GetFileName(b.InstallPath.Replace('/', '\\')).ToLowerInvariant();
                if (a.Kind == b.Kind && !string.IsNullOrEmpty(aBase) && aBase == bBase)
                {
                    findings.Add(new Finding
                    {
                        Id = $"conflict-{a.Id}-{b.Id}",
                        Severity = "error",
                        Kind = "conflict",
                        Title = $"Same {a.Kind} file",
                        Detail = $"{a.Name} and {b.Name} both land on {aBase}.",
                        ModId = a.Id,
                    });
                }
            }
        }
        return findings;
    }

    public static IReadOnlyList<Finding> RunChecker(IEnumerable<InstalledMod> mods)
    {
        var list = mods.ToList();
        var findings = BootConflicts(list).ToList();
        foreach (var mod in list)
        {
            if (mod.Broken || mod.FileCount <= 0)
            {
                findings.Add(new Finding
                {
                    Id = $"broken-{mod.Id}",
                    Severity = "warn",
                    Kind = "broken",
                    Title = $"{mod.Name} looks broken",
                    Detail = "PalServer can still start. If it crashes, Palnest will name this pack.",
                    ModId = mod.Id,
                });
            }
        }
        return findings;
    }

    public static CrashBlame? BlameCrash(IEnumerable<InstalledMod> mods, IEnumerable<string> lines)
    {
        var enabled = mods.Where(m => m.Enabled).ToList();
        var recent = lines.TakeLast(80).Reverse();
        foreach (var line in recent)
        {
            var m = Regex.Match(line, @"ue4ss[/\\]+mods[/\\]+([^/\\\s""'\]]+)", RegexOptions.IgnoreCase);
            if (!m.Success) m = Regex.Match(line, @"~mods[/\\]+([^/\\\s""'\]]+\.pak)", RegexOptions.IgnoreCase);
            if (!m.Success) continue;
            var token = Regex.Replace(m.Groups[1].Value, "[^a-zA-Z0-9]+", "").ToLowerInvariant();
            if (token.Length < 4) continue;
            var hit = enabled.FirstOrDefault(x =>
                Regex.Replace(x.Name, "[^a-zA-Z0-9]+", "").ToLowerInvariant().Contains(token) ||
                token.Contains(Regex.Replace(x.Name, "[^a-zA-Z0-9]+", "").ToLowerInvariant()));
            if (hit is not null)
                return new CrashBlame { ModId = hit.Id, Name = hit.Name, Evidence = line };
        }
        var broken = enabled.LastOrDefault(m => m.Broken) ?? enabled.LastOrDefault(m => m.Kind == ModKind.Ue4ss);
        return broken is null ? null : new CrashBlame { ModId = broken.Id, Name = broken.Name, Evidence = "Watchdog trip" };
    }

    public static IReadOnlyList<CatalogMod> Catalog { get; } =
    [
        new() { Id = "nx-palschema", Name = "Pal Schema", Author = "Okaetsu", Kind = ModKind.PalSchema, Source = ModSource.Nexus, SourceId = "1018", Url = "https://www.nexusmods.com/palworld/mods/1018", Description = "JSON-driven Palworld data packs.", Downloads = 180000, Version = "0.4" },
        new() { Id = "nx-mapunlock", Name = "Map Revealer", Author = "community", Kind = ModKind.Pak, Source = ModSource.Nexus, SourceId = "524", Url = "https://www.nexusmods.com/palworld/mods/524", Description = "Unlocks the world map.", Downloads = 220000, Version = "1.2" },
        new() { Id = "st-breed", Name = "Breed Tweaks", Author = "Workshop", Kind = ModKind.Ue4ss, Source = ModSource.Steam, SourceId = "3456789", Url = "https://steamcommunity.com/sharedfiles/filedetails/?id=3456789", Description = "UE4SS Lua breeding helpers.", Downloads = 41000, Version = "workshop" },
        new() { Id = "cf-perf", Name = "Performance Pak", Author = "CurseForge", Kind = ModKind.Pak, Source = ModSource.Curseforge, SourceId = "perf", Url = "https://www.curseforge.com/", Description = "LOD and draw-distance pak for dedicated hosts.", Downloads = 9000, Version = "1.0" },
        new() { Id = "nx-admin", Name = "Server Admin", Author = "community", Kind = ModKind.Ue4ss, Source = ModSource.Nexus, SourceId = "2011", Url = "https://www.nexusmods.com/palworld/mods/2011", Description = "In-game admin slash commands.", Downloads = 64000, Version = "2.1" },
        new() { Id = "nx-death", Name = "Death Cache", Author = "community", Kind = ModKind.Ue4ss, Source = ModSource.Nexus, SourceId = "880", Url = "https://www.nexusmods.com/palworld/mods/880", Description = "Recoverable cache on death.", Downloads = 33000, Version = "1.4" },
    ];
}
