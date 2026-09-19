namespace Palnest.Core;

public sealed class PalnestStore
{
    public const string Version = "2.1.0";
    public const string Edition = "Palworld Server & Mod Manager";

    readonly object _gate = new();
    readonly List<MetricSample> _samples = [];

    public List<ServerInstance> Servers { get; } = [];
    public List<WorldInfo> Worlds { get; } = [];
    public List<InstalledMod> InstalledMods { get; } = [];
    public List<PlayerInfo> Players { get; } = [];
    public List<GuildInfo> Guilds { get; } = [];
    public List<BanEntry> Bans { get; } = [];
    public List<string> Logs { get; } = [];
    public List<string> EngineLines { get; set; } = DefaultEngine();
    public string ActiveServerId { get; private set; } = "";
    public bool AutoBackup { get; set; } = true;
    public bool CrashWatchdog { get; set; } = true;
    public string LastMessage { get; private set; } = "";

    public event Action? Changed;

    public PalnestStore()
    {
        var world = new WorldInfo { Name = "Hollow Isle", Active = true, Days = 14, SizeMb = 86, Guilds = 1 };
        Worlds.Add(world);
        var ports = Fleet.PortsForSlot(0);
        var server = new ServerInstance
        {
            Name = "Hollow Isle",
            Slot = 0,
            Port = ports.Port,
            QueryPort = ports.QueryPort,
            RestPort = ports.RestPort,
            RconPort = ports.RconPort,
            WorldId = world.Id,
            InstallPath = @"C:\PalServers\HollowIsle",
        };
        Servers.Add(server);
        ActiveServerId = server.Id;
        Players.Add(new PlayerInfo { Name = "Gridlord", SteamId = "76561198000000001", Level = 42, Guild = "Palnest", Online = false });
        Guilds.Add(new GuildInfo { Name = "Palnest", Owner = "Gridlord", Members = 1 });
        InstalledMods.Add(new InstalledMod
        {
            Name = "Map Revealer",
            Author = "community",
            Kind = ModKind.Pak,
            Source = ModSource.Nexus,
            InstallPath = @"Pal\Content\Paks\~mods\MapRevealer_P.pak",
            Description = "Unlocks the world map.",
        });
        Log("ok", "Palnest 2.0 ready. Create a server from the dashboard.");
    }

    public ServerInstance? Active => Servers.FirstOrDefault(s => s.Id == ActiveServerId) ?? Servers.FirstOrDefault();
    public int RunningCount => Servers.Count(s => s.Running);
    public int OnlinePlayers => Servers.Sum(s => s.Players.Count(p => p.Online));
    public IReadOnlyList<MetricSample> Samples
    {
        get { lock (_gate) return _samples.ToArray(); }
    }

