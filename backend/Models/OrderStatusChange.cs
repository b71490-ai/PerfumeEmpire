using System;
namespace PerfumeEmpire.Models;

public class OrderStatusChange
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public OrderStatus OldStatus { get; set; }
    public OrderStatus NewStatus { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? ChangedBy { get; set; }
}
