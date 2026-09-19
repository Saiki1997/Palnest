using Palnest.Core;

namespace Palnest.Tests;

public class ModsTests
{
    [Fact]
    public void ListingRoutesPakLuaAndSchema()
    {
        Assert.Equal(ModKind.Pak, Mods.GuessKindFromListing(["Foo_P.pak"]));
        Assert.Equal(ModKind.Ue4ss, Mods.GuessKindFromListing(["CoolMod/Scripts/main.lua", "CoolMod/enabled.txt"]));
        Assert.Equal(ModKind.PalSchema, Mods.GuessKindFromListing(["PalSchema/mods/Breeding/config.json"]));
        Assert.Equal(ModKind.Pak, Mods.GuessZipKind("MapUnlocker_P.pak"));
    }

    [Fact]
    public void BrokenModsDoNotBlockStart()
    {
        var mods = new[]
        {
            new InstalledMod { Id = "dead", Name = "Dead", Kind = ModKind.Ue4ss, Broken = true, FileCount = 0, Enabled = true, InstallPath = "Mods/Dead" },
        };
        Assert.Empty(Mods.BootConflicts(mods));
        Assert.Contains(Mods.RunChecker(mods), f => f.Kind == "broken" && f.Severity == "warn");
    }

    [Fact]
    public void OverlappingPaksAreStartConflicts()
    {
        var mods = new[]
        {
            new InstalledMod { Id = "a", Name = "One", Kind = ModKind.Pak, Enabled = true, InstallPath = @"Paks\~mods\Map.pak" },
            new InstalledMod { Id = "b", Name = "Two", Kind = ModKind.Pak, Enabled = true, InstallPath = @"Paks\~mods\Map.pak" },
        };
        Assert.NotEmpty(Mods.BootConflicts(mods));
    }

    [Fact]
    public void CrashBlameReadsUe4ssPath()
    {
        var mods = new[]
        {
            new InstalledMod { Id = "a", Name = "SafePak", Kind = ModKind.Pak, Enabled = true, InstallPath = @"Paks\~mods\Safe.pak" },
            new InstalledMod { Id = "b", Name = "BreedTweaks", Kind = ModKind.Ue4ss, Enabled = true, InstallPath = @"ue4ss\Mods\BreedTweaks" },
        };
        var blame = Mods.BlameCrash(mods, ["LogPal: loading", "[Lua] error in ue4ss/Mods/BreedTweaks/Scripts/main.lua: boom"]);
        Assert.Equal("b", blame?.ModId);
    }

    [Fact]
    public void CreateServerThenStart()
    {
        var store = new PalnestStore();
        var err = store.CreateServer("Yard");
        Assert.Null(err);
        Assert.Contains(store.Servers, s => s.Name == "Yard");
        Assert.Null(store.StartServer(store.Servers.First(s => s.Name == "Yard").Id));
        Assert.Equal(1, store.RunningCount);
    }
}
