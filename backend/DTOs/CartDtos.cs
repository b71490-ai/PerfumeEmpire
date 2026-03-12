using System.Text.Json.Serialization;

namespace PerfumeEmpire.DTOs;

public class CartItemDto
{
    public int PerfumeId { get; set; }
    public string? Name { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; }
}

public class CartDto
{
    public string CartId { get; set; } = string.Empty;
    public List<CartItemDto> Items { get; set; } = new();
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(30);
}
