using Microsoft.AspNetCore.Mvc;
using PerfumeEmpire.DTOs;

namespace PerfumeEmpire.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CouponsController : ControllerBase
    {
        // In-memory coupon catalog for development. Replace with DB in production.
        private static readonly Dictionary<string, object> _catalog = new()
        {
            ["WELCOME10"] = new { Id = "WELCOME10", Type = "percent", Amount = 10m, Title = "خصم 10% للترحيب" },
            ["SAR50"] = new { Id = "SAR50", Type = "fixed", Amount = 50m, Title = "خصم 50 ر.س" },
            ["SHIPFREE"] = new { Id = "SHIPFREE", Type = "free_shipping", Amount = 0m, Title = "شحن مجاني" }
        };

        [HttpPost("validate")]
        public IActionResult Validate([FromBody] ValidateCouponDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Code))
            {
                return BadRequest(new { valid = false, message = "يرجى تمرير كود الخصم" });
            }

            var key = dto.Code.Trim().ToUpperInvariant();
            if (!_catalog.TryGetValue(key, out var raw))
            {
                return Ok(new { valid = false, message = "كود الخصم غير صالح" });
            }

            // map to typed values
            var coupon = raw as dynamic;
            string type = coupon.Type ?? "fixed";
            decimal amount = coupon.Amount ?? 0m;

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
                coupon = new { id = coupon.Id, type = coupon.Type, amount = coupon.Amount, title = coupon.Title },
                discountAmount = discountAmount,
                shippingAfterCoupon = shippingAfter,
                message = "تم التحقق من كود الخصم"
            };

            return Ok(result);
        }
    }
}
