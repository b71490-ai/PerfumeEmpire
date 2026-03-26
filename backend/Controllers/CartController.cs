using System.Collections.Concurrent;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PerfumeEmpire.Data;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CartController : ControllerBase
{
	private const string XsrfCookieName = "XSRF-TOKEN";
	private static readonly ConcurrentDictionary<string, List<CartLine>> CartStore = new();
	private readonly ApplicationDbContext _db;

	public CartController(ApplicationDbContext db)
	{
		_db = db;
	}

	[HttpPost("init")]
	public IActionResult Init()
	{
		var cartId = Guid.NewGuid().ToString("N");
		var xsrfToken = Guid.NewGuid().ToString("N");

		CartStore.TryAdd(cartId, new List<CartLine>());

		Response.Cookies.Append(XsrfCookieName, xsrfToken, new CookieOptions
		{
			HttpOnly = false,
			SameSite = SameSiteMode.Lax,
			Secure = false,
			Path = "/"
		});

		return Ok(new
		{
			cartId,
			csrfToken = xsrfToken,
			items = Array.Empty<object>()
		});
	}

	[HttpPost("merge")]
	public async Task<IActionResult> Merge([FromBody] MergeCartRequest? request)
	{
		if (request == null || request.Items == null)
		{
			return BadRequest(new { message = "بيانات السلة غير صالحة" });
		}

		var cartId = string.IsNullOrWhiteSpace(request.CartId)
			? Guid.NewGuid().ToString("N")
			: request.CartId.Trim();

		var currentLines = CartStore.GetOrAdd(cartId, _ => new List<CartLine>());

		var ids = request.Items
			.Where(i => i != null && i.PerfumeId > 0 && i.Quantity > 0)
			.Select(i => i.PerfumeId)
			.Distinct()
			.ToList();

		var products = await _db.Perfumes
			.Where(p => ids.Contains(p.Id))
			.ToDictionaryAsync(p => p.Id);

		foreach (var item in request.Items)
		{
			if (item == null || item.PerfumeId <= 0 || item.Quantity <= 0) continue;
			if (!products.TryGetValue(item.PerfumeId, out var perfume)) continue;

			var safeQty = Math.Max(1, Math.Min(item.Quantity, Math.Max(0, perfume.Stock)));
			if (safeQty <= 0) continue;

			var existing = currentLines.FirstOrDefault(l => l.PerfumeId == item.PerfumeId);
			if (existing == null)
			{
				currentLines.Add(new CartLine { PerfumeId = item.PerfumeId, Quantity = safeQty });
			}
			else
			{
				existing.Quantity = Math.Max(1, Math.Min(existing.Quantity + safeQty, Math.Max(0, perfume.Stock)));
			}
		}

		var xsrfToken = Request.Cookies[XsrfCookieName];
		if (string.IsNullOrWhiteSpace(xsrfToken))
		{
			xsrfToken = Guid.NewGuid().ToString("N");
			Response.Cookies.Append(XsrfCookieName, xsrfToken, new CookieOptions
			{
				HttpOnly = false,
				SameSite = SameSiteMode.Lax,
				Secure = false,
				Path = "/"
			});
		}

		return Ok(new
		{
			cartId,
			importedCount = currentLines.Count,
			items = currentLines.Select(i => new { perfumeId = i.PerfumeId, quantity = i.Quantity })
		});
	}

	public class MergeCartRequest
	{
		public string? CartId { get; set; }
		public List<MergeCartItem> Items { get; set; } = new();
	}

	public class MergeCartItem
	{
		public int PerfumeId { get; set; }
		public int Quantity { get; set; }
	}

	public class CartLine
	{
		public int PerfumeId { get; set; }
		public int Quantity { get; set; }
	}
}
