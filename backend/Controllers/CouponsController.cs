using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PerfumeEmpire.Authorization;
using PerfumeEmpire.Data;
using PerfumeEmpire.DTOs;
using PerfumeEmpire.Models;

namespace PerfumeEmpire.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CouponsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public CouponsController(ApplicationDbContext db)
        {
            _db = db;
        }

        public sealed class UpsertCouponDto
        {
            public string? Code { get; set; }
            public string? Type { get; set; }
            public decimal Amount { get; set; }
            public string? Title { get; set; }
            public bool? IsActive { get; set; }
        }

        private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "percent",
            "fixed",
            "free_shipping"
        };

        private static string NormalizeCode(string? code)
        {
            return (code ?? string.Empty).Trim().ToUpperInvariant();
        }

        private static string NormalizeType(string? type)
        {
            return string.IsNullOrWhiteSpace(type) ? "fixed" : type.Trim().ToLowerInvariant();
        }

        private static string BuildTitle(string code, string? title)
        {
            var cleaned = (title ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(cleaned) ? $"كوبون {code}" : cleaned;
        }

        [HttpGet]
        [RequirePermission(Permission.ManageCoupons)]
        public async Task<IActionResult> GetAll()
        {
            var coupons = await _db.Coupons
                .AsNoTracking()
                .OrderBy(c => c.Id)
                .Select(c => new
                {
                    id = c.Id,
                    type = c.Type,
                    amount = c.Amount,
                    title = c.Title,
                    isActive = c.IsActive,
                    updatedAt = c.UpdatedAt
                })
                .ToListAsync();

            return Ok(coupons);
        }

        [HttpPost]
        [RequirePermission(Permission.ManageCoupons)]
        public async Task<IActionResult> Create([FromBody] UpsertCouponDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "البيانات غير صالحة" });
            }

            var code = NormalizeCode(dto.Code);
            var type = NormalizeType(dto.Type);
            if (string.IsNullOrWhiteSpace(code))
            {
                return BadRequest(new { message = "كود الكوبون مطلوب" });
            }

            if (!AllowedTypes.Contains(type))
            {
                return BadRequest(new { message = "نوع الكوبون غير مدعوم" });
            }

            if (type == "percent" && (dto.Amount <= 0m || dto.Amount > 100m))
            {
                return BadRequest(new { message = "نسبة الخصم يجب أن تكون بين 0 و 100" });
            }

            if (type == "fixed" && dto.Amount <= 0m)
            {
                return BadRequest(new { message = "قيمة الخصم يجب أن تكون أكبر من 0" });
            }

            if (type == "free_shipping")
            {
                dto.Amount = 0m;
            }

            var exists = await _db.Coupons.AnyAsync(c => c.Id == code);
            if (exists)
            {
                return Conflict(new { message = "الكود موجود مسبقاً" });
            }

            var entry = new Coupon
            {
                Id = code,
                Type = type,
                Amount = dto.Amount,
                Title = BuildTitle(code, dto.Title),
                IsActive = dto.IsActive ?? true,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _db.Coupons.Add(entry);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                id = entry.Id,
                type = entry.Type,
                amount = entry.Amount,
                title = entry.Title,
                isActive = entry.IsActive,
                updatedAt = entry.UpdatedAt
            });
        }

        [HttpPut("{code}")]
        [RequirePermission(Permission.ManageCoupons)]
        public async Task<IActionResult> Update(string code, [FromBody] UpsertCouponDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "البيانات غير صالحة" });
            }

            var key = NormalizeCode(code);
            if (string.IsNullOrWhiteSpace(key))
            {
                return BadRequest(new { message = "كود الكوبون غير صالح" });
            }

            var type = NormalizeType(dto.Type);
            if (!AllowedTypes.Contains(type))
            {
                return BadRequest(new { message = "نوع الكوبون غير مدعوم" });
            }

            if (type == "percent" && (dto.Amount <= 0m || dto.Amount > 100m))
            {
                return BadRequest(new { message = "نسبة الخصم يجب أن تكون بين 0 و 100" });
            }

            if (type == "fixed" && dto.Amount <= 0m)
            {
                return BadRequest(new { message = "قيمة الخصم يجب أن تكون أكبر من 0" });
            }

            if (type == "free_shipping")
            {
                dto.Amount = 0m;
            }

            var current = await _db.Coupons.FirstOrDefaultAsync(c => c.Id == key);
            if (current == null)
            {
                return NotFound(new { message = "الكوبون غير موجود" });
            }

            current.Type = type;
            current.Amount = dto.Amount;
            current.Title = BuildTitle(key, dto.Title);
            current.IsActive = dto.IsActive ?? current.IsActive;
            current.UpdatedAt = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync();

            return Ok(new
            {
                id = current.Id,
                type = current.Type,
                amount = current.Amount,
                title = current.Title,
                isActive = current.IsActive,
                updatedAt = current.UpdatedAt
            });
        }

        [HttpDelete("{code}")]
        [RequirePermission(Permission.ManageCoupons)]
        public async Task<IActionResult> Delete(string code)
        {
            var key = NormalizeCode(code);
            if (string.IsNullOrWhiteSpace(key))
            {
                return BadRequest(new { message = "كود الكوبون غير صالح" });
            }

            var coupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Id == key);
            if (coupon == null)
            {
                return NotFound(new { message = "الكوبون غير موجود" });
            }

            _db.Coupons.Remove(coupon);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("validate")]
        public async Task<IActionResult> Validate([FromBody] ValidateCouponDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Code))
            {
                return BadRequest(new { valid = false, message = "يرجى تمرير كود الخصم" });
            }

            var key = NormalizeCode(dto.Code);
            var coupon = await _db.Coupons
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == key && c.IsActive);
            if (coupon == null)
            {
                return Ok(new { valid = false, message = "كود الخصم غير صالح" });
            }

            var type = coupon.Type;
            var amount = coupon.Amount;

            decimal discountAmount = 0m;
            decimal shippingAfter = 0m; // we'll compute shippingAfter only for free_shipping

            // Compute discount based on submitted subtotal
            if (type == "percent")
            {
                discountAmount = Math.Round(dto.Subtotal * (amount / 100m), 2);
            }
            else if (type == "fixed")
            {
                discountAmount = Math.Min(amount, dto.Subtotal);
            }
            else if (type == "free_shipping")
            {
                // indicate shipping will be zero; discount remains 0
                shippingAfter = 0m;
            }

            var result = new
            {
                valid = true,
                coupon = new { id = coupon.Id, type = type, amount = amount, title = coupon.Title },
                discountAmount = discountAmount,
                shippingAfterCoupon = shippingAfter,
                message = "تم التحقق من كود الخصم"
            };

            return Ok(result);
        }
    }
}
