using Palnest.App;
using Palnest.App.Components;
using Palnest.Core;

var builder = WebApplication.CreateBuilder(args);
var urls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (string.IsNullOrWhiteSpace(urls))
{
    urls = Environment.GetEnvironmentVariable("PALNEST_DESKTOP") == "1"
        ? "http://127.0.0.1:47821"
        : "http://0.0.0.0:8080";
}
builder.WebHost.UseUrls(urls);
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
