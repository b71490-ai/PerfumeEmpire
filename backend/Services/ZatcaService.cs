using Microsoft.Extensions.Options;
using PerfumeEmpire.Configuration;
using PerfumeEmpire.Data;
using PerfumeEmpire.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;

namespace PerfumeEmpire.Services;

public interface IZatcaService
{
    ZatcaConfigDto GetAdminConfig();
    ZatcaConfigDto UpdateAdminConfig(ZatcaConfigDto dto);
    ZatcaReadinessReport GetReadiness();
    Task<ZatcaInvoicePackageResult> BuildInvoicePackageAsync(int orderId, CancellationToken cancellationToken = default);
    Task<ZatcaInvoiceValidationResult> ValidateInvoiceAsync(int orderId, CancellationToken cancellationToken = default);
    Task<ZatcaSandboxSubmitResult> SubmitSandboxAsync(int orderId, CancellationToken cancellationToken = default);
}

public sealed class ZatcaService : IZatcaService
{
    private readonly ZatcaOptions _options;
    private readonly ApplicationDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public ZatcaService(
        IOptions<ZatcaOptions> options,
        ApplicationDbContext db,
        IWebHostEnvironment env,
        HttpClient httpClient)
    {
        _options = options.Value;
        _db = db;
        _env = env;
        _httpClient = httpClient;
    }

    public ZatcaReadinessReport GetReadiness()
    {
        var options = ResolveEffectiveOptions();
        var missing = new List<string>();

        if (options.Enabled)
        {
            if (string.IsNullOrWhiteSpace(options.BaseUrl)) missing.Add("Zatca:BaseUrl");
            if (string.IsNullOrWhiteSpace(options.DeviceId)) missing.Add("Zatca:DeviceId");
            if (string.IsNullOrWhiteSpace(options.SolutionName)) missing.Add("Zatca:SolutionName");
            if (string.IsNullOrWhiteSpace(options.ApiSecret)) missing.Add("Zatca:ApiSecret");
            if (string.IsNullOrWhiteSpace(options.CertificatePem)) missing.Add("Zatca:CertificatePem");
            if (string.IsNullOrWhiteSpace(options.PrivateKeyPem)) missing.Add("Zatca:PrivateKeyPem");
        }

        return new ZatcaReadinessReport
        {
            Enabled = options.Enabled,
            Environment = options.Environment,
            IsReady = options.Enabled && missing.Count == 0,
            MissingFields = missing
        };
    }

    public ZatcaConfigDto GetAdminConfig()
    {
        var effective = ResolveEffectiveOptions();
        return new ZatcaConfigDto
        {
            Enabled = effective.Enabled,
            Environment = effective.Environment,
            BaseUrl = effective.BaseUrl,
            SubmitPath = effective.SubmitPath,
            HttpTimeoutSeconds = effective.HttpTimeoutSeconds,
            DeviceId = effective.DeviceId,
            SolutionName = effective.SolutionName,
            ApiSecret = effective.ApiSecret,
            CertificatePem = effective.CertificatePem,
            PrivateKeyPem = effective.PrivateKeyPem
        };
    }

    public ZatcaConfigDto UpdateAdminConfig(ZatcaConfigDto dto)
    {
        var current = ReadAdminConfig();

        current.Enabled = dto.Enabled ?? current.Enabled;
        current.Environment = string.IsNullOrWhiteSpace(dto.Environment) ? current.Environment : dto.Environment.Trim();
        current.BaseUrl = string.IsNullOrWhiteSpace(dto.BaseUrl) ? current.BaseUrl : dto.BaseUrl.Trim();
        current.SubmitPath = string.IsNullOrWhiteSpace(dto.SubmitPath) ? current.SubmitPath : dto.SubmitPath.Trim();
        current.HttpTimeoutSeconds = dto.HttpTimeoutSeconds.HasValue && dto.HttpTimeoutSeconds.Value > 0
            ? dto.HttpTimeoutSeconds
            : current.HttpTimeoutSeconds;
        current.DeviceId = string.IsNullOrWhiteSpace(dto.DeviceId) ? current.DeviceId : dto.DeviceId.Trim();
        current.SolutionName = string.IsNullOrWhiteSpace(dto.SolutionName) ? current.SolutionName : dto.SolutionName.Trim();
        current.ApiSecret = string.IsNullOrWhiteSpace(dto.ApiSecret) ? current.ApiSecret : dto.ApiSecret.Trim();
        current.CertificatePem = string.IsNullOrWhiteSpace(dto.CertificatePem) ? current.CertificatePem : dto.CertificatePem.Trim();
        current.PrivateKeyPem = string.IsNullOrWhiteSpace(dto.PrivateKeyPem) ? current.PrivateKeyPem : dto.PrivateKeyPem.Trim();

        SaveAdminConfig(current);
        return GetAdminConfig();
    }

