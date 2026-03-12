namespace PerfumeEmpire.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = null!;
    // NOTE: For demo purposes password is stored in plain text.
    // In production hash passwords using a secure algorithm (BCrypt/Argon2).
    public string Password { get; set; } = null!;

    // Role: Admin, Manager, Staff, Customer
    public string Role { get; set; } = "Customer";

    // Numeric bitflags of permissions (see Authorization/Permissions.cs)
    public long Permissions { get; set; } = 0;
}
