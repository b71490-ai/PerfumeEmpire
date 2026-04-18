using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PerfumeEmpire.Data;
using PerfumeEmpire.Models;
using PerfumeEmpire.DTOs;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Admin",
        "Manager",
        "Editor",
        "Support"
    };

    public AdminController(ApplicationDbContext db)
    {
        _db = db;
    }

    private static decimal ToMoney(double? value) => Convert.ToDecimal(value ?? 0d);

    private static string? NormalizeRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return "Admin";
        var normalized = role.Trim();
        if (string.Equals(normalized, "admin", StringComparison.OrdinalIgnoreCase)) return "Admin";
        if (string.Equals(normalized, "manager", StringComparison.OrdinalIgnoreCase)) return "Manager";
        if (string.Equals(normalized, "editor", StringComparison.OrdinalIgnoreCase)) return "Editor";
        if (string.Equals(normalized, "support", StringComparison.OrdinalIgnoreCase)) return "Support";
        return null;
    }

    private static long PermissionsForRole(string role)
    {
        return PerfumeEmpire.Authorization.PermissionProfiles.ForRole(role);
    }

    [HttpGet("stats")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ViewReports)]
    public async Task<IActionResult> GetStats()
    {
        var now = DateTime.UtcNow;
        var startOfToday = now.Date;
        var startOfMonth = new DateTime(now.Year, now.Month, 1);

        var perfumesCount = await _db.Perfumes.CountAsync();
        var ordersCount = await _db.Orders.CountAsync();
        var usersCount = await _db.Users.CountAsync();
        var grossRevenue = ToMoney(await _db.Orders.SumAsync(o => (double?)o.Total));
        var netRevenue = ToMoney(await _db.Orders
            .Where(o => o.Status != OrderStatus.Cancelled)
            .SumAsync(o => (double?)o.Total));

        var pendingOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Pending);
        var processingOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Processing);
        var shippedOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Shipped);
        var completedOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Completed);
        var cancelledOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Cancelled);

        var todayOrders = await _db.Orders.CountAsync(o => o.CreatedAt >= startOfToday);
        var monthOrders = await _db.Orders.CountAsync(o => o.CreatedAt >= startOfMonth);

        var todayRevenue = ToMoney(await _db.Orders
            .Where(o => o.CreatedAt >= startOfToday && o.Status != OrderStatus.Cancelled)
            .SumAsync(o => (double?)o.Total));

        var monthRevenue = ToMoney(await _db.Orders
            .Where(o => o.CreatedAt >= startOfMonth && o.Status != OrderStatus.Cancelled)
            .SumAsync(o => (double?)o.Total));

        var lowStock = await _db.Perfumes
            .Where(p => p.Stock <= 5)
            .OrderBy(p => p.Stock)
            .Select(p => new { id = p.Id, name = p.Name, stock = p.Stock })
            .Take(10)
            .ToListAsync();

        var pendingPayments = await _db.Orders.CountAsync(o => o.PaymentStatus == PaymentStatus.Pending && o.Status != OrderStatus.Cancelled);
        var refundedPayments = await _db.Orders.CountAsync(o => o.PaymentStatus == PaymentStatus.Refunded);

        var activeOrders = ordersCount - cancelledOrders;
        var averageOrderValue = activeOrders > 0 ? netRevenue / activeOrders : 0m;
        var completionRate = ordersCount > 0 ? Math.Round((decimal)completedOrders * 100m / ordersCount, 2) : 0m;
        var cancellationRate = ordersCount > 0 ? Math.Round((decimal)cancelledOrders * 100m / ordersCount, 2) : 0m;

        return Ok(new {
            perfumes = perfumesCount,
            orders = ordersCount,
            users = usersCount,
            grossRevenue,
            netRevenue,
            orderStatus = new
            {
                pending = pendingOrders,
                processing = processingOrders,
                shipped = shippedOrders,
                completed = completedOrders,
                cancelled = cancelledOrders
            },
            periods = new
            {
                todayOrders,
                monthOrders,
                todayRevenue,
                monthRevenue
            },
            alerts = new
            {
                lowStockCount = lowStock.Count,
                lowStock,
                pendingPayments,
                refundedPayments
            },
            performance = new
            {
                averageOrderValue,
                completionRate,
                cancellationRate
            }
        });
    }

    [HttpGet("stats/tax")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ViewReports)]
    public async Task<IActionResult> GetTax([FromQuery] DateTime? start, [FromQuery] DateTime? end, [FromQuery] string? status)
    {
        var query = _db.Orders.AsQueryable();

        if (start.HasValue)
        {
            query = query.Where(o => o.CreatedAt >= start.Value);
        }

        if (end.HasValue)
        {
            query = query.Where(o => o.CreatedAt <= end.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (Enum.TryParse<OrderStatus>(status.Trim(), true, out var parsed))
            {
                query = query.Where(o => o.Status == parsed);
            }
            else
            {
                return BadRequest(new { message = "Invalid status value" });
            }
        }
        else
        {
            // by default exclude cancelled orders from tax totals
            query = query.Where(o => o.Status != OrderStatus.Cancelled);
        }

        var tax = ToMoney(await query.SumAsync(o => (double?)o.Vat));

        return Ok(new { tax });
    }

    [HttpGet("users")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ManageUsers)]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .OrderByDescending(u => u.Id)
            .Select(u => new
            {
                id = u.Id,
                username = u.Username,
                role = u.Role
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost("users")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ManageUsers)]
    public async Task<IActionResult> CreateUser([FromBody] CreateAdminUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Username and password are required" });

        var username = dto.Username.Trim();
        var exists = await _db.Users.AnyAsync(u => u.Username == username);
        if (exists)
            return Conflict(new { message = "Username already exists" });

        var role = NormalizeRole(dto.Role);
        if (role == null || !AllowedRoles.Contains(role))
            return BadRequest(new { message = "Invalid role. Allowed roles: Admin, Manager, Editor, Support" });

        var hashed = BCrypt.Net.BCrypt.HashPassword(dto.Password.Trim());

        var user = new User
        {
            Username = username,
            Password = hashed,
            Role = role,
            Permissions = PermissionsForRole(role)
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = user.Id,
            username = user.Username,
            role = user.Role
        });
    }

    [HttpPut("users/{id:int}")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ManageUsers)]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateAdminUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username))
            return BadRequest(new { message = "Username is required" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "User not found" });

        var normalizedRole = string.IsNullOrWhiteSpace(dto.Role)
            ? user.Role
            : NormalizeRole(dto.Role);

        if (string.IsNullOrWhiteSpace(normalizedRole) || !AllowedRoles.Contains(normalizedRole))
            return BadRequest(new { message = "Invalid role. Allowed roles: Admin, Manager, Editor, Support" });

        var newUsername = dto.Username.Trim();
        var exists = await _db.Users.AnyAsync(u => u.Id != id && u.Username == newUsername);
        if (exists)
            return Conflict(new { message = "Username already exists" });

        var isCurrentAdmin = string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase);
        var willRemainAdmin = string.Equals(normalizedRole, "Admin", StringComparison.OrdinalIgnoreCase);
        if (isCurrentAdmin && !willRemainAdmin)
        {
            var totalAdmins = await _db.Users.CountAsync(u => u.Role == "Admin");
            if (totalAdmins <= 1)
                return BadRequest(new { message = "Cannot change role for the last admin user" });
        }

        user.Username = newUsername;
        user.Role = normalizedRole;
        user.Permissions = PermissionsForRole(normalizedRole);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = user.Id,
            username = user.Username,
            role = user.Role
        });
    }

    [HttpPut("users/{id:int}/password")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ManageUsers)]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetAdminPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Password is required" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "User not found" });

        user.Password = BCrypt.Net.BCrypt.HashPassword(dto.Password.Trim());
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password updated" });
    }

    [HttpDelete("users/{id:int}")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ManageUsers)]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "User not found" });

        var totalAdmins = await _db.Users.CountAsync(u => u.Role == "Admin");
        if (totalAdmins <= 1 && string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Cannot delete the last admin user" });

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        return Ok(new { message = "User deleted" });
    }
}
