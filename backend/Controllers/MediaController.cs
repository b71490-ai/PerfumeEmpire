using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PerfumeEmpire.Controllers
{
    [ApiController]
    public class MediaController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp", ".gif"
        };
        private const long MaxUploadBytes = 5 * 1024 * 1024;

        public MediaController(IWebHostEnvironment env)
        {
            _env = env;
        }

        [HttpPost("/admin/media/upload")]
        [PerfumeEmpire.Authorization.RequirePermission(PerfumeEmpire.Authorization.Permission.ManageProducts)]
        public async Task<IActionResult> Upload([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest(new { error = "no_file" });
            if (file.Length > MaxUploadBytes) return BadRequest(new { error = "file_too_large", maxBytes = MaxUploadBytes });

            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
                return BadRequest(new { error = "invalid_file_type" });

            if (string.IsNullOrWhiteSpace(file.ContentType) || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "invalid_content_type" });

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var uploads = Path.Combine(webRoot, "media", "uploads");
            if (!Directory.Exists(uploads)) Directory.CreateDirectory(uploads);

            var fileName = Guid.NewGuid().ToString("N") + ext;
            var filePath = Path.Combine(uploads, fileName);

            using (var stream = System.IO.File.Create(filePath))
            {
                await file.CopyToAsync(stream);
            }

            var urlPath = $"/media/uploads/{fileName}";
            return Ok(new { url = urlPath });
        }
    }
}
