using Microsoft.EntityFrameworkCore;
using PerfumeEmpire.Data;
using PerfumeEmpire.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// If a .env file exists in the project root load it into environment variables
// This makes local development easier without changing production behavior.
try
{
    var envPath = Path.Combine(builder.Environment.ContentRootPath ?? Directory.GetCurrentDirectory(), ".env");
    if (File.Exists(envPath))
    {
        DotNetEnv.Env.Load(envPath);
        Console.WriteLine("[Program] Loaded .env file: " + envPath);
    }
}
catch { }

// JWT key must be provided via configuration/secrets. Reject default development key.
// Ensure key length >= 32 bytes for HMAC-SHA256
// Support reading JWT key from either configuration key `Jwt:Key` or env `JWT_KEY` (common pattern)
var jwtCandidate = builder.Configuration["Jwt:Key"];
var envJwt = Environment.GetEnvironmentVariable("JWT_KEY");
Console.WriteLine($"[Program] Config Jwt:Key present: {!string.IsNullOrWhiteSpace(jwtCandidate)}, length: {(jwtCandidate?.Length ?? 0)}");
Console.WriteLine($"[Program] Env JWT_KEY present: {!string.IsNullOrWhiteSpace(envJwt)}, length: {(envJwt?.Length ?? 0)}");
if (string.IsNullOrWhiteSpace(jwtCandidate))
{
    jwtCandidate = envJwt;
}
if (string.IsNullOrWhiteSpace(jwtCandidate) || jwtCandidate.Length < 32 || (jwtCandidate ?? string.Empty).Contains("dev_secret"))
{
    var msg = "Invalid or missing Jwt:Key. Set a strong secret via environment or secret manager (minimum 32 chars).\n" +
              "Startup aborted to avoid using an insecure default key.";
    Console.Error.WriteLine(msg);
    throw new InvalidOperationException(msg);
}

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add CORS (development: allow localhost origins)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin)) return false;
                return origin.StartsWith("http://localhost:") || origin.StartsWith("http://127.0.0.1:");
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Configure DbContext (SQLite for persistence)
var sqliteConn = builder.Configuration["ConnectionStrings:Default"] ?? "Data Source=perfume.db";
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(sqliteConn));

// Register Redis connection if configured (Redis:Connection or REDIS_CONNECTION)
var redisConn = builder.Configuration["Redis:Connection"] ?? Environment.GetEnvironmentVariable("REDIS_CONNECTION");
if (!string.IsNullOrWhiteSpace(redisConn))
{
    try
    {
        var mux = ConnectionMultiplexer.Connect(redisConn);
        builder.Services.AddSingleton<IConnectionMultiplexer>(mux);
        Console.WriteLine("[Program] Registered Redis ConnectionMultiplexer.");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine("[Program] Failed to connect/register Redis: " + ex.Message);
    }
}

// JWT Authentication
var jwtKey = jwtCandidate!;
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes)
        };
    });

builder.Services.AddAuthorization();



var app = builder.Build();

// Seed data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    // Apply any pending EF Core migrations. This is safer for production than
    // automatically dropping and recreating the database.
    try
    {
        db.Database.Migrate();

        db.Database.ExecuteSqlRaw(@"
            UPDATE Orders
            SET Phone = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(Phone,
                        '٠','0'),'١','1'),'٢','2'),'٣','3'),'٤','4'),'٥','5'),'٦','6'),'٧','7'),'٨','8'),'٩','9'),
                        '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9')
            WHERE Phone IS NOT NULL;
        ");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine("Failed to apply migrations: " + ex.Message);
        // Do not recreate or delete production data here. Surface the error so
        // operators can run migrations manually or inspect the issue.
    }

    if (!db.Perfumes.Any())
    {
        db.Perfumes.AddRange(
            // عطور رجالي
            new Perfume { Name = "Bleu de Chanel", Brand = "Chanel", Price = 450, ImageUrl = "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400", Discount = 20, Category = "men", Stock = 18 },
            new Perfume { Name = "Sauvage", Brand = "Dior", Price = 380, ImageUrl = "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=400", Discount = 15, Category = "men", Stock = 25 },
            new Perfume { Name = "One Million", Brand = "Paco Rabanne", Price = 320, ImageUrl = "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400", Discount = 0, Category = "men", Stock = 12 },
            
            // عطور نسائي
            new Perfume { Name = "La Vie Est Belle", Brand = "Lancôme", Price = 420, ImageUrl = "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=400", Discount = 10, Category = "women", Stock = 20 },
            new Perfume { Name = "Chanel No. 5", Brand = "Chanel", Price = 500, ImageUrl = "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=400", Discount = 5, Category = "women", Stock = 15 },
            new Perfume { Name = "Miss Dior", Brand = "Dior", Price = 460, ImageUrl = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400", Discount = 12, Category = "women", Stock = 14 },
            
            // بخور وعود
            new Perfume { Name = "Oud Wood", Brand = "Tom Ford", Price = 850, ImageUrl = "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=400", Discount = 25, Category = "incense", Stock = 8 },
            new Perfume { Name = "بخور ملكي", Brand = "العطور الشرقية", Price = 280, ImageUrl = "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=400", Discount = 15, Category = "incense", Stock = 30 },
            new Perfume { Name = "عود كمبودي", Brand = "الحرمين", Price = 650, ImageUrl = "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=400", Discount = 20, Category = "incense", Stock = 10 },
            
            // أدوات تجميل
            new Perfume { Name = "مجموعة مكياج فاخرة", Brand = "MAC", Price = 350, ImageUrl = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400", Discount = 18, Category = "cosmetics", Stock = 16 },
            new Perfume { Name = "سيروم للبشرة", Brand = "Estee Lauder", Price = 290, ImageUrl = "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400", Discount = 8, Category = "cosmetics", Stock = 22 },
            new Perfume { Name = "مجموعة عناية بالبشرة", Brand = "Lancôme", Price = 480, ImageUrl = "https://images.unsplash.com/photo-1571875257727-256c39da42af?w=400", Discount = 22, Category = "cosmetics", Stock = 9 }
        );
        db.SaveChanges();
    }
    else if (db.Perfumes.All(p => p.Stock == 0))
    {
        foreach (var perfume in db.Perfumes)
        {
            perfume.Stock = 20;
        }
        db.SaveChanges();
    }

    // Seed admin user for development (replace with real user management in production)
    if (!db.Users.Any())
    {
        var hashed = BCrypt.Net.BCrypt.HashPassword("admin123");
        db.Users.Add(new User { Username = "admin", Password = hashed, Role = "Admin", Permissions = (long)PerfumeEmpire.Authorization.Permission.ViewReports });
        db.SaveChanges();
    }
    else
    {
        // Ensure at least one admin has reporting permission during local development
        var adminUser = db.Users.FirstOrDefault(u => u.Role == "Admin" || u.Role == "admin");
        if (adminUser != null && adminUser.Permissions == 0)
        {
            adminUser.Permissions = (long)PerfumeEmpire.Authorization.Permission.ViewReports;
            db.SaveChanges();
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
// In development we avoid forcing HTTPS redirection so local proxying (HTTP) works
// and developers can test without dealing with self-signed cert redirects.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseAuthentication();
app.UseAuthorization();
// Serve static files from wwwroot (for uploaded media)
app.UseStaticFiles();

// Ensure media/uploads directory exists
try
{
    var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
    var uploadsDir = Path.Combine(webRoot, "media", "uploads");
    if (!Directory.Exists(uploadsDir)) Directory.CreateDirectory(uploadsDir);
}
catch { }
app.MapControllers();

app.Run();
