using Palnest.Core;

namespace Palnest.App;

/// <summary>Only samples host metrics while a PalServer is actually running.</summary>
public sealed class IdleTicker(PalnestStore store) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (store.RunningCount == 0) continue;
            store.Tick();
        }
    }
}
