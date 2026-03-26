using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using PerfumeEmpire.Data;
using PerfumeEmpire.DTOs;
using PerfumeEmpire.Models;
using System.Linq;
using Microsoft.AspNetCore.Hosting;

namespace PerfumeEmpire.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public AuthController(ApplicationDbContext db, IConfiguration config, IWebHostEnvironment env)
    {
        _db = db;
        _config = config;
        _env = env;
    }

    private static string NormalizeRole(string? role)
    {
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)) return "Admin";
        return string.IsNullOrWhiteSpace(role) ? "Admin" : role;
    }

    private byte[] ResolveJwtKeyBytes()
    {
        var envJwt = Environment.GetEnvironmentVariable("JWT_KEY");
        var configJwt = _config["Jwt:Key"];
        var jwtKey = !string.IsNullOrWhiteSpace(envJwt) ? envJwt : configJwt;
        if (string.IsNullOrWhiteSpace(jwtKey))
        {
            throw new InvalidOperationException("JWT signing key is missing. Set Jwt:Key or JWT_KEY.");
        }

        var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
        if (keyBytes.Length < 32)
        {
            throw new InvalidOperationException("JWT signing key must be at least 32 bytes (256 bits).");
        }

        return keyBytes;
    }

    private Microsoft.AspNetCore.Http.CookieOptions BuildRefreshCookieOptions(DateTime expiresAt)
    {
        var secure = _env.IsProduction() || Request.IsHttps;
        return new Microsoft.AspNetCore.Http.CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = secure ? Microsoft.AspNetCore.Http.SameSiteMode.None : Microsoft.AspNetCore.Http.SameSiteMode.Lax,
            Expires = expiresAt,
            Path = "/"
        };
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginDto dto)
    {
        try
        {
            var normalizedUsername = (dto.Username ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedUsername))
            {
                return Unauthorized(new { message = "Invalid credentials" });
            }

            var loweredUsername = normalizedUsername.ToLower();
            var user = _db.Users.FirstOrDefault(u => u.Username.ToLower() == loweredUsername);
            if (user == null) return Unauthorized(new { message = "Invalid credentials" });

            // Verify hashed password
            var verified = BCrypt.Net.BCrypt.Verify(dto.Password, user.Password);
            if (!verified) return Unauthorized(new { message = "Invalid credentials" });

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = ResolveJwtKeyBytes();

            var normalizedRole = NormalizeRole(user.Role);
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, normalizedRole)
                , new Claim("permissions", user.Permissions.ToString())
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddHours(8),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var jwt = tokenHandler.WriteToken(token);

            // create refresh token
            var refresh = new RefreshToken
            {
                Token = Guid.NewGuid().ToString("N"),
                UserId = user.Id,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                CreatedAt = DateTime.UtcNow
            };
            _db.RefreshTokens.Add(refresh);
            _db.SaveChanges();

            // set refresh token as HttpOnly, Secure, SameSite=None cookie
            var cookieOptions = BuildRefreshCookieOptions(refresh.ExpiresAt);
            Response.Cookies.Append("refreshToken", refresh.Token, cookieOptions);

            return Ok(new { token = jwt, username = user.Username, role = normalizedRole });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("register")]
    public IActionResult Register([FromBody] LoginDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Username and password required" });

        if (_db.Users.Any(u => u.Username == dto.Username))
            return Conflict(new { message = "User already exists" });

        var hashed = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        var user = new User { Username = dto.Username, Password = hashed, Role = "Admin" };
        // In development, give seeded/registered admin a basic reporting permission to ease local testing
        if (_env.IsDevelopment())
        {
            user.Permissions = (long)PerfumeEmpire.Authorization.Permission.ViewReports;
        }
        _db.Users.Add(user);
        _db.SaveChanges();
        return Ok(new { username = user.Username });
    }

    [HttpPost("refresh")]
    public IActionResult Refresh([FromBody] RefreshDto? dto)
    {
        try
        {
            var cookieHeader = Request.Headers["Cookie"].ToString();
            Console.WriteLine("[AuthController.Refresh] Request Cookie header: " + cookieHeader);
            foreach (var c in Request.Cookies)
            {
                Console.WriteLine("[AuthController.Refresh] Cookie: " + c.Key + " = " + c.Value);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("[AuthController.Refresh] Logging failed: " + ex.Message);
        }
        // Prefer cookie-based refresh token when available
        var cookieToken = Request.Cookies["refreshToken"];
        var tokenToUse = cookieToken ?? dto?.RefreshToken;
        if (string.IsNullOrEmpty(tokenToUse)) return Unauthorized(new { message = "Invalid refresh token" });

        var stored = _db.RefreshTokens.FirstOrDefault(r => r.Token == tokenToUse);
        if (stored == null || stored.ExpiresAt < DateTime.UtcNow) return Unauthorized(new { message = "Invalid refresh token" });

        var user = _db.Users.FirstOrDefault(u => u.Id == stored.UserId);
        if (user == null) return Unauthorized();

        // generate new JWT
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = ResolveJwtKeyBytes();
        var normalizedRole = NormalizeRole(user.Role);
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, normalizedRole)
            , new Claim("permissions", user.Permissions.ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(8),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var jwt = tokenHandler.WriteToken(token);

        // rotate refresh token
        stored.Token = Guid.NewGuid().ToString("N");
        stored.ExpiresAt = DateTime.UtcNow.AddDays(7);
        _db.SaveChanges();

        var cookieOptions = BuildRefreshCookieOptions(stored.ExpiresAt);
        Response.Cookies.Append("refreshToken", stored.Token, cookieOptions);

        return Ok(new { token = jwt });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // Prefer cookie-based logout when available
        var cookieToken = Request.Cookies["refreshToken"];
        if (!string.IsNullOrEmpty(cookieToken))
        {
            var stored = _db.RefreshTokens.FirstOrDefault(r => r.Token == cookieToken);
            if (stored != null)
            {
                _db.RefreshTokens.Remove(stored);
                _db.SaveChanges();
            }
        }

        // Remove cookie on client by setting expired cookie
        var cookieOptions = BuildRefreshCookieOptions(DateTime.UtcNow.AddDays(-1));
        Response.Cookies.Append("refreshToken", "", cookieOptions);

        return Ok(new { message = "Logged out" });
    }

    [HttpPost("logout-cookie")]
    public IActionResult LogoutCookie()
    {
        var cookieToken = Request.Cookies["refreshToken"];
        if (!string.IsNullOrEmpty(cookieToken))
        {
            var stored = _db.RefreshTokens.FirstOrDefault(r => r.Token == cookieToken);
            if (stored != null)
            {
                _db.RefreshTokens.Remove(stored);
                _db.SaveChanges();
            }
        }

        var cookieOptions = BuildRefreshCookieOptions(DateTime.UtcNow.AddDays(-1));
        Response.Cookies.Append("refreshToken", "", cookieOptions);

        return Ok(new { message = "Logged out (cookie)" });
    }

    [HttpPost("logout-all")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public IActionResult LogoutAll()
    {
        var username = User.Identity?.Name;
        if (username == null) return Unauthorized();
        var user = _db.Users.FirstOrDefault(u => u.Username == username);
        if (user == null) return Unauthorized();

        var tokens = _db.RefreshTokens.Where(r => r.UserId == user.Id).ToList();
        if (tokens.Any())
        {
            _db.RefreshTokens.RemoveRange(tokens);
            _db.SaveChanges();
        }

        var cookieOptions = BuildRefreshCookieOptions(DateTime.UtcNow.AddDays(-1));
        Response.Cookies.Append("refreshToken", "", cookieOptions);

        return Ok(new { message = "All sessions logged out" });
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public IActionResult Me()
    {
        var username = User.Identity?.Name;
        if (username == null) return Unauthorized();
        var user = _db.Users.FirstOrDefault(u => u.Username == username);
        if (user == null) return Unauthorized();
        return Ok(new { username = user.Username, role = user.Role });
    }
}