    public async Task<ZatcaInvoicePackageResult> BuildInvoicePackageAsync(int orderId, CancellationToken cancellationToken = default)
    {
        var options = ResolveEffectiveOptions();
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

        if (order == null)
        {
            return ZatcaInvoicePackageResult.Fail($"Order not found: {orderId}");
        }

        var store = ReadStoreSettings();
        if (string.IsNullOrWhiteSpace(store.BusinessLegalName) || string.IsNullOrWhiteSpace(store.VatRegistrationNumber))
        {
            return ZatcaInvoicePackageResult.Fail("Store legal name and VAT registration number are required for ZATCA invoice generation.");
        }

        var issueDate = DateTime.SpecifyKind(order.CreatedAt, DateTimeKind.Utc);
        var invoiceNumber = $"INV-{order.Id}";
        var uuid = Guid.NewGuid().ToString();

        var xml = BuildInvoiceXml(order, store, invoiceNumber, uuid, issueDate);
        var invoiceXml = xml.ToString(SaveOptions.DisableFormatting);
        var invoiceHashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(invoiceXml));
        var invoiceHashHex = Convert.ToHexString(invoiceHashBytes).ToLowerInvariant();
        var invoiceHashBase64 = Convert.ToBase64String(invoiceHashBytes);

        var certificateBytes = TryReadCertificateBytes(options.CertificatePem);
        var signature = ComputeInvoiceSignature(invoiceXml, options.PrivateKeyPem, options.ApiSecret);
        var publicKeyBase64 = TryReadPublicKeyBase64(options.CertificatePem);

        var qrBase64 = BuildQrTlvBase64(
            store.BusinessLegalName,
            store.VatRegistrationNumber,
            issueDate,
            order.Total,
            order.Vat,
            invoiceHashBase64,
            signature,
            publicKeyBase64,
            string.Empty);

        var package = new ZatcaInvoicePackage
        {
            OrderId = order.Id,
            InvoiceNumber = invoiceNumber,
            InvoiceUuid = uuid,
            IssueDateUtc = issueDate,
            SellerName = store.BusinessLegalName,
            SellerVatNumber = store.VatRegistrationNumber,
            Xml = invoiceXml,
            XmlSha256 = invoiceHashHex,
            XmlSha256Base64 = invoiceHashBase64,
            Signature = signature,
            QrTlvBase64 = qrBase64,
            CertificateBase64 = certificateBytes != null ? Convert.ToBase64String(certificateBytes) : string.Empty,
            TotalAmount = order.Total,
            VatAmount = order.Vat,
            CurrencyCode = store.CurrencyCode
        };

        package.Validation = BuildValidationReport(order, store, package);

