namespace Palnest.Core;

public sealed class PalnestStore
{
    public const string Version = "2.2.0";
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
    public AppMode Mode { get; private set; } = AppMode.Both;
    public bool AutoBackup { get; set; } = true;
    public bool CrashWatchdog { get; set; } = true;
    public string LastMessage { get; private set; } = "";
    public string ClientPath { get; set; } = @"C:\Program Files (x86)\Steam\steamapps\common\Palworld";
    public string ServerPath { get; set; } = @"C:\PalServers\PalServer";
    public string SteamCmdPath { get; set; } = @"C:\steamcmd";
    public string BackupPath { get; set; } = @"C:\Palnest\Backups";
    public int BackupMinutes { get; set; } = 60;
    public bool RestartOn { get; set; }
    public int RestartHours { get; set; } = 12;
    public bool CaptureConsole { get; set; } = true;
    public bool CheckModUpdates { get; set; } = true;
    public bool FirewallOpen { get; set; }
    public bool Autostart { get; set; }
    public bool Tray { get; set; } = true;
    public string NexusKey { get; set; } = "";
    public string SteamKey { get; set; } = "";
    public string CurseforgeKey { get; set; } = "";
    public int CpuThreshold { get; set; } = 85;
    public int RamThreshold { get; set; } = 90;
    public int DiskThreshold { get; set; } = 90;
    public int FpsThreshold { get; set; } = 20;
    public SteamLatest? SteamLatest { get; private set; }
    public List<FrameworkInfo> Frameworks { get; } = [];
    public List<TunnelAgent> Tunnels { get; } = [];
    public List<LaunchArg> LaunchArgs { get; } = DefaultArgs();
    public List<string> VersionHistory { get; } = ["1.0.5"];
    public string ActivePreset { get; private set; } = "community";
    public bool ShowServer => Mode != AppMode.Client;
    public bool ShowClient => Mode != AppMode.Server;
    public string ModeLabel => Mode switch
    {
        AppMode.Server => "Server only",
        AppMode.Client => "Client only",
        _ => "Server + client",
    };

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
            SourceId = "524",
            InstallPath = @"Pal\Content\Paks\~mods\MapRevealer_P.pak",
            Description = "Unlocks the world map.",
        });
        Frameworks.Add(new FrameworkInfo { Id = "ue4ss", Name = "UE4SS", Version = "3.0.1 Palworld" });
        Frameworks.Add(new FrameworkInfo { Id = "palschema", Name = "PalSchema", Version = "0.4" });
        Tunnels.Add(new TunnelAgent { Id = "portwarp", Name = "PortWarp", Installed = true, Running = true, Endpoint = "pwrp.example:8211", Note = "pwrp.exe detected" });
        Tunnels.Add(new TunnelAgent { Id = "playit", Name = "playit.gg", Installed = true, Running = false, Note = "playit.exe installed, idle" });
        _samples.Add(new MetricSample { Cpu = 4, RamGb = 2.4, DiskPct = 41, HostRamPct = 15, Fps = 0 });
        Log("ok", "Palnest 2.2 ready. Create a server from the dashboard.");
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

    public void SetMode(AppMode mode)
    {
        lock (_gate)
        {
            Mode = mode;
            Log("ok", $"Mode: {ModeLabel}.");
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
            inst.Console.Add($"[PALNEST] {inst.Name} starting {Fleet.ExePath(inst, ServerPath)}");
            inst.Console.Add($"Running Palworld dedicated server on :{inst.Port}");
            inst.Console.Add($"[PALNEST] bound UDP {inst.Port}");
            foreach (var p in Players)
            {
                p.Online = p.Name == "Gridlord";
                if (p.Online && !inst.Players.Any(x => x.Id == p.Id))
                    inst.Players.Add(p);
            }
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

    public void InstallCatalog(CatalogMod hit, CatalogFile? file = null)
    {
        lock (_gate)
        {
            var kind = file?.Kind ?? hit.Kind;
            var name = file is null ? hit.Name : Path.GetFileNameWithoutExtension(file.Name);
            if (InstalledMods.Any(m => m.Name == name && m.Source == hit.Source && m.Kind == kind))
            {
                Log("warn", $"{name} is already in the world.");
                Notify();
                return;
            }
            InstalledMods.Add(new InstalledMod
            {
                Name = name,
                Author = hit.Author,
                Version = hit.Version,
                Kind = kind,
                Source = hit.Source,
                SourceId = hit.SourceId,
                Url = hit.Url,
                Description = hit.Description,
                InstallPath = $"{Mods.KindFolder(kind)}\\{Sanitize(name)}{(kind == ModKind.Pak ? "_P.pak" : "")}",
                FileCount = file is null ? Math.Max(1, hit.Files.Count) : 1,
                ServerCompatible = hit.ServerCompatible,
            });
            Log("ok", $"Installed {name} as {kind} → {Mods.KindFolder(kind)}.");
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

    public (int Started, int Skipped) StartAll()
    {
        var started = 0;
        var skipped = 0;
        foreach (var s in Servers.ToList())
        {
            if (s.Running) continue;
            var err = StartServer(s.Id);
            if (err is null) started++;
            else skipped++;
        }
        return (started, skipped);
    }

    public int StopAll()
    {
        var n = 0;
        foreach (var s in Servers.Where(x => x.Running).ToList())
        {
            StopServer(s.Id);
            n++;
        }
        return n;
    }

    public void ToggleFirewall()
    {
        FirewallOpen = !FirewallOpen;
        Log("ok", FirewallOpen
            ? "Firewall opened UDP 8211 / 27015 for PalServer."
            : "Firewall rules for PalServer closed.");
        Notify();
    }

    public void SetBackupMinutes(int minutes)
    {
        BackupMinutes = minutes;
        Log("ok", $"Backup interval: every {minutes} min.");
        Notify();
    }

    public void SetRestartHours(int hours)
    {
        RestartHours = hours;
        Log("ok", $"Restart schedule: every {hours} h.");
        Notify();
    }

    public void BackupNow()
    {
        var inst = Active;
        Log("ok", inst is null
            ? $"Snapshot written to {BackupPath}."
            : $"Snapshot of {inst.Name} written to {BackupPath}\\{Sanitize(inst.Name)}.");
        Notify();
    }

    public void CheckSteamLatest()
    {
        var current = Active?.Version ?? "1.0.5";
        SteamLatest = new SteamLatest
        {
            Version = "1.0.5",
            Build = "2394011",
            Newer = false,
            Note = $"api.steamcmd.net · Palworld dedicated 2394010 is {current}. No later public build.",
        };
        Log("ok", SteamLatest.Note);
        Notify();
    }

    public void UpdateServer(string version)
    {
        lock (_gate)
        {
            var inst = Active;
            if (inst is null) return;
            VersionHistory.Add(version);
            inst.Version = version;
            Log("ok", $"{inst.Name} moved to {version} via SteamCMD 2394010.");
        }
        Notify();
    }

    public void RollbackServer()
    {
        lock (_gate)
        {
            var inst = Active;
            if (inst is null || VersionHistory.Count < 2) return;
            var prev = VersionHistory[^2];
            inst.Version = prev;
            Log("ok", $"{inst.Name} rolled back to {prev} via SteamCMD.");
        }
        Notify();
    }

    public void ScanTunnels()
    {
        foreach (var t in Tunnels)
        {
            t.Installed = true;
            if (t.Id == "portwarp") { t.Running = true; t.Note = "pwrp.exe running"; t.Endpoint = "pwrp.example:8211"; }
            if (t.Id == "playit") { t.Running = false; t.Note = "playit.exe installed, idle"; }
        }
        Log("ok", "PortWarp running · playit.gg installed.");
        Notify();
    }

    public void StartTunnel(string id)
    {
        var t = Tunnels.FirstOrDefault(x => x.Id == id);
        if (t is null) return;
        t.Installed = true;
        t.Running = true;
        t.Endpoint = id == "playit" ? "hollow-isle.gl.at.ply.gg:30051" : "pwrp.example:8211";
        t.Note = $"{t.Name} tunnel online.";
        Log("ok", t.Note);
        Notify();
    }

    public void StopTunnel(string id)
    {
        var t = Tunnels.FirstOrDefault(x => x.Id == id);
        if (t is null) return;
        t.Running = false;
        t.Note = $"{t.Name} stopped.";
        Log("info", t.Note);
        Notify();
    }

    public void InstallFramework(string id, bool serverSide)
    {
        var fw = Frameworks.FirstOrDefault(f => f.Id == id);
        if (fw is null) return;
        if (serverSide) fw.Server = true;
        else fw.Client = true;
        Log("ok", $"{fw.Name} {fw.Version} installed on {(serverSide ? "dedicated" : "client")}.");
        Notify();
    }

    public void ApplyPreset(string id)
    {
        ActivePreset = id;
        ApplyEnginePreset(id switch
        {
            "heavy" or "packed" => "heavy",
            "mods" => "mods",
            "network" => "network",
            "perf" => "perf",
            _ => "community",
        });
        foreach (var a in LaunchArgs)
        {
            if (a.Id is "useperfthreads" or "noasync" or "mt") a.Enabled = true;
            if (a.Id == "workers") a.Enabled = id is "community" or "packed" or "heavy" or "mods" or "perf";
            if (a.Id == "publiclobby") a.Enabled = id is "community" or "packed";
        }
        Log("ok", $"Applied {id} optimize preset.");
        Notify();
    }

    public void ToggleArg(string id)
    {
        var a = LaunchArgs.FirstOrDefault(x => x.Id == id);
        if (a is null) return;
        a.Enabled = !a.Enabled;
        Notify();
    }

    public string CommandLine(ServerInstance inst)
    {
        var parts = new List<string> { Fleet.ExePath(inst, ServerPath) };
        foreach (var a in LaunchArgs.Where(x => x.Enabled))
        {
            var flag = a.Flag == "EpicApp" ? $"EpicApp={a.Value}" : a.Flag;
            if (a.Id == "port") parts.Add($"{a.Flag}={inst.Port}");
            else if (a.Id == "queryport") parts.Add($"{a.Flag}={inst.QueryPort}");
            else if (!string.IsNullOrEmpty(a.Value) && a.Flag != "EpicApp") parts.Add($"{flag}={a.Value}");
            else parts.Add(flag);
        }
        return string.Join(" ", parts);
    }

    public void ApplyEnginePreset(string id)
    {
        lock (_gate)
        {
            EngineLines = id switch
            {
                "heavy" or "packed" =>
                [
                    "[/Script/Engine.Engine]",
                    "bUseFixedFrameRate=True",
                    "FixedFrameRate=30.000000",
                    "bSmoothFrameRate=False",
                    "[/Script/Engine.StreamingSettings]",
                    "s.AsyncLoadingThreadEnabled=False",
                    "s.AsyncLoadingTimeLimit=4.0",
                    "s.LevelStreamingActorsUpdateTimeLimit=1.0",
                    "[/Script/Engine.GarbageCollectionSettings]",
                    "gc.MaxObjectsInGame=100000",
                ],
                "mods" =>
                [
                    "[/Script/Engine.Engine]",
                    "bUseFixedFrameRate=True",
                    "FixedFrameRate=30.000000",
                    "[/Script/Engine.StreamingSettings]",
                    "s.AsyncLoadingThreadEnabled=False",
                    "s.AsyncLoadingTimeLimit=2.0",
                    "s.LevelStreamingActorsUpdateTimeLimit=0.5",
                    "s.UnregisterComponentsTimeLimit=0.5",
                    "[/Script/Engine.RendererSettings]",
                    "r.Streaming.PoolSize=800",
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
                    "KeepAliveTime=20",
                ],
                "perf" => DefaultEngine(),
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
            _samples.Add(new MetricSample
            {
                Cpu = Math.Round(cpu, 1),
                RamGb = Math.Round(ram, 1),
                Players = OnlinePlayers,
                DiskPct = 41 + Random.Shared.NextDouble() * 4,
                Fps = 28 + Random.Shared.NextDouble() * 3,
                HostRamPct = Math.Round(ram / 16 * 100, 1),
            });
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
        "[/Script/Engine.StreamingSettings]",
        "s.AsyncLoadingThreadEnabled=False",
    ];

    static List<LaunchArg> DefaultArgs() =>
    [
        new() { Id = "useperfthreads", Flag = "-useperfthreads", Enabled = true, Note = "Dedicated-server thread pool.", Category = "threading" },
        new() { Id = "noasync", Flag = "-NoAsyncLoadingThread", Enabled = true, Note = "Stops hitch on dedicated.", Category = "threading" },
        new() { Id = "mt", Flag = "-UseMultithreadForDS", Enabled = true, Note = "Spreads AI and building sim.", Category = "threading" },
        new() { Id = "workers", Flag = "-NumberOfWorkerThreadsServer", Value = "4", Enabled = false, Note = "Cap workers to cores minus two.", Category = "threading" },
        new() { Id = "port", Flag = "-port", Value = "8211", Enabled = true, Note = "Listen port.", Category = "network" },
        new() { Id = "queryport", Flag = "-queryport", Value = "27015", Enabled = true, Note = "Steam query.", Category = "network" },
        new() { Id = "players", Flag = "-players", Value = "32", Enabled = true, Note = "Hard cap.", Category = "network" },
        new() { Id = "publiclobby", Flag = "-publiclobby", Enabled = false, Note = "Community list.", Category = "community" },
        new() { Id = "log", Flag = "-log", Enabled = true, Note = "Write PalServer logs.", Category = "logging" },
        new() { Id = "epic", Flag = "EpicApp", Value = "PalServer", Enabled = true, Note = "Required for Steam dedicated.", Category = "community" },
    ];
}
