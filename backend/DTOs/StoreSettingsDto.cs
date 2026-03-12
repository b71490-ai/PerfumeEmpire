namespace PerfumeEmpire.DTOs;

public class StoreSettingsDto
{
    public string StoreName { get; set; } = "عطور الإمبراطورية";
    public string StoreTagline { get; set; } = "وجهتك الأولى للعطور الفاخرة والأصلية";
    public string LogoText { get; set; } = "عطور الإمبراطورية";
    public string LogoIcon { get; set; } = "✨";
    public string LogoImageUrl { get; set; } = string.Empty;
    public string LogoBackgroundColor { get; set; } = "#ffffff";
    public bool InvoiceLogoAutoMask { get; set; } = true;
    public string ContactPhone { get; set; } = "+966500000000";
    public string ContactEmail { get; set; } = "info@perfume-empire.local";
    public string ContactWhatsapp { get; set; } = "+966500000000";
    public string ContactInstagram { get; set; } = "@perfume_empire";
    public string ContactAddress { get; set; } = "الرياض، المملكة العربية السعودية";
    public string BusinessHours { get; set; } = "السبت - الخميس: 9 صباحاً - 10 مساءً";
    public string SeoDescription { get; set; } = "متجر العطور الفاخرة - اكتشف أروع العطور العالمية";
    public string SeoKeywords { get; set; } = "عطور, عطور فاخرة, عطور رجالية, عطور نسائية, بخور, عود";
    public bool MaintenanceMode { get; set; } = false;
    public string MaintenanceMessage { get; set; } = "المتجر تحت صيانة مؤقتة، سنعود قريباً.";
    public bool AnnouncementEnabled { get; set; } = false;
    public string AnnouncementText { get; set; } = string.Empty;
    public string AnnouncementLink { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = "SAR";
    public string CurrencySymbol { get; set; } = "ر.س";
    public decimal TaxRatePercent { get; set; } = 15m;
    public string BusinessLegalName { get; set; } = "مؤسسة عطور الإمبراطورية";
    public string VatRegistrationNumber { get; set; } = string.Empty;
    public string CommercialRegistrationNumber { get; set; } = string.Empty;

    public bool PaymentEnabled { get; set; } = false;
    public bool CodEnabled { get; set; } = true;
    public string PaymentProvider { get; set; } = "none";
    public bool PaymentSandboxMode { get; set; } = true;
    public string PaymentPublicKey { get; set; } = string.Empty;
    public string PaymentSecretKey { get; set; } = string.Empty;

    public decimal ShippingFlatFee { get; set; } = 50m;
    public decimal FreeShippingThreshold { get; set; } = 500m;
    public int ShippingMainCitiesMinDays { get; set; } = 1;
    public int ShippingMainCitiesMaxDays { get; set; } = 3;
    public int ShippingOtherCitiesMinDays { get; set; } = 3;
    public int ShippingOtherCitiesMaxDays { get; set; } = 7;
    public int ReturnWindowDays { get; set; } = 14;

    public string ShippingPolicyText { get; set; } = string.Empty;
    public string ReturnsPolicyText { get; set; } = string.Empty;
    public string PrivacyPolicyText { get; set; } = string.Empty;
    public DateTimeOffset? UpdatedAt { get; set; }

    public string NotificationOrderCreatedTemplate { get; set; } = "تم استلام طلبك رقم #{orderId} بنجاح.";
    public string NotificationOrderShippedTemplate { get; set; } = "طلبك رقم #{orderId} قيد الشحن الآن.";
    public string NotificationOrderDeliveredTemplate { get; set; } = "تم تسليم طلبك رقم #{orderId}. شكرًا لاختياركم متجرنا.";

    public string GoogleAnalyticsId { get; set; } = string.Empty;
    public string MetaPixelId { get; set; } = string.Empty;
    public string TagManagerId { get; set; } = string.Empty;

    public string MediaProvider { get; set; } = "local";
    public string MediaBaseUrl { get; set; } = string.Empty;
    public string MediaApiKey { get; set; } = string.Empty;
}
