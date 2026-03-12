namespace PerfumeEmpire.Models;

public class Review
{
    public int Id { get; set; }
    public int PerfumeId { get; set; }
    public string CustomerName { get; set; } = null!;
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
