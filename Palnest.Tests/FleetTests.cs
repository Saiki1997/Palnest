using Palnest.Core;

namespace Palnest.Tests;

public class FleetTests
{
    [Fact]
    public void SlotsNeverCollideGameAndRest()
    {
        var a = Fleet.PortsForSlot(0);
        var b = Fleet.PortsForSlot(1);
        Assert.Equal(8211, a.Port);
        Assert.Equal(8212, a.RestPort);
        Assert.Equal(8221, b.Port);
        Assert.NotEqual(a.Port, b.Port);
        Assert.Equal(2, Fleet.NextSlot([new ServerInstance { Slot = 0 }, new ServerInstance { Slot = 1 }]));
    }

    [Fact]
    public void RunningWorldsCannotShareUdp()
    {
        var a = Fleet.PortsForSlot(0);
        var b = Fleet.PortsForSlot(1);
        var fleet = new List<ServerInstance>
        {
            new() { Id = "hollow", Name = "Hollow", Running = true, Port = a.Port, QueryPort = a.QueryPort, RestPort = a.RestPort },
            new() { Id = "yard", Name = "Yard", Port = b.Port, QueryPort = b.QueryPort, RestPort = b.RestPort },
        };
        var clash = Fleet.PortConflicts(fleet, new ServerInstance { Id = "yard", Port = a.Port, QueryPort = b.QueryPort, RestPort = b.RestPort }, onlyRunning: true);
        Assert.NotNull(clash);
        Assert.Equal(8211, clash!.Port);
        Assert.Null(Fleet.PortConflicts(fleet, new ServerInstance { Id = "yard", Port = b.Port, QueryPort = b.QueryPort, RestPort = b.RestPort }, onlyRunning: true));
    }

    [Fact]
    public void StoppedWorldsDoNotHoldAPort()
    {
        var fleet = new List<ServerInstance>
        {
            new() { Id = "hollow", Name = "Hollow", Running = false, Port = 8211 },
            new() { Id = "yard", Name = "Yard", Port = 8211 },
        };
        Assert.Null(Fleet.PortConflicts(fleet, fleet[1], onlyRunning: true));
        Assert.True(Fleet.IsStalePortClaim(new ServerInstance { Running = false }));
        Assert.False(Fleet.IsStalePortClaim(new ServerInstance { Running = true, Pid = 44, ListenAt = DateTimeOffset.UtcNow }));
    }

    [Fact]
    public void ExeIsPalServerInInstallFolder()
    {
        var inst = new ServerInstance { InstallPath = @"C:\PalServers\HollowIsle" };
        Assert.Equal(@"C:\PalServers\HollowIsle\PalServer.exe", Fleet.ExePath(inst, @"C:\other"));
    }
}
