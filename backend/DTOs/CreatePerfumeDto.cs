namespace PerfumeEmpire.DTOs;

public class CreatePerfumeDto
{
    public string? Name { get; set; }
    public string? Brand { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public int Discount { get; set; } // Percentage (0-100)
    public string? Category { get; set; }
    public int Stock { get; set; }
}