    public string? CreateServer(string name, string? installPath = null)
    {
        lock (_gate)
        {
            name = string.IsNullOrWhiteSpace(name) ? "New world" : name.Trim();
            if (Servers.Any(s => s.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
                return "A world with that name already exists.";
            var slot = Fleet.NextSlot(Servers);
            var ports = Fleet.PortsForSlot(slot);
            var world = new WorldInfo { Name = $"{name} World", Active = false };
            Worlds.Add(world);
            var inst = new ServerInstance
            {
                Name = name,
                Slot = slot,
                Port = ports.Port,
                QueryPort = ports.QueryPort,
                RestPort = ports.RestPort,
                RconPort = ports.RconPort,
                WorldId = world.Id,
                InstallPath = string.IsNullOrWhiteSpace(installPath)
                    ? $@"C:\PalServers\{Sanitize(name)}"
                    : installPath.Trim(),
            };
            var clash = Fleet.PortConflicts(Servers, inst, onlyRunning: true);
            if (clash is not null)
                return $"Port {clash.Port} is in use by {clash.OtherName}.";
            Servers.Add(inst);
            ActiveServerId = inst.Id;
            Log("ok", $"Created {name} on UDP {inst.Port}.");
        }
        Notify();
        return null;
    }

    public string? ImportServer(string path, string name)
    {
        var err = CreateServer(name, path);
        if (err is null) Log("ok", $"Imported PalServer from {path}.");
        Notify();
        return err;
    }

    public void SelectServer(string id)
    {
        lock (_gate)
        {
            if (Servers.Any(s => s.Id == id)) ActiveServerId = id;
        }
        Notify();
    }

    public string? StartServer(string? id = null)
    {
        lock (_gate)
        {
            var inst = Servers.FirstOrDefault(s => s.Id == (id ?? ActiveServerId));
            if (inst is null) return "No dedicated server in this world.";
            if (inst.Running) return null;
            var blockers = Mods.BootConflicts(InstalledMods);
            if (blockers.Count > 0)
            {
                LastMessage = $"Mod conflict blocks start: {blockers[0].Title}.";
                Log("error", LastMessage);
                Notify();
                return LastMessage;
            }
            var clash = Fleet.PortConflicts(Servers, inst, onlyRunning: true);
            if (clash is not null)
            {
                var other = Servers.FirstOrDefault(s => s.Id == clash.OtherId);
                if (other is not null && Fleet.IsStalePortClaim(other))
                {
                    StopLocked(other);
                    Log("warn", $"UDP {clash.Port} was assigned to {clash.OtherName} but nothing is bound. Forcing it.");
                }
                else
                {
                    LastMessage = $"UDP {clash.Port} is already used by {clash.OtherName}.";
                    Log("error", LastMessage);
                    Notify();
                    return LastMessage;
                }
            }
            var busy = Fleet.WorldBusy(Servers, inst.WorldId, inst.Id);
            if (busy is not null)
            {
                LastMessage = $"{busy.Name} is already running the same world.";
                Log("error", LastMessage);
                Notify();
                return LastMessage;
            }
            inst.Running = true;
            inst.StartedAt = DateTimeOffset.UtcNow;
            inst.ListenAt = DateTimeOffset.UtcNow;
            inst.Pid = 40000 + Random.Shared.Next(999);
            inst.Console.Add($"[PALNEST] {inst.Name} starting PalServer.exe in {inst.InstallPath}");
            inst.Console.Add($"Running Palworld dedicated server on :{inst.Port}");
            inst.Console.Add($"[PALNEST] bound UDP {inst.Port}");
            Log("ok", $"{inst.Name} started on UDP {inst.Port} via PalServer.exe.");
        }
        Notify();
        return null;
    }

    public void StopServer(string? id = null)
    {
        lock (_gate)
        {
            var inst = Servers.FirstOrDefault(s => s.Id == (id ?? ActiveServerId));
            if (inst is null) return;
            StopLocked(inst);
            Log("info", $"{inst.Name} stopped. World saved.");
        }
        Notify();
    }

    public void InstallCatalog(CatalogMod hit)
    {
        lock (_gate)
        {
            if (InstalledMods.Any(m => m.Name == hit.Name && m.Source == hit.Source))
            {
                Log("warn", $"{hit.Name} is already in the world.");
                Notify();
                return;
            }
            InstalledMods.Add(new InstalledMod
            {
                Name = hit.Name,
                Author = hit.Author,
                Version = hit.Version,
                Kind = hit.Kind,
                Source = hit.Source,
                SourceId = hit.SourceId,
                Url = hit.Url,
                Description = hit.Description,
                InstallPath = $"{Mods.KindFolder(hit.Kind)}\\{Sanitize(hit.Name)}",
            });
            Log("ok", $"Installed {hit.Name} as {hit.Kind} → {Mods.KindFolder(hit.Kind)}.");
        }
        Notify();
    }

    public void ToggleMod(string id)
    {
        lock (_gate)
        {
            var mod = InstalledMods.FirstOrDefault(m => m.Id == id);
            if (mod is null) return;
            mod.Enabled = !mod.Enabled;
            Log("info", $"{mod.Name} {(mod.Enabled ? "enabled" : "disabled")}.");
        }
        Notify();
    }

    public void Kick(string playerId)
    {
        lock (_gate)
        {
            foreach (var s in Servers)
                s.Players.RemoveAll(p => p.Id == playerId || p.SteamId == playerId);
            Players.ForEach(p => { if (p.Id == playerId || p.SteamId == playerId) p.Online = false; });
            Log("ok", $"Kicked {playerId}.");
        }
        Notify();
    }

    public void Ban(string playerId, string reason)
    {
        lock (_gate)
        {
            var p = Players.FirstOrDefault(x => x.Id == playerId || x.SteamId == playerId);
            Bans.Add(new BanEntry { SteamId = p?.SteamId ?? playerId, Name = p?.Name ?? playerId, Reason = reason });
        }
        Kick(playerId);
        Log("ok", $"Banned {playerId}.");
        Notify();
    }

    public void AddGuild(string name)
    {
        lock (_gate)
        {
            if (Guilds.Any(g => g.Name.Equals(name, StringComparison.OrdinalIgnoreCase))) return;
            Guilds.Add(new GuildInfo { Name = name, Owner = "admin", Members = 0 });
            var world = Worlds.FirstOrDefault(w => w.Active) ?? Worlds.FirstOrDefault();
            if (world is not null) world.Guilds = Guilds.Count;
            Log("ok", $"Guild {name} created.");
        }
        Notify();
    }

    public void RemoveGuild(string id)
    {
        lock (_gate)
        {
            Guilds.RemoveAll(g => g.Id == id);
            Log("ok", "Guild removed.");
        }
        Notify();
    }

    public void AssignPlayerToGuild(string playerId, string guildName)
    {
        lock (_gate)
        {
            var p = Players.FirstOrDefault(x => x.Id == playerId);
            if (p is null) return;
            p.Guild = guildName;
            foreach (var g in Guilds)
                g.Members = Players.Count(x => x.Guild == g.Name);
            Log("ok", $"{p.Name} → {guildName}.");
        }
        Notify();
    }

    public void ApplyEnginePreset(string id)
    {
        lock (_gate)
        {
            EngineLines = id switch
            {
                "heavy" =>
                [
                    "[/Script/Engine.Engine]",
                    "bUseFixedFrameRate=True",
                    "FixedFrameRate=30.000000",
                    "[/Script/Engine.GarbageCollectionSettings]",
                    "gc.MaxObjectsInGame=100000",
                ],
                "network" =>
                [
                    "[/Script/Engine.Player]",
                    "ConfiguredInternetSpeed=100000",
                    "ConfiguredLanSpeed=100000",
                    "[/Script/OnlineSubsystemUtils.IpNetDriver]",
                    "NetServerMaxTickRate=30",
                    "MaxClientRate=100000",
                    "MaxInternetClientRate=100000",
                ],
                _ => DefaultEngine(),
            };
            Log("ok", $"Applied {id} engine preset. Write Engine.ini from Optimize.");
        }
        Notify();
    }

    public void Tick()
    {
        lock (_gate)
        {
            if (RunningCount == 0) return;
            var cpu = 8 + Random.Shared.NextDouble() * 18;
            var ram = 3.2 + Random.Shared.NextDouble() * 1.4;
            _samples.Add(new MetricSample { Cpu = Math.Round(cpu, 1), RamGb = Math.Round(ram, 1), Players = OnlinePlayers });
            if (_samples.Count > 90) _samples.RemoveRange(0, _samples.Count - 90);
        }
        Notify();
    }

    void StopLocked(ServerInstance inst)
    {
        inst.Running = false;
        inst.StartedAt = null;
        inst.ListenAt = null;
        inst.Pid = null;
        inst.Players.Clear();
    }

    void Log(string level, string message)
    {
        LastMessage = message;
        Logs.Insert(0, $"[{DateTime.Now:HH:mm:ss}] {level}  {message}");
        if (Logs.Count > 80) Logs.RemoveRange(80, Logs.Count - 80);
    }

    void Notify() => Changed?.Invoke();

    static string Sanitize(string name) =>
        string.Concat(name.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_')) is { Length: > 0 } s ? s : "PalnestWorld";

    static List<string> DefaultEngine() =>
    [
        "[/Script/Engine.Engine]",
        "bUseFixedFrameRate=True",
        "FixedFrameRate=30.000000",
        "bSmoothFrameRate=False",
        "[/Script/Engine.RendererSettings]",
        "r.VSync=0",
        "r.OneFrameThreadLag=0",
    ];
}
