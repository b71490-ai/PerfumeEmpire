namespace PerfumeEmpire.DTOs;

public class CreateReviewDto
{
    public string CustomerName { get; set; } = null!;
    public int Rating { get; set; }
    public string? Comment { get; set; }
}
