using Palnest.App;
using Palnest.App.Components;
using Palnest.Core;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://0.0.0.0:8080");
builder.Logging.SetMinimumLevel(LogLevel.Warning);

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
builder.Services.AddSingleton<PalnestStore>();
builder.Services.AddHostedService<IdleTicker>();
builder.Services.Configure<Microsoft.AspNetCore.Components.Server.CircuitOptions>(o =>
{
    o.DisconnectedCircuitRetentionPeriod = TimeSpan.FromSeconds(20);
    o.JSInteropDefaultCallTimeout = TimeSpan.FromSeconds(8);
    o.DetailedErrors = false;
});

var app = builder.Build();
app.UseExceptionHandler("/Error", createScopeForErrors: true);
app.UseStaticFiles();
app.UseAntiforgery();
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();
