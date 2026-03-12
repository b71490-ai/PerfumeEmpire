using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.IO;
using SixLabors.ImageSharp.Processing;
using PerfumeEmpire.Data;
using PerfumeEmpire.Models;
using PerfumeEmpire.DTOs;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PerfumesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    // in-memory cache for product image hashes to avoid downloading and hashing every request
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, ulong> _productImageHashCache = new();
    private static readonly System.Net.Http.HttpClient _sharedHttpClient = new();

    public PerfumesController(ApplicationDbContext db)
    {
        _db = db;
    }

    // Try to compute and persist the product image hash for a perfume (best-effort)
    private async Task TryComputeAndPersistHashForPerfumeAsync(Perfume p)
    {
        if (p == null || string.IsNullOrWhiteSpace(p.ImageUrl)) return;
        try
        {
            using (var resp = await _sharedHttpClient.GetAsync(p.ImageUrl))
            {
                if (!resp.IsSuccessStatusCode) return;
                using (var ms2 = new MemoryStream())
                {
                    await resp.Content.CopyToAsync(ms2);
                    ms2.Seek(0, SeekOrigin.Begin);
                    var productHash = ComputeAverageHash(ms2);
                    _productImageHashCache[p.Id] = productHash;
                    p.Hash = unchecked((long)productHash);
                    _db.Perfumes.Update(p);
                    await _db.SaveChangesAsync();
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Compute/persist hash failed for product {p.Id}: {ex.Message}");
        }
    }

    // Compute average-hash (aHash) for an image stream. Returns 64-bit hash.
    private static ulong ComputeAverageHash(Stream imageStream)
    {
        imageStream.Seek(0, SeekOrigin.Begin);
        using (var raw = SixLabors.ImageSharp.Image.Load(imageStream))
        {
            // ensure EXIF orientation is applied before resizing
            raw.Mutate(x => x.AutoOrient());

            // resize to 8x8 for aHash
            raw.Mutate(x => x.Resize(new SixLabors.ImageSharp.Processing.ResizeOptions
            {
                Size = new SixLabors.ImageSharp.Size(8, 8),
                Mode = SixLabors.ImageSharp.Processing.ResizeMode.Crop
            }));

            using (var img = raw.CloneAs<SixLabors.ImageSharp.PixelFormats.Rgba32>())
            {
                float[] vals = new float[64];
                int idx = 0;
                for (int y = 0; y < 8; y++)
                for (int x = 0; x < 8; x++)
                {
                    var p = img[x, y];
                    // luminance
                    vals[idx++] = 0.299f * p.R + 0.587f * p.G + 0.114f * p.B;
                }

                // compute average
                float avg = vals.Average();
                ulong hash = 0UL;
                for (int i = 0; i < 64; i++)
                {
                    if (vals[i] >= avg)
                    {
                        hash |= (1UL << i);
                    }
                }
                return hash;
            }
        }
    }

    private static int HammingDistance(ulong a, ulong b)
    {
        ulong x = a ^ b;
        int setBits = 0;
        while (x != 0)
        {
            setBits += (int)(x & 1UL);
            x >>= 1;
        }
        return setBits;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        // Load perfumes and aggregate review + sales stats to surface social proof
        var perfumes = await _db.Perfumes.ToListAsync();

        var reviewStats = await _db.Reviews
            .GroupBy(r => r.PerfumeId)
            .Select(g => new { PerfumeId = g.Key, Count = g.Count(), Avg = g.Average(r => r.Rating) })
            .ToListAsync();

        var salesStats = await _db.OrderItems
            .GroupBy(oi => oi.PerfumeId)
            .Select(g => new { PerfumeId = g.Key, Purchased = g.Sum(oi => oi.Quantity) })
            .ToListAsync();

        var result = perfumes.Select(p => {
            var rs = reviewStats.FirstOrDefault(x => x.PerfumeId == p.Id);
            var ss = salesStats.FirstOrDefault(x => x.PerfumeId == p.Id);
            return new {
                p.Id,
                p.Name,
                p.Brand,
                p.Price,
                p.ImageUrl,
                p.Discount,
                p.Category,
                p.Stock,
                reviewsCount = rs?.Count ?? 0,
                averageRating = rs != null ? Math.Round(rs.Avg, 2) : 0,
                purchasedCount = ss?.Purchased ?? 0
            };
        });

        return Ok(result);
    }

    [HttpPost]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.CreateProduct)]
    public async Task<IActionResult> Create(CreatePerfumeDto dto)
    {
        var p = new Perfume
        {
            Name = dto.Name,
            Brand = dto.Brand,
            Price = dto.Price,
            ImageUrl = dto.ImageUrl,
            Discount = dto.Discount,
            Category = dto.Category,
            Stock = Math.Max(0, dto.Stock)
        };
        _db.Perfumes.Add(p);
        await _db.SaveChangesAsync();
        // best-effort compute and persist image hash
        _ = TryComputeAndPersistHashForPerfumeAsync(p);
        return CreatedAtAction(nameof(GetAll), new { id = p.Id }, p);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var perfume = await _db.Perfumes.FindAsync(id);
        if (perfume == null) return NotFound();

        var reviews = await _db.Reviews.Where(r => r.PerfumeId == id).ToListAsync();
        var averageRating = reviews.Count == 0 ? 0 : Math.Round(reviews.Average(r => r.Rating), 2);

        return Ok(new
        {
            perfume.Id,
            perfume.Name,
            perfume.Brand,
            perfume.Price,
            perfume.ImageUrl,
            perfume.Discount,
            perfume.Category,
            perfume.Stock,
            reviewsCount = reviews.Count,
            averageRating
        });
    }

    [HttpGet("{id}/reviews")]
    public async Task<IActionResult> GetReviews(int id)
    {
        var exists = await _db.Perfumes.AnyAsync(p => p.Id == id);
        if (!exists) return NotFound();

        var reviews = await _db.Reviews
            .Where(r => r.PerfumeId == id)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(reviews);
    }

    [HttpPost("{id}/reviews")]
    public async Task<IActionResult> AddReview(int id, [FromBody] CreateReviewDto dto)
    {
        var perfume = await _db.Perfumes.FindAsync(id);
        if (perfume == null) return NotFound();

        var name = (dto.CustomerName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "الاسم مطلوب" });
        if (dto.Rating < 1 || dto.Rating > 5) return BadRequest(new { message = "التقييم يجب أن يكون من 1 إلى 5" });

        var review = new Review
        {
            PerfumeId = id,
            CustomerName = name,
            Rating = dto.Rating,
            Comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Reviews.Add(review);
        await _db.SaveChangesAsync();
        return Ok(review);
    }

    [HttpPut("{id}")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.EditProduct)]
    public async Task<IActionResult> Update(int id, CreatePerfumeDto dto)
    {
        var perfume = await _db.Perfumes.FindAsync(id);
        if (perfume == null) return NotFound();

        perfume.Name = dto.Name;
        perfume.Brand = dto.Brand;
        perfume.Price = dto.Price;
        perfume.ImageUrl = dto.ImageUrl;
        perfume.Discount = dto.Discount;
        perfume.Category = dto.Category;
        perfume.Stock = Math.Max(0, dto.Stock);

        await _db.SaveChangesAsync();
        // asynchronously compute/persist hash if image url present
        _ = TryComputeAndPersistHashForPerfumeAsync(perfume);
        return Ok(perfume);
    }

    [HttpDelete("{id}")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.DeleteProduct)]
    public async Task<IActionResult> Delete(int id)
    {
        var perfume = await _db.Perfumes.FindAsync(id);
        if (perfume == null) return NotFound();

        _db.Perfumes.Remove(perfume);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("search-by-image")]
    public async Task<IActionResult> SearchByImage()
    {
        try
        {
            // quick validation: if client manually set Content-Type without boundary
            var requestContentType = Request.ContentType ?? string.Empty;
            if (requestContentType.StartsWith("multipart/form-data", StringComparison.OrdinalIgnoreCase) && !requestContentType.Contains("boundary="))
            {
                return BadRequest(new { message = "Invalid multipart request: missing boundary. لا تقم بتعيين Content-Type يدوياً — اترك المتصفح يضبطه تلقائياً." });
            }

            if (!Request.HasFormContentType)
            {
                return BadRequest(new { message = "الرجاء إرسال طلب multipart/form-data يحتوي على ملف الصورة (حقل 'image')." });
            }
            var form = await Request.ReadFormAsync();
            var file = form.Files.FirstOrDefault();
            if (file == null) return BadRequest(new { message = "الرجاء رفع صورة" });

            // server-side file validation
            const long MaxBytes = 5 * 1024 * 1024; // 5 MB
            if (file.Length <= 0 || file.Length > MaxBytes)
            {
                return BadRequest(new { message = $"حجم الملف غير مدعوم. الحد الأقصى {MaxBytes / (1024*1024)}MB." });
            }
            var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
            if (!contentType.StartsWith("image/") || !(contentType.Contains("jpeg") || contentType.Contains("jpg") || contentType.Contains("png") || contentType.Contains("webp")))
            {
                return BadRequest(new { message = "نوع الملف غير مدعوم. الرجاء رفع JPG أو PNG أو WEBP." });
            }
            // compute average-hash (aHash) of uploaded image for perceptual matching
            ulong queryHash = 0UL;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms);
                ms.Seek(0, SeekOrigin.Begin);
                try
                {
                    queryHash = ComputeAverageHash(ms);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Failed to decode uploaded image for hashing: {ex.Message}");
                    return BadRequest(new { message = "تعذر فك ترميز الصورة المرفوعة. الرجاء استخدام PNG أو JPG صالح." , detail = ex.Message });
                }
            }

            var items = await _db.Perfumes.ToListAsync();

            var results = new List<object>();
            foreach (var p in items)
            {
                float score = 0f;
                try
                {
                    if (!string.IsNullOrWhiteSpace(p.ImageUrl))
                    {
                        ulong productHash = 0UL;

                        // Prefer persisted hash from DB if present
                        if (p.Hash.HasValue)
                        {
                            productHash = unchecked((ulong)p.Hash.Value);
                            _productImageHashCache[p.Id] = productHash;
                        }

                        // compute or get cached product hash
                        if (!_productImageHashCache.TryGetValue(p.Id, out productHash) || productHash == 0UL)
                        {
                            try
                            {
                                using (var resp = await _sharedHttpClient.GetAsync(p.ImageUrl))
                                {
                                    if (resp.IsSuccessStatusCode)
                                    {
                                        using (var ms2 = new MemoryStream())
                                        {
                                            await resp.Content.CopyToAsync(ms2);
                                            ms2.Seek(0, SeekOrigin.Begin);
                                            productHash = ComputeAverageHash(ms2);
                                            _productImageHashCache[p.Id] = productHash;

                                            // persist computed hash back to DB for future requests
                                            try
                                            {
                                                p.Hash = unchecked((long)productHash);
                                                _db.Perfumes.Update(p);
                                                await _db.SaveChangesAsync();
                                            }
                                            catch (Exception ex)
                                            {
                                                Console.Error.WriteLine($"Failed to persist hash for product {p.Id}: {ex.Message}");
                                            }
                                        }
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.Error.WriteLine($"Failed to download/hash product image for '{p.Name}' ({p.ImageUrl}): {ex.Message}");
                            }
                        }

                        if (productHash != 0UL)
                        {
                            var hamming = HammingDistance(queryHash, productHash);
                            score = Math.Max(0f, 1f - (hamming / 64f));
                        }
                    }
                }
                catch { score = 0f; }

                results.Add(new {
                    p.Id,
                    p.Name,
                    p.Brand,
                    p.Price,
                    p.ImageUrl,
                    p.Discount,
                    p.Category,
                    p.Stock,
                    Score = score
                });
            }

            // sort descending by score
            var ordered = results.OrderByDescending(r => ((dynamic)r).Score).ToList();
            return Ok(ordered);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "خطأ معالجة الصورة", detail = ex.Message });
        }
    }

    [HttpPost("backfill-hashes")]
    [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.AllProducts)]
    public async Task<IActionResult> BackfillHashes([FromQuery] bool force = false)
    {
        var items = await _db.Perfumes.ToListAsync();
        var modified = new List<Perfume>();
        int processed = 0;

        foreach (var p in items)
        {
            processed++;
            try
            {
                if (!force && p.Hash.HasValue) continue;
                if (string.IsNullOrWhiteSpace(p.ImageUrl)) continue;

                using (var resp = await _sharedHttpClient.GetAsync(p.ImageUrl))
                {
                    if (!resp.IsSuccessStatusCode) continue;
                    using (var ms = new MemoryStream())
                    {
                        await resp.Content.CopyToAsync(ms);
                        ms.Seek(0, SeekOrigin.Begin);
                        var hash = ComputeAverageHash(ms);
                        p.Hash = unchecked((long)hash);
                        _productImageHashCache[p.Id] = hash;
                        modified.Add(p);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Backfill failed for product {p.Id}: {ex.Message}");
            }

            if (modified.Count >= 20)
            {
                _db.Perfumes.UpdateRange(modified);
                await _db.SaveChangesAsync();
                modified.Clear();
            }
        }

        if (modified.Count > 0)
        {
            _db.Perfumes.UpdateRange(modified);
            await _db.SaveChangesAsync();
            modified.Clear();
        }

        var updatedCount = await _db.Perfumes.CountAsync(x => x.Hash != null);
        return Ok(new { message = "Backfill complete", processed, updated = updatedCount });
    }
}
