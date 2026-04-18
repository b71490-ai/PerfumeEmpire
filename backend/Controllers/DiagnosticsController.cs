using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;
using PerfumeEmpire.Authorization;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequirePermission(Permission.ViewReports)]
public class DiagnosticsController : ControllerBase
{
    private readonly IConnectionMultiplexer? _mux;
    private readonly IDatabase? _db;

    public DiagnosticsController(IConnectionMultiplexer? mux = null)
    {
        _mux = mux;
        if (_mux != null)
        {
            try { _db = _mux.GetDatabase(); } catch { _db = null; }
        }
    }

    [HttpGet("redis")]
    public IActionResult RedisStatus()
    {
        if (_mux == null || _db == null)
            return Ok(new { configured = false, message = "Redis not configured via DI" });

        try
        {
            var endpoints = _mux.GetEndPoints();
            var endpoint = endpoints.FirstOrDefault()?.ToString() ?? "unknown";
            // Ping
            var pong = _db.Ping();
            return Ok(new { configured = true, endpoint, pingMs = pong.TotalMilliseconds });
        }
        catch (Exception ex)
        {
            return Ok(new { configured = true, error = ex.Message });
        }
    }

    [HttpGet("redis/otp-keys")]
    public IActionResult ListOtpKeys()
    {
        if (_mux == null || _db == null)
            return BadRequest(new { message = "Redis not configured" });

        try
        {
            var endpoints = _mux.GetEndPoints();
            var server = _mux.GetServer(endpoints.First());
            var keys = server.Keys(pattern: "otp:*").Take(100).Select(k => k.ToString()).ToArray();
            var values = keys.ToDictionary(k => k, k => (string?)_db.StringGet(k));
            return Ok(new { count = keys.Length, keys = values });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Failed to list keys", error = ex.Message });
        }
    }
}
