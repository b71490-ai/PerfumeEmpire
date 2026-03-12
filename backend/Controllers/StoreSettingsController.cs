using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using PerfumeEmpire.DTOs;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/store-settings")]
public class StoreSettingsController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private static readonly HashSet<string> AllowedPaymentProviders = new(StringComparer.OrdinalIgnoreCase)
    {
        "none", "moyasar", "stripe", "tap", "custom"
    };

    public StoreSettingsController(IWebHostEnvironment env)
    {
        _env = env;
    }

    private string SettingsPath()
    {
        var dir = Path.Combine(_env.ContentRootPath, "AppData");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "store-settings.json");
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private StoreSettingsDto DefaultSettings() => new();

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Get()
    {
        var path = SettingsPath();
        if (!System.IO.File.Exists(path))
        {
            var defaults = DefaultSettings();
            System.IO.File.WriteAllText(path, JsonSerializer.Serialize(defaults, JsonOptions));
            return Ok(defaults);
        }

        try
        {
            // Return the raw JSON content from the settings file to avoid any
            // formatter differences that could omit fields. The file is written
            // using `JsonOptions` elsewhere, so returning it verbatim ensures
            // the frontend receives exactly what is persisted.
            var content = System.IO.File.ReadAllText(path);
            return Content(content, "application/json");
        }
        catch
        {
            // Fallback: return typed defaults if reading fails
            return Ok(DefaultSettings());
        }
    }

    [HttpPut]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ManageUsers)]
    public IActionResult Update([FromBody] StoreSettingsDto dto)
    {
        dto.StoreName = string.IsNullOrWhiteSpace(dto.StoreName) ? "عطور الإمبراطورية" : dto.StoreName.Trim();
        dto.StoreTagline = string.IsNullOrWhiteSpace(dto.StoreTagline) ? "وجهتك الأولى للعطور الفاخرة والأصلية" : dto.StoreTagline.Trim();
        dto.LogoText = string.IsNullOrWhiteSpace(dto.LogoText) ? dto.StoreName : dto.LogoText.Trim();
        dto.LogoIcon = string.IsNullOrWhiteSpace(dto.LogoIcon) ? "✨" : dto.LogoIcon.Trim();
        dto.LogoImageUrl = (dto.LogoImageUrl ?? string.Empty).Trim();
        dto.LogoBackgroundColor = (dto.LogoBackgroundColor ?? string.Empty).Trim();
        dto.ContactPhone = (dto.ContactPhone ?? string.Empty).Trim();
        dto.ContactEmail = (dto.ContactEmail ?? string.Empty).Trim();
        dto.ContactWhatsapp = (dto.ContactWhatsapp ?? string.Empty).Trim();
        dto.ContactInstagram = (dto.ContactInstagram ?? string.Empty).Trim();
        dto.ContactAddress = string.IsNullOrWhiteSpace(dto.ContactAddress) ? "الرياض، المملكة العربية السعودية" : dto.ContactAddress.Trim();
        dto.BusinessHours = string.IsNullOrWhiteSpace(dto.BusinessHours) ? "السبت - الخميس: 9 صباحاً - 10 مساءً" : dto.BusinessHours.Trim();
        dto.SeoDescription = string.IsNullOrWhiteSpace(dto.SeoDescription) ? "متجر العطور الفاخرة - اكتشف أروع العطور العالمية" : dto.SeoDescription.Trim();
        dto.SeoKeywords = (dto.SeoKeywords ?? string.Empty).Trim();
        dto.MaintenanceMessage = string.IsNullOrWhiteSpace(dto.MaintenanceMessage) ? "المتجر تحت صيانة مؤقتة، سنعود قريباً." : dto.MaintenanceMessage.Trim();
        dto.AnnouncementText = (dto.AnnouncementText ?? string.Empty).Trim();
        dto.AnnouncementLink = (dto.AnnouncementLink ?? string.Empty).Trim();
        dto.CurrencyCode = string.IsNullOrWhiteSpace(dto.CurrencyCode) ? "SAR" : dto.CurrencyCode.Trim().ToUpperInvariant();
        dto.CurrencySymbol = string.IsNullOrWhiteSpace(dto.CurrencySymbol) ? "ر.س" : dto.CurrencySymbol.Trim();
        dto.TaxRatePercent = Math.Clamp(dto.TaxRatePercent, 0m, 100m);
        dto.BusinessLegalName = string.IsNullOrWhiteSpace(dto.BusinessLegalName) ? "مؤسسة عطور الإمبراطورية" : dto.BusinessLegalName.Trim();
        dto.VatRegistrationNumber = (dto.VatRegistrationNumber ?? string.Empty).Trim();
        dto.CommercialRegistrationNumber = (dto.CommercialRegistrationNumber ?? string.Empty).Trim();

        dto.PaymentProvider = string.IsNullOrWhiteSpace(dto.PaymentProvider) ? "none" : dto.PaymentProvider.Trim().ToLowerInvariant();
        dto.PaymentPublicKey = (dto.PaymentPublicKey ?? string.Empty).Trim();
        dto.PaymentSecretKey = (dto.PaymentSecretKey ?? string.Empty).Trim();

        if (!AllowedPaymentProviders.Contains(dto.PaymentProvider))
        {
            return BadRequest(new { message = "مزود الدفع غير مدعوم." });
        }

        if (dto.PaymentEnabled)
        {
            if (dto.PaymentProvider == "none")
            {
                return BadRequest(new { message = "لا يمكن تفعيل الدفع الإلكتروني بدون تحديد مزود دفع." });
            }

            if (string.IsNullOrWhiteSpace(dto.PaymentPublicKey) || string.IsNullOrWhiteSpace(dto.PaymentSecretKey))
            {
                return BadRequest(new { message = "لا يمكن تفعيل الدفع الإلكتروني بدون إدخال المفاتيح المطلوبة." });
            }
        }

        dto.ShippingFlatFee = Math.Clamp(dto.ShippingFlatFee, 0m, 10000m);
        dto.FreeShippingThreshold = Math.Clamp(dto.FreeShippingThreshold, 0m, 100000m);
        dto.ShippingMainCitiesMinDays = Math.Clamp(dto.ShippingMainCitiesMinDays, 0, 60);
        dto.ShippingMainCitiesMaxDays = Math.Clamp(dto.ShippingMainCitiesMaxDays, dto.ShippingMainCitiesMinDays, 90);
        dto.ShippingOtherCitiesMinDays = Math.Clamp(dto.ShippingOtherCitiesMinDays, 0, 90);
        dto.ShippingOtherCitiesMaxDays = Math.Clamp(dto.ShippingOtherCitiesMaxDays, dto.ShippingOtherCitiesMinDays, 120);
        dto.ReturnWindowDays = Math.Clamp(dto.ReturnWindowDays, 0, 365);

        dto.ShippingPolicyText = (dto.ShippingPolicyText ?? string.Empty).Trim();
        dto.ReturnsPolicyText = (dto.ReturnsPolicyText ?? string.Empty).Trim();
        dto.PrivacyPolicyText = (dto.PrivacyPolicyText ?? string.Empty).Trim();
        dto.UpdatedAt = DateTimeOffset.UtcNow;

        dto.NotificationOrderCreatedTemplate = (dto.NotificationOrderCreatedTemplate ?? string.Empty).Trim();
        dto.NotificationOrderShippedTemplate = (dto.NotificationOrderShippedTemplate ?? string.Empty).Trim();
        dto.NotificationOrderDeliveredTemplate = (dto.NotificationOrderDeliveredTemplate ?? string.Empty).Trim();

        dto.GoogleAnalyticsId = (dto.GoogleAnalyticsId ?? string.Empty).Trim();
        dto.MetaPixelId = (dto.MetaPixelId ?? string.Empty).Trim();
        dto.TagManagerId = (dto.TagManagerId ?? string.Empty).Trim();

        dto.MediaProvider = string.IsNullOrWhiteSpace(dto.MediaProvider) ? "local" : dto.MediaProvider.Trim().ToLowerInvariant();
        dto.MediaBaseUrl = (dto.MediaBaseUrl ?? string.Empty).Trim();
        dto.MediaApiKey = (dto.MediaApiKey ?? string.Empty).Trim();

        var path = SettingsPath();
        var content = JsonSerializer.Serialize(dto, JsonOptions);
        System.IO.File.WriteAllText(path, content);

        return Ok(dto);
    }
}