        return ZatcaInvoicePackageResult.Success(package);
    }

    public async Task<ZatcaInvoiceValidationResult> ValidateInvoiceAsync(int orderId, CancellationToken cancellationToken = default)
    {
        var packageResult = await BuildInvoicePackageAsync(orderId, cancellationToken);
        if (!packageResult.Ok || packageResult.Package == null)
        {
            return ZatcaInvoiceValidationResult.Fail(packageResult.Error ?? "Failed to build invoice package for validation.");
        }

        return ZatcaInvoiceValidationResult.Success(packageResult.Package.Validation ?? new ZatcaInvoiceValidationReport());
    }

    public async Task<ZatcaSandboxSubmitResult> SubmitSandboxAsync(int orderId, CancellationToken cancellationToken = default)
    {
        var options = ResolveEffectiveOptions();
        var packageResult = await BuildInvoicePackageAsync(orderId, cancellationToken);
        if (!packageResult.Ok || packageResult.Package == null)
        {
            return ZatcaSandboxSubmitResult.Fail(packageResult.Error ?? "Failed to build invoice package.");
        }

        if (!options.Enabled)
        {
            return ZatcaSandboxSubmitResult.Fail("ZATCA integration is disabled.");
        }

        if (string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            return ZatcaSandboxSubmitResult.Fail("ZATCA BaseUrl is not configured.");
        }

        var baseUri = options.BaseUrl.TrimEnd('/');
        var path = string.IsNullOrWhiteSpace(options.SubmitPath) ? "/simulation/invoices" : options.SubmitPath;
        var endpoint = baseUri + (path.StartsWith('/') ? path : "/" + path);

        var payload = new
        {
            uuid = packageResult.Package.InvoiceUuid,
            invoiceHash = packageResult.Package.XmlSha256Base64,
            invoice = Convert.ToBase64String(Encoding.UTF8.GetBytes(packageResult.Package.Xml))
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json")
        };

        if (!string.IsNullOrWhiteSpace(options.ApiSecret))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiSecret);
        }

        if (!string.IsNullOrWhiteSpace(options.DeviceId))
        {
            request.Headers.Add("X-Device-Id", options.DeviceId);
        }

        if (!string.IsNullOrWhiteSpace(options.SolutionName))
        {
            request.Headers.Add("X-Solution-Name", options.SolutionName);
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(Math.Max(5, options.HttpTimeoutSeconds)));

        try
        {
            using var response = await _httpClient.SendAsync(request, cts.Token);
            var responseBody = await response.Content.ReadAsStringAsync(cts.Token);
            return new ZatcaSandboxSubmitResult
            {
                Ok = response.IsSuccessStatusCode,
                Endpoint = endpoint,
                HttpStatusCode = (int)response.StatusCode,
                ResponseBody = responseBody,
                Error = response.IsSuccessStatusCode ? null : "Sandbox submit returned non-success status code."
            };
        }
        catch (OperationCanceledException)
        {
            return ZatcaSandboxSubmitResult.Fail($"Sandbox submit timed out after {options.HttpTimeoutSeconds} seconds.", endpoint);
        }
        catch (Exception ex)
        {
            return ZatcaSandboxSubmitResult.Fail($"Sandbox submit failed: {ex.Message}", endpoint);
        }
    }

    private StoreSettingsDto ReadStoreSettings()
    {
        try
        {
            var dir = Path.Combine(_env.ContentRootPath, "AppData");
            var path = Path.Combine(dir, "store-settings.json");
            if (!File.Exists(path))
            {
                return new StoreSettingsDto();
            }

            var content = File.ReadAllText(path);
            return JsonSerializer.Deserialize<StoreSettingsDto>(content, JsonOptions) ?? new StoreSettingsDto();
        }
        catch
        {
            return new StoreSettingsDto();
        }
    }

    private string AdminConfigPath()
    {
        var dir = Path.Combine(_env.ContentRootPath, "AppData");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "zatca-config.json");
    }

    private ZatcaConfigDto ReadAdminConfig()
    {
        try
        {
            var path = AdminConfigPath();
            if (!File.Exists(path)) return new ZatcaConfigDto();

            var content = File.ReadAllText(path);
            return JsonSerializer.Deserialize<ZatcaConfigDto>(content, JsonOptions) ?? new ZatcaConfigDto();
        }
        catch
        {
            return new ZatcaConfigDto();
        }
    }

    private void SaveAdminConfig(ZatcaConfigDto dto)
    {
        var path = AdminConfigPath();
        var content = JsonSerializer.Serialize(dto, JsonOptions);
        File.WriteAllText(path, content);
    }

    private ZatcaOptions ResolveEffectiveOptions()
    {
        var admin = ReadAdminConfig();

        return new ZatcaOptions
        {
            Enabled = admin.Enabled ?? _options.Enabled,
            Environment = !string.IsNullOrWhiteSpace(admin.Environment) ? admin.Environment : _options.Environment,
            BaseUrl = !string.IsNullOrWhiteSpace(admin.BaseUrl) ? admin.BaseUrl : _options.BaseUrl,
            SubmitPath = !string.IsNullOrWhiteSpace(admin.SubmitPath) ? admin.SubmitPath : _options.SubmitPath,
            HttpTimeoutSeconds = admin.HttpTimeoutSeconds.HasValue && admin.HttpTimeoutSeconds.Value > 0
                ? admin.HttpTimeoutSeconds.Value
                : _options.HttpTimeoutSeconds,
            DeviceId = !string.IsNullOrWhiteSpace(admin.DeviceId) ? admin.DeviceId : _options.DeviceId,
            SolutionName = !string.IsNullOrWhiteSpace(admin.SolutionName) ? admin.SolutionName : _options.SolutionName,
            ApiSecret = !string.IsNullOrWhiteSpace(admin.ApiSecret) ? admin.ApiSecret : _options.ApiSecret,
            CertificatePem = !string.IsNullOrWhiteSpace(admin.CertificatePem) ? admin.CertificatePem : _options.CertificatePem,
            PrivateKeyPem = !string.IsNullOrWhiteSpace(admin.PrivateKeyPem) ? admin.PrivateKeyPem : _options.PrivateKeyPem
        };
    }

    private static XDocument BuildInvoiceXml(
        Models.Order order,
        StoreSettingsDto store,
        string invoiceNumber,
        string uuid,
        DateTime issueDateUtc)
    {
        XNamespace cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
        XNamespace cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
        XNamespace ns = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";

        var xml = new XDocument(
            new XElement(ns + "Invoice",
                new XAttribute(XNamespace.Xmlns + "cbc", cbc),
                new XAttribute(XNamespace.Xmlns + "cac", cac),
                new XElement(cbc + "ID", invoiceNumber),
                new XElement(cbc + "UUID", uuid),
                new XElement(cbc + "IssueDate", issueDateUtc.ToString("yyyy-MM-dd")),
                new XElement(cbc + "IssueTime", issueDateUtc.ToString("HH:mm:ss")),
                new XElement(cbc + "DocumentCurrencyCode", store.CurrencyCode),
                new XElement(cac + "AccountingSupplierParty",
                    new XElement(cac + "Party",
                        new XElement(cac + "PartyName", new XElement(cbc + "Name", store.BusinessLegalName)),
                        new XElement(cac + "PartyTaxScheme",
                            new XElement(cbc + "CompanyID", store.VatRegistrationNumber)
                        )
                    )
                ),
                new XElement(cac + "AccountingCustomerParty",
                    new XElement(cac + "Party",
                        new XElement(cac + "PartyName", new XElement(cbc + "Name", order.CustomerName))
                    )
                ),
                new XElement(cac + "TaxTotal",
                    new XElement(cbc + "TaxAmount", order.Vat.ToString("0.00"))
                ),
                new XElement(cac + "LegalMonetaryTotal",
                    new XElement(cbc + "LineExtensionAmount", order.Subtotal.ToString("0.00")),
                    new XElement(cbc + "TaxExclusiveAmount", (order.Subtotal + order.Shipping).ToString("0.00")),
                    new XElement(cbc + "TaxInclusiveAmount", order.Total.ToString("0.00")),
                    new XElement(cbc + "PayableAmount", order.Total.ToString("0.00"))
                ),
                order.Items.Select((item, idx) =>
                    new XElement(cac + "InvoiceLine",
                        new XElement(cbc + "ID", (idx + 1).ToString()),
                        new XElement(cbc + "InvoicedQuantity", item.Quantity.ToString()),
                        new XElement(cbc + "LineExtensionAmount", (item.Price * item.Quantity).ToString("0.00")),
                        new XElement(cac + "Item", new XElement(cbc + "Name", item.Name)),
                        new XElement(cac + "Price", new XElement(cbc + "PriceAmount", item.Price.ToString("0.00")))
                    )
                )
            )
        );

        return xml;
    }

    private static string ComputeInvoiceSignature(string payload, string privateKeyPem, string fallbackSecret)
    {
        var rsaSignature = ComputeRsaSignature(payload, privateKeyPem);
        if (!string.IsNullOrWhiteSpace(rsaSignature))
        {
            return rsaSignature;
        }

        return ComputeHmacSignature(payload, fallbackSecret);
    }

    private static string ComputeRsaSignature(string payload, string privateKeyPem)
    {
        if (string.IsNullOrWhiteSpace(privateKeyPem))
        {
            return string.Empty;
        }

        try
        {
            using var rsa = RSA.Create();
            rsa.ImportFromPem(privateKeyPem);
            var signature = rsa.SignData(
                Encoding.UTF8.GetBytes(payload),
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1);
            return Convert.ToBase64String(signature);
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string ComputeHmacSignature(string payload, string secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            return string.Empty;
        }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var sig = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToBase64String(sig);
    }

    private static string BuildQrTlvBase64(
        string sellerName,
        string vatRegistrationNumber,
        DateTime issueDateUtc,
        decimal total,
        decimal vat,
        string invoiceHashBase64,
        string signatureBase64,
        string publicKeyBase64,
        string certSignatureBase64)
    {
        using var ms = new MemoryStream();
        WriteTlv(ms, 1, sellerName);
        WriteTlv(ms, 2, vatRegistrationNumber);
        WriteTlv(ms, 3, issueDateUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"));
        WriteTlv(ms, 4, total.ToString("0.00"));
        WriteTlv(ms, 5, vat.ToString("0.00"));
        if (!string.IsNullOrWhiteSpace(invoiceHashBase64)) WriteTlv(ms, 6, invoiceHashBase64);
        if (!string.IsNullOrWhiteSpace(signatureBase64)) WriteTlv(ms, 7, signatureBase64);
        if (!string.IsNullOrWhiteSpace(publicKeyBase64)) WriteTlv(ms, 8, publicKeyBase64);
        if (!string.IsNullOrWhiteSpace(certSignatureBase64)) WriteTlv(ms, 9, certSignatureBase64);
        return Convert.ToBase64String(ms.ToArray());
    }

    private static byte[]? TryReadCertificateBytes(string certificatePem)
    {
        if (string.IsNullOrWhiteSpace(certificatePem)) return null;

        try
        {
            var normalized = certificatePem
                .Replace("-----BEGIN CERTIFICATE-----", string.Empty)
                .Replace("-----END CERTIFICATE-----", string.Empty)
                .Replace("\r", string.Empty)
                .Replace("\n", string.Empty)
                .Trim();

            return Convert.FromBase64String(normalized);
        }
        catch
        {
            return null;
        }
    }

    private static string TryReadPublicKeyBase64(string certificatePem)
    {
        try
        {
            var certBytes = TryReadCertificateBytes(certificatePem);
            if (certBytes == null) return string.Empty;

            using var cert = new System.Security.Cryptography.X509Certificates.X509Certificate2(certBytes);
            var publicKey = cert.GetPublicKey();
            return publicKey == null || publicKey.Length == 0 ? string.Empty : Convert.ToBase64String(publicKey);
        }
        catch
        {
            return string.Empty;
        }
    }

    private static void WriteTlv(Stream stream, byte tag, string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value ?? string.Empty);
        stream.WriteByte(tag);
        stream.WriteByte((byte)Math.Min(255, bytes.Length));
        stream.Write(bytes, 0, Math.Min(255, bytes.Length));
    }

    private static ZatcaInvoiceValidationReport BuildValidationReport(Models.Order order, StoreSettingsDto store, ZatcaInvoicePackage package)
    {
        var errors = new List<string>();
        var warnings = new List<string>();

        if (order.Items == null || order.Items.Count == 0)
        {
            errors.Add("Invoice must contain at least one line item.");
        }

        if (string.IsNullOrWhiteSpace(store.BusinessLegalName))
        {
            errors.Add("Seller legal name is required.");
        }

        if (string.IsNullOrWhiteSpace(store.VatRegistrationNumber))
        {
            errors.Add("Seller VAT registration number is required.");
        }
        else if (store.VatRegistrationNumber.Length != 15)
        {
            warnings.Add("Seller VAT registration number is expected to be 15 digits.");
        }

        var linesSubtotal = order.Items?.Sum(i => i.Price * i.Quantity) ?? 0m;
        if (Math.Abs(linesSubtotal - order.Subtotal) > 0.01m)
        {
            warnings.Add($"Subtotal mismatch: lines={linesSubtotal:0.00} order={order.Subtotal:0.00}.");
        }

        var expectedTotal = (order.Subtotal - order.Discount) + order.Shipping + order.Vat;
        if (Math.Abs(expectedTotal - order.Total) > 0.01m)
        {
            warnings.Add($"Total mismatch: expected={expectedTotal:0.00} order={order.Total:0.00}.");
        }

        if (order.Vat < 0)
        {
            errors.Add("VAT amount cannot be negative.");
        }

        if (string.IsNullOrWhiteSpace(package.Signature))
        {
            errors.Add("Cryptographic signature was not generated.");
        }

        if (string.IsNullOrWhiteSpace(package.QrTlvBase64))
        {
            errors.Add("QR TLV payload was not generated.");
        }

        if (!string.Equals(package.CurrencyCode, "SAR", StringComparison.OrdinalIgnoreCase))
        {
            warnings.Add("Currency is not SAR. Verify this matches your ZATCA profile requirements.");
        }

        return new ZatcaInvoiceValidationReport
        {
            IsCompliant = errors.Count == 0,
            Errors = errors,
            Warnings = warnings
        };
    }
}

