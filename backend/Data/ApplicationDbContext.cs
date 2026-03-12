using Microsoft.EntityFrameworkCore;
using PerfumeEmpire.Models;

namespace PerfumeEmpire.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Perfume> Perfumes => Set<Perfume>();
    public DbSet<PerfumeEmpire.Models.User> Users => Set<PerfumeEmpire.Models.User>();
    public DbSet<PerfumeEmpire.Models.Order> Orders => Set<PerfumeEmpire.Models.Order>();
    public DbSet<PerfumeEmpire.Models.OrderItem> OrderItems => Set<PerfumeEmpire.Models.OrderItem>();
    public DbSet<PerfumeEmpire.Models.Review> Reviews => Set<PerfumeEmpire.Models.Review>();
    public DbSet<PerfumeEmpire.Models.RefreshToken> RefreshTokens => Set<PerfumeEmpire.Models.RefreshToken>();
    public DbSet<PerfumeEmpire.Models.OrderStatusChange> OrderStatusChanges => Set<PerfumeEmpire.Models.OrderStatusChange>();
}
