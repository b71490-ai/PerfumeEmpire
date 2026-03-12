using Microsoft.AspNetCore.Mvc;
using PerfumeEmpire.DTOs;
using PerfumeEmpire.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CartController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly ApplicationDbContext _db;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
    private const int CartTtlDays = 30;

    public CartController(IWebHostEnvironment env, ApplicationDbContext db)
    {
        _env = env;
        _db = db;
    }

    private string CartsDir()
    {
        var dir = Path.Combine(_env.ContentRootPath, "AppData", "carts");
        Directory.CreateDirectory(dir);
        return dir;
    }

    private string CartPath(string cartId) => Path.Combine(CartsDir(), $"cart-{cartId}.json");

    [HttpPost("init")]
    public IActionResult InitCart()
    {
        // Prefer existing cookie
        var cookie = Request.Cookies["cartId"];
        string cartId = string.IsNullOrWhiteSpace(cookie) ? Guid.NewGuid().ToString("N") : cookie!;

        var path = CartPath(cartId);
        CartDto cart;
        if (System.IO.File.Exists(path))
        {
            var txt = System.IO.File.ReadAllText(path);
            try { cart = JsonSerializer.Deserialize<CartDto>(txt, JsonOptions) ?? new CartDto { CartId = cartId }; } catch { cart = new CartDto { CartId = cartId }; }
        }
        else
        {
            cart = new CartDto { CartId = cartId, CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(CartTtlDays) };
            System.IO.File.WriteAllText(path, JsonSerializer.Serialize(cart, JsonOptions));
        }

        var secure = _env.IsProduction() || Request.IsHttps;
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(CartTtlDays),
            Path = "/"
        };
        Response.Cookies.Append("cartId", cartId, cookieOptions);

        // issue a double-submit CSRF cookie for client-side JS to read
        var csrf = Guid.NewGuid().ToString("N");
        var csrfOpts = new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(CartTtlDays),
            Path = "/"
        };
        Response.Cookies.Append("XSRF-TOKEN", csrf, csrfOpts);
        return Ok(cart);
    }

    [HttpGet]
    public IActionResult GetCart([FromQuery] string? id)
    {
        var cookie = Request.Cookies["cartId"];
        var cartId = (!string.IsNullOrWhiteSpace(id) ? id : cookie) ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cartId)) return Ok(new CartDto());

        var path = CartPath(cartId);
        if (!System.IO.File.Exists(path)) return Ok(new CartDto { CartId = cartId });

        var txt = System.IO.File.ReadAllText(path);
        try
        {
            var cart = JsonSerializer.Deserialize<CartDto>(txt, JsonOptions) ?? new CartDto { CartId = cartId };
            return Ok(cart);
        }
        catch
        {
            return Ok(new CartDto { CartId = cartId });
        }
    }

    [HttpPut]
    public IActionResult UpdateCart([FromBody] CartDto dto)
    {
        if (dto == null) return BadRequest();
        var cookie = Request.Cookies["cartId"];
        var cartId = !string.IsNullOrWhiteSpace(dto.CartId) ? dto.CartId : cookie ?? Guid.NewGuid().ToString("N");
        dto.CartId = cartId;
        dto.ExpiresAt = DateTime.UtcNow.AddDays(CartTtlDays);
        dto.CreatedAt = dto.CreatedAt == default ? DateTime.UtcNow : dto.CreatedAt;

        var path = CartPath(cartId);
        System.IO.File.WriteAllText(path, JsonSerializer.Serialize(dto, JsonOptions));

        var secure = _env.IsProduction() || Request.IsHttps;
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(CartTtlDays),
            Path = "/"
        };
        Response.Cookies.Append("cartId", cartId, cookieOptions);

        // ensure CSRF cookie present for client
        var csrf = Guid.NewGuid().ToString("N");
        var csrfOpts = new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(CartTtlDays),
            Path = "/"
        };
        Response.Cookies.Append("XSRF-TOKEN", csrf, csrfOpts);
        return Ok(dto);
    }

    [HttpPost("merge")]
    public async Task<IActionResult> MergeCart([FromBody] CartDto incoming)
    {
        if (incoming == null) return BadRequest();
        // guard against missing items arrays to avoid NullReferenceException
        incoming.Items = incoming.Items ?? new List<CartItemDto>();
        var cookie = Request.Cookies["cartId"];
        var cartId = !string.IsNullOrWhiteSpace(incoming.CartId) ? incoming.CartId : cookie ?? Guid.NewGuid().ToString("N");

        var path = CartPath(cartId);
        CartDto existing = new() { CartId = cartId };
        if (System.IO.File.Exists(path))
        {
            try { existing = JsonSerializer.Deserialize<CartDto>(System.IO.File.ReadAllText(path), JsonOptions) ?? existing; } catch { }
        }

        // ensure existing.Items is not null
        existing.Items = existing.Items ?? new List<CartItemDto>();

        // Merge quantities by PerfumeId, cap to available stock
        var byId = existing.Items.ToDictionary(i => i.PerfumeId, i => i);
        foreach (var item in incoming.Items)
        {
            if (byId.TryGetValue(item.PerfumeId, out var ex))
            {
                // sum quantities from guest + existing user cart
                ex.Quantity = ex.Quantity + item.Quantity;
            }
            else
            {
                byId[item.PerfumeId] = new CartItemDto { PerfumeId = item.PerfumeId, Name = item.Name, Price = item.Price, Quantity = item.Quantity };
            }
        }

        var perfumeIds = byId.Keys.ToList();
        var perfumes = await _db.Perfumes.Where(p => perfumeIds.Contains(p.Id)).ToListAsync();
        var perfumeById = perfumes.ToDictionary(p => p.Id, p => p);

        // enforce stock caps and fill latest price/name where possible
        var merged = new List<CartItemDto>();
        foreach (var kv in byId)
        {
            var pid = kv.Key;
            var item = kv.Value;
            if (perfumeById.TryGetValue(pid, out var p))
            {
                var allowed = Math.Max(0, p.Stock);
                var qty = Math.Min(item.Quantity, allowed > 0 ? allowed : item.Quantity);
                merged.Add(new CartItemDto { PerfumeId = pid, Name = p.Name, Price = p.Price, Quantity = qty });
            }
            else
            {
                merged.Add(item);
            }
        }

        var result = new CartDto { CartId = cartId, Items = merged, CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(CartTtlDays) };
        System.IO.File.WriteAllText(path, JsonSerializer.Serialize(result, JsonOptions));

        var secure = _env.IsProduction() || Request.IsHttps;
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(CartTtlDays),
            Path = "/"
        };
        Response.Cookies.Append("cartId", cartId, cookieOptions);

        // rotate/set CSRF token for client
        var csrf = Guid.NewGuid().ToString("N");
        var csrfOpts = new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(CartTtlDays),
            Path = "/"
        };
        Response.Cookies.Append("XSRF-TOKEN", csrf, csrfOpts);

        return Ok(result);
    }
}
