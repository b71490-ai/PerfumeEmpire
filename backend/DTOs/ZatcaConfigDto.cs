namespace PerfumeEmpire.DTOs;

public sealed class ZatcaConfigDto
{
    public bool? Enabled { get; set; }
    public string Environment { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string SubmitPath { get; set; } = string.Empty;
    public int? HttpTimeoutSeconds { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public string SolutionName { get; set; } = string.Empty;
    public string ApiSecret { get; set; } = string.Empty;
    public string CertificatePem { get; set; } = string.Empty;
    public string PrivateKeyPem { get; set; } = string.Empty;
}
