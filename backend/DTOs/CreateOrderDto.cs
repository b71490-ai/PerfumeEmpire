namespace PerfumeEmpire.DTOs;

public class CreateOrderItemDto
{
    public int PerfumeId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
}

public class CreateOrderDto
{
    public string CustomerName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string Address { get; set; } = null!;
    public string PaymentMethod { get; set; } = "cash_on_delivery";
    public decimal Total { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
}
