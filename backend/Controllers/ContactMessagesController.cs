using Microsoft.AspNetCore.Mvc;
using PerfumeEmpire.DTOs;
using System.Text.Json;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/contact-messages")]
public class ContactMessagesController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public ContactMessagesController(IWebHostEnvironment env)
    {
        _env = env;
    }

    private string MessagesPath()
    {
        var dir = Path.Combine(_env.ContentRootPath, "AppData");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "contact-messages.json");
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    [HttpPost]
    public IActionResult Create([FromBody] CreateContactMessageDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) ||
            string.IsNullOrWhiteSpace(dto.Email) ||
            string.IsNullOrWhiteSpace(dto.Phone) ||
            string.IsNullOrWhiteSpace(dto.Subject) ||
            string.IsNullOrWhiteSpace(dto.Message))
        {
            return BadRequest(new { message = "جميع الحقول مطلوبة" });
        }

        var path = MessagesPath();
        List<object> messages;

        try
        {
            if (System.IO.File.Exists(path))
            {
                var content = System.IO.File.ReadAllText(path);
                messages = JsonSerializer.Deserialize<List<object>>(content, JsonOptions) ?? new List<object>();
            }
            else
            {
                messages = new List<object>();
            }
        }
        catch
        {
            messages = new List<object>();
        }

        var entry = new
        {
            id = Guid.NewGuid().ToString("N"),
            name = dto.Name.Trim(),
            email = dto.Email.Trim(),
            phone = dto.Phone.Trim(),
            subject = dto.Subject.Trim(),
            message = dto.Message.Trim(),
            createdAt = DateTime.UtcNow
        };

        messages.Add(entry);
        System.IO.File.WriteAllText(path, JsonSerializer.Serialize(messages, JsonOptions));

        return Ok(new { message = "تم استلام رسالتك بنجاح" });
    }
}
