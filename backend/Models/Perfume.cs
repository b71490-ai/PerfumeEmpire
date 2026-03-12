namespace PerfumeEmpire.Models;

public class Perfume
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Brand { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public int Discount { get; set; } // Percentage (0-100)
    public string? Category { get; set; } // "men", "women", "incense", "cosmetics"
    public int Stock { get; set; } = 0;
    // Nullable stored perceptual hash (aHash 8x8 stored as signed 64-bit column)
    public long? Hash { get; set; }
}
