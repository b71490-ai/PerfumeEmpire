namespace PerfumeEmpire.Models;

public class Coupon
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = "fixed";
    public decimal Amount { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
