using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PerfumeEmpire.Data;
using Microsoft.AspNetCore.Authorization;
using PerfumeEmpire.DTOs;
using PerfumeEmpire.Models;
using System.Text;
using System.Linq;
using System.Text.Json;
using System.Globalization;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using StackExchange.Redis;
using Microsoft.Extensions.Configuration;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IDatabase? _redisDb;
    private const decimal VatRate = 0.15m;
    private const decimal FreeShippingThreshold = 500m;
    private const decimal ShippingFee = 50m;
    private const int OtpLifetimeMinutes = 5;
    private const int AccessSessionLifetimeMinutes = 20;
    private const int OtpMaxAttempts = 5;
    private static readonly HashSet<string> AllowedCheckoutPaymentMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "online", "cash_on_delivery"
    };
    private static readonly ConcurrentDictionary<string, CustomerOtpChallenge> CustomerOtpChallenges = new();
    private static readonly ConcurrentDictionary<string, CustomerAccessSession> CustomerAccessSessions = new();
    private static ConnectionMultiplexer? _redisConnection;

    private sealed class CustomerOtpChallenge
    {
        public string Phone { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public DateTime ExpiresAtUtc { get; set; }
        public int AttemptsRemaining { get; set; }
    }

    private sealed class CustomerAccessSession
    {
        public string Phone { get; set; } = string.Empty;
        public DateTime ExpiresAtUtc { get; set; }
    }

    public OrdersController(ApplicationDbContext db, IWebHostEnvironment env, IConfiguration config, IConnectionMultiplexer? redis = null)
    {
        _db = db;
        _env = env;

        // Prefer DI-registered Redis connection when available
        if (redis != null)
        {
            try
            {
                _redisDb = redis.GetDatabase();
                Console.WriteLine("[OrdersController] Using DI-provided Redis for OTP/session persistence.");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[OrdersController] Redis (DI) init failed: " + ex.Message);
            }
        }
        else
        {
            // Fallback: attempt to initialize Redis via configuration (legacy support)
            var redisConn = config["Redis:Connection"] ?? Environment.GetEnvironmentVariable("REDIS_CONNECTION");
            if (!string.IsNullOrWhiteSpace(redisConn))
            {
                try
                {
                    _redisConnection ??= ConnectionMultiplexer.Connect(redisConn);
                    _redisDb = _redisConnection.GetDatabase();
                    Console.WriteLine("[OrdersController] Redis enabled for OTP/session persistence (fallback).");
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("[OrdersController] Redis connection failed (fallback): " + ex.Message);
                }
            }
        }
    }

    private string SettingsPath()
    {
        var dir = Path.Combine(_env.ContentRootPath, "AppData");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "store-settings.json");
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private StoreSettingsDto ReadStoreSettings()
    {
        var path = SettingsPath();
        try
        {
            if (!System.IO.File.Exists(path)) return new StoreSettingsDto();
            var content = System.IO.File.ReadAllText(path);
            return JsonSerializer.Deserialize<StoreSettingsDto>(content, JsonOptions) ?? new StoreSettingsDto();
        }
        catch
        {
            return new StoreSettingsDto();
        }
    }

    private static string NormalizePhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var latinDigits = value
            .Replace('٠', '0').Replace('١', '1').Replace('٢', '2').Replace('٣', '3').Replace('٤', '4')
            .Replace('٥', '5').Replace('٦', '6').Replace('٧', '7').Replace('٨', '8').Replace('٩', '9')
            .Replace('۰', '0').Replace('۱', '1').Replace('۲', '2').Replace('۳', '3').Replace('۴', '4')
            .Replace('۵', '5').Replace('۶', '6').Replace('۷', '7').Replace('۸', '8').Replace('۹', '9');

        return new string(latinDigits.Where(char.IsDigit).ToArray());
    }

    private static string NormalizeOtpCode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        return NormalizePhone(value);
    }

    private static string GenerateOtpCode()
    {
        var otpValue = RandomNumberGenerator.GetInt32(0, 1_000_000);
        return otpValue.ToString("D6", CultureInfo.InvariantCulture);
    }

    private bool TryValidateAccessSession(string? accessToken, string normalizedPhone)
    {
        if (string.IsNullOrWhiteSpace(accessToken) || string.IsNullOrWhiteSpace(normalizedPhone))
            return false;
        // Prefer Redis-backed session when available
        if (_redisDb != null)
        {
            try
            {
                var key = $"access:{accessToken}";
                var stored = _redisDb.StringGet(key);
                if (!stored.HasValue) return false;
                var phone = stored.ToString();
                return string.Equals(phone, normalizedPhone, StringComparison.Ordinal);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[CustomerAccess] Redis get failed: " + ex.Message);
                // fall back to in-memory
            }
        }

        if (!CustomerAccessSessions.TryGetValue(accessToken, out var session))
            return false;

        if (session.ExpiresAtUtc <= DateTime.UtcNow)
        {
            CustomerAccessSessions.TryRemove(accessToken, out _);
            return false;
        }

        return string.Equals(session.Phone, normalizedPhone, StringComparison.Ordinal);
    }

    [HttpPost("customer/request-otp")]
    public IActionResult RequestCustomerOtp([FromBody] RequestCustomerOtpDto dto)
    {
        var normalizedPhone = NormalizePhone(dto.Phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
            return BadRequest(new { message = "رقم الهاتف مطلوب" });

        var now = DateTime.UtcNow;
        var code = GenerateOtpCode();
        var challenge = new CustomerOtpChallenge
        {
            Phone = normalizedPhone,
            Code = code,
            ExpiresAtUtc = now.AddMinutes(OtpLifetimeMinutes),
            AttemptsRemaining = OtpMaxAttempts
        };

        CustomerOtpChallenges[normalizedPhone] = challenge;

        // persist to Redis when available
        if (_redisDb != null)
        {
            try
            {
                var key = $"otp:{normalizedPhone}";
                var payload = JsonSerializer.Serialize(challenge, JsonOptions);
                _redisDb.StringSet(key, payload, TimeSpan.FromMinutes(OtpLifetimeMinutes));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[CustomerOTP] Redis set failed: " + ex.Message);
                try
                {
                    var logPath = Path.Combine(_env.ContentRootPath, "AppData", "diagnostics.log");
                    Directory.CreateDirectory(Path.GetDirectoryName(logPath) ?? ".");
                    System.IO.File.AppendAllText(logPath, $"{DateTime.UtcNow:O} [CustomerOTP] Redis set failed: {ex.Message}\n");
                }
                catch { }
            }
        }

        Console.WriteLine($"[CustomerOTP] Phone={normalizedPhone}, Code={code}, ExpiresAt={challenge.ExpiresAtUtc:O}");

        if (_env.IsDevelopment())
        {
            return Ok(new
            {
                message = "تم إرسال رمز التحقق.",
                expiresAt = challenge.ExpiresAtUtc,
                devOtpCode = code
            });
        }

        return Ok(new
        {
            message = "تم إرسال رمز التحقق.",
            expiresAt = challenge.ExpiresAtUtc
        });
    }

    [HttpPost("customer/verify-otp")]
    public IActionResult VerifyCustomerOtp([FromBody] VerifyCustomerOtpDto dto)
    {
        var normalizedPhone = NormalizePhone(dto.Phone);
        var normalizedCode = NormalizeOtpCode(dto.Code);

        if (string.IsNullOrWhiteSpace(normalizedPhone))
            return BadRequest(new { message = "رقم الهاتف مطلوب" });

        if (normalizedCode.Length != 6)
            return BadRequest(new { message = "رمز التحقق غير صالح" });

        CustomerOtpChallenge? challenge = null;
        if (_redisDb != null)
        {
            try
            {
                var key = $"otp:{normalizedPhone}";
                var stored = _redisDb.StringGet(key);
                if (stored.HasValue)
                {
                    challenge = JsonSerializer.Deserialize<CustomerOtpChallenge>(stored!, JsonOptions);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[CustomerOTP] Redis get failed: " + ex.Message);
                try
                {
                    var logPath = Path.Combine(_env.ContentRootPath, "AppData", "diagnostics.log");
                    Directory.CreateDirectory(Path.GetDirectoryName(logPath) ?? ".");
                    System.IO.File.AppendAllText(logPath, $"{DateTime.UtcNow:O} [CustomerOTP] Redis get failed: {ex.Message}\n");
                }
                catch { }
            }
        }

        if (challenge == null && !CustomerOtpChallenges.TryGetValue(normalizedPhone, out challenge))
            return BadRequest(new { message = "يرجى طلب رمز تحقق جديد" });

        if (challenge.ExpiresAtUtc <= DateTime.UtcNow)
        {
            CustomerOtpChallenges.TryRemove(normalizedPhone, out _);
            if (_redisDb != null)
            {
                try { _redisDb.KeyDelete($"otp:{normalizedPhone}"); } catch { }
            }
            return BadRequest(new { message = "انتهت صلاحية رمز التحقق، اطلب رمزًا جديدًا" });
        }

        if (!string.Equals(challenge.Code, normalizedCode, StringComparison.Ordinal))
        {
            challenge.AttemptsRemaining -= 1;

            if (challenge.AttemptsRemaining <= 0)
            {
                CustomerOtpChallenges.TryRemove(normalizedPhone, out _);
                if (_redisDb != null)
                {
                    try { _redisDb.KeyDelete($"otp:{normalizedPhone}"); } catch { }
                }
                return BadRequest(new { message = "تم تجاوز عدد المحاولات، اطلب رمزًا جديدًا" });
            }

            CustomerOtpChallenges[normalizedPhone] = challenge;
            if (_redisDb != null)
            {
                try
                {
                    var key = $"otp:{normalizedPhone}";
                    var payload = JsonSerializer.Serialize(challenge, JsonOptions);
                    _redisDb.StringSet(key, payload, TimeSpan.FromMinutes(OtpLifetimeMinutes));
                }
                catch { }
            }

            return BadRequest(new
            {
                message = "رمز التحقق غير صحيح",
                attemptsRemaining = challenge.AttemptsRemaining
            });
        }

        CustomerOtpChallenges.TryRemove(normalizedPhone, out _);
        if (_redisDb != null)
        {
            try { _redisDb.KeyDelete($"otp:{normalizedPhone}"); } catch { }
        }

        var accessToken = Guid.NewGuid().ToString("N");
        var expiresAt = DateTime.UtcNow.AddMinutes(AccessSessionLifetimeMinutes);
        CustomerAccessSessions[accessToken] = new CustomerAccessSession
        {
            Phone = normalizedPhone,
            ExpiresAtUtc = expiresAt
        };
        if (_redisDb != null)
        {
            try { _redisDb.StringSet($"access:{accessToken}", normalizedPhone, TimeSpan.FromMinutes(AccessSessionLifetimeMinutes)); } catch { }
        }

        return Ok(new
        {
            accessToken,
            expiresAt
        });
    }

    private async Task<bool> TryRestoreStockAsync(PerfumeEmpire.Models.Order order)
    {
        if (order.StockRestored) return true;

        var items = await _db.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync();
        var perfumeIds = items.Select(i => i.PerfumeId).Distinct().ToList();
        var perfumes = await _db.Perfumes.Where(p => perfumeIds.Contains(p.Id)).ToListAsync();
        var perfumeById = perfumes.ToDictionary(p => p.Id, p => p);

        foreach (var item in items)
        {
            if (perfumeById.TryGetValue(item.PerfumeId, out var perfume))
            {
                perfume.Stock += item.Quantity;
            }
        }

        order.StockRestored = true;
        return true;
    }

    private async Task<bool> TryReapplyStockAsync(PerfumeEmpire.Models.Order order)
    {
        if (!order.StockRestored) return true;

        var items = await _db.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync();
        var perfumeIds = items.Select(i => i.PerfumeId).Distinct().ToList();
        var perfumes = await _db.Perfumes.Where(p => perfumeIds.Contains(p.Id)).ToListAsync();
        var perfumeById = perfumes.ToDictionary(p => p.Id, p => p);

        foreach (var item in items)
        {
            if (!perfumeById.TryGetValue(item.PerfumeId, out var perfume)) continue;
            if (perfume.Stock < item.Quantity) return false;
        }

        foreach (var item in items)
        {
            if (perfumeById.TryGetValue(item.PerfumeId, out var perfume))
            {
                perfume.Stock -= item.Quantity;
            }
        }

        order.StockRestored = false;
        return true;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "Order items are required" });

        var normalizedPaymentMethod = string.IsNullOrWhiteSpace(dto.PaymentMethod)
            ? "cash_on_delivery"
            : dto.PaymentMethod.Trim().ToLowerInvariant();

        if (!AllowedCheckoutPaymentMethods.Contains(normalizedPaymentMethod))
            return BadRequest(new { message = "طريقة الدفع غير مدعومة" });

        var storeSettings = ReadStoreSettings();
        var onlineConfigured = storeSettings.PaymentEnabled
            && !string.Equals(storeSettings.PaymentProvider, "none", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(storeSettings.PaymentPublicKey)
            && !string.IsNullOrWhiteSpace(storeSettings.PaymentSecretKey);

        if (normalizedPaymentMethod == "online" && !onlineConfigured)
            return BadRequest(new { message = "الدفع الإلكتروني غير متاح حالياً، اختر الدفع عند الاستلام." });

        if (normalizedPaymentMethod == "cash_on_delivery" && !storeSettings.CodEnabled)
            return BadRequest(new { message = "الدفع عند الاستلام غير متاح حالياً، اختر الدفع الإلكتروني." });

        var perfumeIds = dto.Items.Select(i => i.PerfumeId).Distinct().ToList();
        var perfumes = await _db.Perfumes.Where(p => perfumeIds.Contains(p.Id)).ToListAsync();
        var perfumeById = perfumes.ToDictionary(p => p.Id, p => p);

        foreach (var item in dto.Items)
        {
            if (!perfumeById.TryGetValue(item.PerfumeId, out var perfume))
                return BadRequest(new { message = $"المنتج رقم {item.PerfumeId} غير موجود" });

            if (item.Quantity <= 0)
                return BadRequest(new { message = $"الكمية غير صحيحة للمنتج {perfume.Name}" });

            if (perfume.Stock < item.Quantity)
                return BadRequest(new
                {
                    message = $"الكمية غير متوفرة للمنتج {perfume.Name}",
                    perfumeId = perfume.Id,
                    availableStock = perfume.Stock
                });
        }

        var normalizedPhone = NormalizePhone(dto.Phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
            return BadRequest(new { message = "رقم الهاتف مطلوب" });

        decimal subtotal = 0m;
        decimal preDiscountSubtotal = 0m;

        var order = new PerfumeEmpire.Models.Order
        {
            CustomerName = dto.CustomerName,
            Email = dto.Email,
            Phone = normalizedPhone,
            Address = dto.Address,
            PaymentMethod = normalizedPaymentMethod,
            PaymentStatus = PaymentStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var it in dto.Items)
        {
            var perfume = perfumeById[it.PerfumeId];
            var effectivePrice = perfume.Discount > 0
                ? perfume.Price - (perfume.Price * perfume.Discount / 100m)
                : perfume.Price;

            order.Items.Add(new OrderItem
            {
                PerfumeId = it.PerfumeId,
                Name = string.IsNullOrWhiteSpace(it.Name) ? (perfume.Name ?? "") : it.Name,
                Price = effectivePrice,
                Quantity = it.Quantity
            });

            preDiscountSubtotal += perfume.Price * it.Quantity;
            subtotal += effectivePrice * it.Quantity;

            perfume.Stock -= it.Quantity;
        }

        var discount = Math.Max(0m, preDiscountSubtotal - subtotal);
        var shipping = subtotal >= FreeShippingThreshold ? 0m : ShippingFee;
        var vat = (subtotal + shipping) * VatRate;
        var total = subtotal + shipping + vat;

        order.Subtotal = decimal.Round(subtotal, 2);
        order.Discount = decimal.Round(discount, 2);
        order.Shipping = decimal.Round(shipping, 2);
        order.Vat = decimal.Round(vat, 2);
        order.Total = decimal.Round(total, 2);

        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            _db.Orders.Add(order);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            try { await tx.RollbackAsync(); } catch { }
            throw;
        }

        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    [HttpGet("customer")]
    public async Task<IActionResult> GetCustomerOrders([FromQuery] string phone, [FromQuery] string accessToken)
    {
        var normalizedPhone = NormalizePhone(phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
            return BadRequest(new { message = "Phone is required" });

        if (!TryValidateAccessSession(accessToken, normalizedPhone))
            return Unauthorized(new { message = "OTP verification is required" });

        var candidates = await _db.Orders
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .Take(200)
            .ToListAsync();

        var items = candidates
            .Where(o => NormalizePhone(o.Phone) == normalizedPhone)
            .Take(30)
            .ToList();

        return Ok(items.Select(order => new
        {
            id = order.Id,
            customerName = order.CustomerName,
            email = order.Email,
            phone = NormalizePhone(order.Phone),
            address = order.Address,
            status = order.Status,
            paymentStatus = order.PaymentStatus,
            paymentMethod = order.PaymentMethod,
            createdAt = order.CreatedAt,
            subtotal = order.Subtotal,
            discount = order.Discount,
            shipping = order.Shipping,
            vat = order.Vat,
            total = order.Total,
            items = order.Items.Select(i => new
            {
                id = i.Id,
                perfumeId = i.PerfumeId,
                name = i.Name,
                price = i.Price,
                quantity = i.Quantity
            })
        }));
    }

    [HttpGet("track/{id:int}")]
    public async Task<IActionResult> TrackOrder(int id, [FromQuery] string phone, [FromQuery] string accessToken)
    {
        var normalizedPhone = NormalizePhone(phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
            return BadRequest(new { message = "Phone is required" });

        if (!TryValidateAccessSession(accessToken, normalizedPhone))
            return Unauthorized(new { message = "OTP verification is required" });

        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        var orderPhone = NormalizePhone(order.Phone);
        if (!string.Equals(orderPhone, normalizedPhone, StringComparison.Ordinal))
            return NotFound();

        return Ok(new
        {
            id = order.Id,
            customerName = order.CustomerName,
            email = order.Email,
            phone = NormalizePhone(order.Phone),
            address = order.Address,
            status = order.Status,
            paymentStatus = order.PaymentStatus,
            paymentMethod = order.PaymentMethod,
            createdAt = order.CreatedAt,
            subtotal = order.Subtotal,
            discount = order.Discount,
            shipping = order.Shipping,
            vat = order.Vat,
            total = order.Total,
            items = order.Items.Select(i => new
            {
                id = i.Id,
                perfumeId = i.PerfumeId,
                name = i.Name,
                price = i.Price,
                quantity = i.Quantity
            })
        });
    }

    [HttpGet]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ViewOrders)]
    public async Task<IActionResult> GetAll()
    {
        var items = await _db.Orders.Include(o => o.Items).OrderBy(o => o.Id).ToListAsync();
        return Ok(items);
    }

    [HttpGet("{id:int}")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ViewOrders)]
    public async Task<IActionResult> GetById(int id)
    {
        var order = await _db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();
        return Ok(order);
    }

    [HttpGet("{id:int}/history")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ViewOrders)]
    public async Task<IActionResult> GetHistory(int id)
    {
        var history = await _db.OrderStatusChanges
            .Where(h => h.OrderId == id)
            .OrderByDescending(h => h.ChangedAt)
            .ToListAsync();
        return Ok(history);
    }

    [HttpPut("{id:int}/status")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.UpdateOrderStatus)]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateOrderStatusDto dto)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        // Additional check: cancelling an order requires explicit CancelOrders permission
        if (dto.Status == PerfumeEmpire.Models.OrderStatus.Cancelled)
        {
            var permClaim = User?.FindFirst("permissions")?.Value;
            if (string.IsNullOrEmpty(permClaim) || !long.TryParse(permClaim, out var permValue) || (permValue & (long)PerfumeEmpire.Authorization.Permission.CancelOrders) != (long)PerfumeEmpire.Authorization.Permission.CancelOrders)
            {
                return Forbid();
            }
        }

        var old = order.Status;
        order.Status = dto.Status;

        if (dto.Status == OrderStatus.Cancelled)
        {
            await TryRestoreStockAsync(order);
        }
        else if (old == OrderStatus.Cancelled && dto.Status != OrderStatus.Cancelled)
        {
            var reapplied = await TryReapplyStockAsync(order);
            if (!reapplied)
                return BadRequest(new { message = "لا يمكن إعادة تفعيل الطلب بسبب نقص المخزون" });
        }

        // record audit entry
        var changedBy = User?.Identity?.Name ?? "system";
        var audit = new OrderStatusChange
        {
            OrderId = order.Id,
            OldStatus = old,
            NewStatus = dto.Status,
            ChangedAt = DateTime.UtcNow,
            ChangedBy = changedBy
        };
        _db.OrderStatusChanges.Add(audit);

        // Use an explicit transaction to ensure both the order update and audit
        // entry are saved atomically.
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Failed to update order status and audit: " + ex);
            try { await tx.RollbackAsync(); } catch { }
            throw;
        }

        return Ok(order);
    }

    [HttpPut("{id:int}/payment-status")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.UpdateOrderStatus)]
    public async Task<IActionResult> UpdatePaymentStatus(int id, [FromBody] UpdateOrderPaymentStatusDto dto)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        order.PaymentStatus = dto.PaymentStatus;

        if (dto.PaymentStatus == PaymentStatus.Refunded && order.Status != OrderStatus.Cancelled)
        {
            order.Status = OrderStatus.Cancelled;
            await TryRestoreStockAsync(order);
        }

        await _db.SaveChangesAsync();

        return Ok(order);
    }

    [HttpGet("export/csv")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ViewOrders)]
    public async Task<IActionResult> ExportCsv()
    {
        var orders = await _db.Orders.Include(o => o.Items).OrderBy(o => o.Id).ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("Id,CustomerName,Email,Phone,Total,Status,PaymentMethod,CreatedAt,Items");

        string Escape(string s) => string.IsNullOrEmpty(s) ? "" : s.Replace("\"", "\"\"");
        string ToLatinDigits(string s)
        {
            if (string.IsNullOrEmpty(s)) return string.Empty;

            return s
                .Replace('٠', '0').Replace('١', '1').Replace('٢', '2').Replace('٣', '3').Replace('٤', '4')
                .Replace('٥', '5').Replace('٦', '6').Replace('٧', '7').Replace('٨', '8').Replace('٩', '9')
                .Replace('۰', '0').Replace('۱', '1').Replace('۲', '2').Replace('۳', '3').Replace('۴', '4')
                .Replace('۵', '5').Replace('۶', '6').Replace('۷', '7').Replace('۸', '8').Replace('۹', '9');
        }

        foreach (var o in orders)
        {
            var statusLabel = o.Status switch
            {
                OrderStatus.Pending => "قيد التجهيز",
                OrderStatus.Processing => "قيد المعالجة",
                OrderStatus.Shipped => "قيد الشحن",
                OrderStatus.Completed => "تم التوصيل",
                OrderStatus.Cancelled => "ملغى",
                _ => o.Status.ToString()
            };

            var items = ToLatinDigits(string.Join("; ", o.Items.Select(i => $"{Escape(i.Name)}x{i.Quantity}")));
            var paymentMethodLabel = o.PaymentMethod switch
            {
                "online" => "دفع إلكتروني",
                "cash_on_delivery" => "دفع عند الاستلام",
                _ => o.PaymentMethod ?? "-"
            };

            var totalText = o.Total.ToString(CultureInfo.InvariantCulture);
            var line = $"{o.Id},\"{Escape(ToLatinDigits(o.CustomerName))}\",\"{Escape(ToLatinDigits(o.Email))}\",\"{Escape(ToLatinDigits(o.Phone))}\",{totalText},\"{Escape(ToLatinDigits(statusLabel))}\",\"{Escape(ToLatinDigits(paymentMethodLabel))}\",\"{o.CreatedAt:O}\",\"{Escape(items)}\"";
            sb.AppendLine(line);
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv; charset=utf-8", "orders_export.csv");
    }
}