public sealed class ZatcaReadinessReport
{
    public bool Enabled { get; set; }
    public string Environment { get; set; } = "sandbox";
    public bool IsReady { get; set; }
    public IReadOnlyList<string> MissingFields { get; set; } = Array.Empty<string>();
}

public sealed class ZatcaInvoicePackageResult
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public ZatcaInvoicePackage? Package { get; set; }

    public static ZatcaInvoicePackageResult Fail(string error) => new() { Ok = false, Error = error };
    public static ZatcaInvoicePackageResult Success(ZatcaInvoicePackage package) => new() { Ok = true, Package = package };
}

public sealed class ZatcaInvoicePackage
{
    public int OrderId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string InvoiceUuid { get; set; } = string.Empty;
    public DateTime IssueDateUtc { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string SellerVatNumber { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = "SAR";
    public decimal TotalAmount { get; set; }
    public decimal VatAmount { get; set; }
    public string Xml { get; set; } = string.Empty;
    public string XmlSha256 { get; set; } = string.Empty;
    public string XmlSha256Base64 { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
    public string CertificateBase64 { get; set; } = string.Empty;
    public string QrTlvBase64 { get; set; } = string.Empty;
    public ZatcaInvoiceValidationReport? Validation { get; set; }
}

public sealed class ZatcaInvoiceValidationResult
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public ZatcaInvoiceValidationReport Report { get; set; } = new();

    public static ZatcaInvoiceValidationResult Fail(string error) => new() { Ok = false, Error = error };
    public static ZatcaInvoiceValidationResult Success(ZatcaInvoiceValidationReport report) => new() { Ok = true, Report = report };
}

public sealed class ZatcaInvoiceValidationReport
{
    public bool IsCompliant { get; set; }
    public IReadOnlyList<string> Errors { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> Warnings { get; set; } = Array.Empty<string>();
}

public sealed class ZatcaSandboxSubmitResult
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public int HttpStatusCode { get; set; }
    public string ResponseBody { get; set; } = string.Empty;

    public static ZatcaSandboxSubmitResult Fail(string error, string endpoint = "") => new()
    {
        Ok = false,
        Error = error,
        Endpoint = endpoint
    };
}
