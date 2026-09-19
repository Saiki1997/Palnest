namespace Palnest.Core;

public static class Fleet
{
    public const int PortStride = 10;

    public static (int Port, int QueryPort, int RestPort, int RconPort) PortsForSlot(int slot)
    {
        var n = Math.Max(0, slot);
        return (8211 + n * PortStride, 27015 + n, 8212 + n * PortStride, 25575 + n);
    }

    public static int NextSlot(IEnumerable<ServerInstance> instances)
    {
        var used = instances.Select(i => i.Slot).ToHashSet();
        var slot = 0;
        while (used.Contains(slot)) slot++;
        return slot;
    }

    public static PortConflict? PortConflicts(IReadOnlyList<ServerInstance> instances, ServerInstance candidate, bool onlyRunning = true)
    {
        foreach (var other in instances)
        {
            if (other.Id == candidate.Id) continue;
            if (onlyRunning && !other.Running) continue;
            if (candidate.Port != 0 && other.Port == candidate.Port)
                return new PortConflict { OtherId = other.Id, OtherName = other.Name, Port = candidate.Port, Label = "game UDP" };
            if (candidate.QueryPort != 0 && other.QueryPort == candidate.QueryPort)
                return new PortConflict { OtherId = other.Id, OtherName = other.Name, Port = candidate.QueryPort, Label = "Steam query" };
            if (candidate.RestPort != 0 && other.RestPort == candidate.RestPort)
                return new PortConflict { OtherId = other.Id, OtherName = other.Name, Port = candidate.RestPort, Label = "REST" };
        }
        return null;
    }

    public static bool IsStalePortClaim(ServerInstance inst, DateTimeOffset? now = null)
    {
        if (!inst.Running) return true;
        if (inst.ListenAt is not null || inst.Pid is not null) return false;
        if (inst.StartedAt is null) return true;
        return (now ?? DateTimeOffset.UtcNow) - inst.StartedAt.Value > TimeSpan.FromSeconds(90);
    }

    public static ServerInstance? WorldBusy(IEnumerable<ServerInstance> instances, string worldId, string? exceptId = null)
    {
        if (string.IsNullOrWhiteSpace(worldId)) return null;
        return instances.FirstOrDefault(i => i.Id != exceptId && i.Running && i.WorldId == worldId);
    }

    public static string ExePath(ServerInstance inst, string fallbackRoot)
    {
        var root = (string.IsNullOrWhiteSpace(inst.InstallPath) ? fallbackRoot : inst.InstallPath).TrimEnd('\\', '/');
        return $"{root}\\PalServer.exe";
    }
}
