namespace Palnest.Core;

public enum AppMode { Server, Client, Both }

public enum ModKind { Pak, Ue4ss, PalSchema, Ini, Framework }

public enum ModSource { Nexus, Steam, Curseforge, Local }

public sealed class ServerInstance
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..10];
    public string Name { get; set; } = "Palnest World";
    public bool Running { get; set; }
    public int Slot { get; set; }
    public int Port { get; set; } = 8211;
    public int QueryPort { get; set; } = 27015;
    public int RestPort { get; set; } = 8212;
    public int RconPort { get; set; } = 25575;
    public string WorldId { get; set; } = "";
    public string InstallPath { get; set; } = @"C:\PalServers\PalServer";
    public string Version { get; set; } = "1.0.5";
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? ListenAt { get; set; }
    public int? Pid { get; set; }
    public int MaxPlayers { get; set; } = 32;
    public List<PlayerInfo> Players { get; set; } = [];
    public List<string> Console { get; set; } = [];
}

public sealed class WorldInfo
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..10];
    public string Name { get; set; } = "Island";
    public bool Active { get; set; }
    public int Days { get; set; }
    public int SizeMb { get; set; } = 12;
    public int Guilds { get; set; }
}

public sealed class InstalledMod
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..10];
    public string Name { get; set; } = "";
    public string Author { get; set; } = "";
    public string Version { get; set; } = "1.0";
    public ModKind Kind { get; set; } = ModKind.Pak;
    public ModSource Source { get; set; } = ModSource.Local;
    public string SourceId { get; set; } = "";
    public string Url { get; set; } = "";
    public string Description { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public bool Broken { get; set; }
    public string InstallPath { get; set; } = "";
    public int FileCount { get; set; } = 1;
    public bool ServerCompatible { get; set; } = true;
    public List<CatalogFile> Files { get; set; } = [];
}

public sealed class CatalogMod
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Author { get; set; } = "";
    public string Version { get; set; } = "1.0";
    public ModKind Kind { get; set; }
    public ModSource Source { get; set; }
    public string SourceId { get; set; } = "";
    public string Url { get; set; } = "";
    public string Description { get; set; } = "";
    public int Downloads { get; set; }
    public bool ServerCompatible { get; set; } = true;
    public List<CatalogFile> Files { get; set; } = [];
}

public sealed class PlayerInfo
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Name { get; set; } = "";
    public string SteamId { get; set; } = "";
    public int Level { get; set; } = 1;
    public string Guild { get; set; } = "";
    public bool Online { get; set; }
}

public sealed class GuildInfo
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Name { get; set; } = "";
    public string Owner { get; set; } = "";
    public int Members { get; set; }
}

public sealed class BanEntry
{
    public string SteamId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Reason { get; set; } = "";
}

public sealed class PortConflict
{
    public string OtherId { get; set; } = "";
    public string OtherName { get; set; } = "";
    public int Port { get; set; }
    public string Label { get; set; } = "";
}

public sealed class CrashBlame
{
    public string ModId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Evidence { get; set; } = "";
}

public sealed class Finding
{
    public string Id { get; set; } = "";
    public string Severity { get; set; } = "warn";
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public string? ModId { get; set; }
}

public sealed class MetricSample
{
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public double Cpu { get; set; }
    public double RamGb { get; set; }
    public int Players { get; set; }
    public double DiskPct { get; set; }
    public double Fps { get; set; }
    public double HostRamPct { get; set; }
}

public sealed class CatalogFile
{
    public string Name { get; set; } = "";
    public string Size { get; set; } = "1.2 MB";
    public ModKind Kind { get; set; }
}

public sealed class FrameworkInfo
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Version { get; set; } = "";
    public bool Client { get; set; }
    public bool Server { get; set; }
}

public sealed class TunnelAgent
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public bool Installed { get; set; }
    public bool Running { get; set; }
    public string Endpoint { get; set; } = "";
    public string Note { get; set; } = "";
}

public sealed class SteamLatest
{
    public string Version { get; set; } = "1.0.5";
    public string Build { get; set; } = "";
    public bool Newer { get; set; }
    public string Note { get; set; } = "";
}

public sealed class LaunchArg
{
    public string Id { get; set; } = "";
    public string Flag { get; set; } = "";
    public string Value { get; set; } = "";
    public bool Enabled { get; set; }
    public string Note { get; set; } = "";
    public string Category { get; set; } = "";
}

public sealed class ServerVersion
{
    public string Version { get; set; } = "";
    public string Channel { get; set; } = "stable";
    public string Notes { get; set; } = "";
}
