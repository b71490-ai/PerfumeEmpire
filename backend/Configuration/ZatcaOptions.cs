namespace PerfumeEmpire.Configuration;

public sealed class ZatcaOptions
{
    public const string SectionName = "Zatca";

    // False keeps integration disabled without removing config.
    public bool Enabled { get; set; } = false;

    // "sandbox" for test, "production" for live.
    public string Environment { get; set; } = "sandbox";

    // ZATCA base API URL for current environment.
    public string BaseUrl { get; set; } = string.Empty;
    public string SubmitPath { get; set; } = "/simulation/invoices";
    public int HttpTimeoutSeconds { get; set; } = 30;

    // Device/solution identifiers expected by ZATCA APIs.
    public string DeviceId { get; set; } = string.Empty;
    public string SolutionName { get; set; } = string.Empty;

    // Credential material (must be supplied from secure environment variables).
    public string ApiSecret { get; set; } = string.Empty;
    public string CertificatePem { get; set; } = string.Empty;
    public string PrivateKeyPem { get; set; } = string.Empty;
}
