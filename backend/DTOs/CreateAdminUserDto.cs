namespace PerfumeEmpire.DTOs;

public class CreateAdminUserDto
{
    public string Username { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string? Role { get; set; }
}
