namespace PerfumeEmpire.Models;

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int PerfumeId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
}
