using Microsoft.AspNetCore.Mvc;
using PerfumeEmpire.Authorization;
using PerfumeEmpire.DTOs;
using PerfumeEmpire.Services;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/admin/zatca")]
public class ZatcaController : ControllerBase
{
    private readonly IZatcaService _zatca;

    public ZatcaController(IZatcaService zatca)
    {
        _zatca = zatca;
    }

    [HttpGet("config")]
    [RequirePermission(Permission.ManageUsers)]
    public IActionResult GetConfig()
    {
        var config = _zatca.GetAdminConfig();
        return Ok(config);
    }

    [HttpPut("config")]
    [RequirePermission(Permission.ManageUsers)]
    public IActionResult UpdateConfig([FromBody] ZatcaConfigDto dto)
    {
        var updated = _zatca.UpdateAdminConfig(dto);
        return Ok(updated);
    }

    [HttpGet("readiness")]
    [RequirePermission(Permission.ViewReports)]
    public IActionResult GetReadiness()
    {
        var report = _zatca.GetReadiness();
        return Ok(report);
    }

    [HttpGet("invoice/{orderId:int}/preview")]
    [RequirePermission(Permission.ViewReports)]
    public async Task<IActionResult> PreviewInvoice(int orderId, CancellationToken cancellationToken)
    {
        var result = await _zatca.BuildInvoicePackageAsync(orderId, cancellationToken);
        if (!result.Ok)
        {
            return BadRequest(new { message = result.Error ?? "Failed to build invoice package." });
        }

        return Ok(result.Package);
    }

    [HttpGet("invoice/{orderId:int}/validate")]
    [RequirePermission(Permission.ViewReports)]
    public async Task<IActionResult> ValidateInvoice(int orderId, CancellationToken cancellationToken)
    {
        var result = await _zatca.ValidateInvoiceAsync(orderId, cancellationToken);
        if (!result.Ok)
        {
            return BadRequest(new { message = result.Error ?? "Failed to validate invoice package." });
        }

        return Ok(result.Report);
    }

    [HttpPost("invoice/{orderId:int}/submit-sandbox")]
    [RequirePermission(Permission.ViewReports)]
    public async Task<IActionResult> SubmitSandbox(int orderId, CancellationToken cancellationToken)
    {
        var result = await _zatca.SubmitSandboxAsync(orderId, cancellationToken);
        if (!result.Ok)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }
}
