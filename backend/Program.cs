using Microsoft.EntityFrameworkCore;
using PerfumeEmpire.Data;
using PerfumeEmpire.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using StackExchange.Redis;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

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
// Support reading JWT key from either configuration key `Jwt:Key` or env `JWT_KEY`.
// Prefer env key when present to avoid platform-misconfigured short config keys.
var configJwt = builder.Configuration["Jwt:Key"];
var envJwt = Environment.GetEnvironmentVariable("JWT_KEY");
var jwtCandidate = !string.IsNullOrWhiteSpace(envJwt) ? envJwt : configJwt;
Console.WriteLine($"[Program] Config Jwt:Key present: {!string.IsNullOrWhiteSpace(configJwt)}, length: {(configJwt?.Length ?? 0)}");
Console.WriteLine($"[Program] Env JWT_KEY present: {!string.IsNullOrWhiteSpace(envJwt)}, length: {(envJwt?.Length ?? 0)}");
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
builder.Services.AddHealthChecks();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var path = httpContext.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
        var isSensitivePath = path.Contains("/api/auth/login")
            || path.Contains("/api/auth/refresh")
            || path.Contains("/api/orders/customer/request-otp")
            || path.Contains("/api/orders/customer/verify-otp");

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"{ip}:{(isSensitivePath ? "sensitive" : "general")}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = isSensitivePath ? 20 : 120,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });
});

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
var defaultDbPath = Path.Combine(builder.Environment.ContentRootPath ?? Directory.GetCurrentDirectory(), "AppData", "perfume.db");
try
{
    var defaultDbDir = Path.GetDirectoryName(defaultDbPath);
    if (!string.IsNullOrWhiteSpace(defaultDbDir) && !Directory.Exists(defaultDbDir))
    {
        Directory.CreateDirectory(defaultDbDir);
    }
}
catch { }

var sqliteConn = builder.Configuration["ConnectionStrings:Default"] ?? $"Data Source={defaultDbPath}";
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
    var databaseReady = false;
    bool SqliteTableExists(string tableName)
    {
        try
        {
            using var connection = db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                connection.Open();
            }

            using var command = connection.CreateCommand();
            command.CommandText = "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = $name;";

            var parameter = command.CreateParameter();
            parameter.ParameterName = "$name";
            parameter.Value = tableName;
            command.Parameters.Add(parameter);

            var result = command.ExecuteScalar();
            return Convert.ToInt32(result) > 0;
        }
        catch
        {
            return false;
        }
    }

    int SqliteUserTableCount()
    {
        try
        {
            using var connection = db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                connection.Open();
            }

            using var command = connection.CreateCommand();
            command.CommandText = @"
                SELECT COUNT(1)
                FROM sqlite_master
                WHERE type = 'table'
                  AND name NOT LIKE 'sqlite_%'
                  AND name <> '__EFMigrationsHistory';";

            var result = command.ExecuteScalar();
            return Convert.ToInt32(result);
        }
        catch
        {
            return 0;
        }
    }

    bool SqliteMigrationHistoryContains(string migrationId)
    {
        try
        {
            using var connection = db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                connection.Open();
            }

            using var command = connection.CreateCommand();
            command.CommandText = "SELECT COUNT(1) FROM __EFMigrationsHistory WHERE MigrationId = $id;";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "$id";
            parameter.Value = migrationId;
            command.Parameters.Add(parameter);

            var result = command.ExecuteScalar();
            return Convert.ToInt32(result) > 0;
        }
        catch
        {
            return false;
        }
    }

    string SqliteResolveProductVersion()
    {
        try
        {
            using var connection = db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                connection.Open();
            }

            using var command = connection.CreateCommand();
            command.CommandText = "SELECT ProductVersion FROM __EFMigrationsHistory ORDER BY MigrationId DESC LIMIT 1;";
            var result = command.ExecuteScalar();
            return Convert.ToString(result) ?? "8.0.0";
        }
        catch
        {
            return "8.0.0";
        }
    }

    bool TryRepairKnownSqliteMigrationConflict(Exception ex)
    {
        if (!db.Database.IsSqlite()) return false;

        var message = ex.ToString();
        var isKnownDuplicateOrderStatusChanges =
            message.Contains("OrderStatusChanges", StringComparison.OrdinalIgnoreCase)
            && message.Contains("already exists", StringComparison.OrdinalIgnoreCase)
            && SqliteTableExists("OrderStatusChanges");

        if (!isKnownDuplicateOrderStatusChanges) return false;

        const string knownMigrationId = "20260219092332_AddOrderStatusChange";
        if (SqliteMigrationHistoryContains(knownMigrationId)) return false;

        try
        {
            var productVersion = SqliteResolveProductVersion();
            db.Database.ExecuteSqlRaw(
                "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ({0}, {1});",
                knownMigrationId,
                productVersion);

            Console.Error.WriteLine($"Reconciled SQLite migration history for {knownMigrationId}.");
            return true;
        }
        catch (Exception repairEx)
        {
            Console.Error.WriteLine("Failed to repair SQLite migration history: " + repairEx.Message);
            return false;
        }
    }

    void EnsureSqliteSchemaBootstrap()
    {
        if (!db.Database.IsSqlite()) return;

        var missingCriticalTables = !SqliteTableExists("Perfumes") || !SqliteTableExists("Users") || !SqliteTableExists("Orders");
        if (!missingCriticalTables) return;

        var userTableCount = SqliteUserTableCount();
        Console.Error.WriteLine($"SQLite schema check detected missing critical tables. User table count: {userTableCount}");

        // Safe fallback for fresh/empty SQLite databases commonly seen in container deploys.
        if (userTableCount == 0)
        {
            db.Database.EnsureDeleted();
            db.Database.EnsureCreated();
            databaseReady = true;
            Console.WriteLine("SQLite schema bootstrapped via EnsureDeleted + EnsureCreated.");
        }
    }

    // Apply any pending EF Core migrations. This is safer for production than
    // automatically dropping and recreating the database.
    try
    {
        db.Database.Migrate();
        databaseReady = true;

        try
        {
            db.Database.ExecuteSqlRaw(@"
                UPDATE Orders
                SET Phone = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(Phone,
                            '٠','0'),'١','1'),'٢','2'),'٣','3'),'٤','4'),'٥','5'),'٦','6'),'٧','7'),'٨','8'),'٩','9'),
                            '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9')
                WHERE Phone IS NOT NULL;
            ");
        }
        catch (Exception normalizeEx)
        {
            Console.Error.WriteLine("Phone normalization skipped: " + normalizeEx.Message);
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine("Failed to apply migrations: " + ex);

        if (TryRepairKnownSqliteMigrationConflict(ex))
        {
            try
            {
                db.Database.Migrate();
                databaseReady = true;
                Console.WriteLine("SQLite migration resumed after migration history reconciliation.");
            }
            catch (Exception retryEx)
            {
                Console.Error.WriteLine("Migration retry failed after reconciliation: " + retryEx);
            }
        }

        // SQLite fallback: if migrations are unavailable in a fresh environment,
        // create schema from the current model to avoid startup crashes.
        if (!databaseReady && db.Database.IsSqlite())
        {
            try
            {
                var userTableCount = SqliteUserTableCount();
                if (userTableCount == 0)
                {
                    db.Database.EnsureCreated();
                    databaseReady = true;
                    Console.WriteLine("SQLite schema ensured via EnsureCreated fallback for empty database.");
                }
                else
                {
                    Console.Error.WriteLine($"SQLite migration aborted for non-empty database (table count: {userTableCount}). Manual migration fix required.");

                    var hasCriticalSchema = SqliteTableExists("Perfumes") && SqliteTableExists("Users") && SqliteTableExists("Orders");
                    if (hasCriticalSchema)
                    {
                        databaseReady = true;
                        Console.Error.WriteLine("Proceeding with existing SQLite schema despite migration drift. Create a cleanup migration plan before production rollout.");
                    }
                }
            }
            catch (Exception ensureEx)
            {
                Console.Error.WriteLine("EnsureCreated fallback failed: " + ensureEx);
            }
        }
    }

    try
    {
        EnsureSqliteSchemaBootstrap();
    }
    catch (Exception sqliteSchemaEx)
    {
        Console.Error.WriteLine("SQLite schema bootstrap failed: " + sqliteSchemaEx);
    }

    if (db.Database.IsSqlite())
    {
        var missingCriticalTables = !SqliteTableExists("Perfumes") || !SqliteTableExists("Users") || !SqliteTableExists("Orders");
        if (missingCriticalTables)
        {
            throw new InvalidOperationException("SQLite schema is missing required tables (Perfumes/Users/Orders) after startup initialization.");
        }

        try
        {
            db.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS Coupons (
                    Id TEXT NOT NULL CONSTRAINT PK_Coupons PRIMARY KEY,
                    Type TEXT NOT NULL,
                    Amount TEXT NOT NULL,
                    Title TEXT NOT NULL,
                    IsActive INTEGER NOT NULL,
                    UpdatedAt TEXT NOT NULL
                );
            ");

            db.Database.ExecuteSqlRaw(@"
                INSERT OR IGNORE INTO Coupons (Id, Type, Amount, Title, IsActive, UpdatedAt)
                VALUES ('WELCOME10', 'percent', '10', 'خصم 10% للترحيب', 1, CURRENT_TIMESTAMP);
            ");
            db.Database.ExecuteSqlRaw(@"
                INSERT OR IGNORE INTO Coupons (Id, Type, Amount, Title, IsActive, UpdatedAt)
                VALUES ('SAR50', 'fixed', '50', 'خصم 50 ر.س', 1, CURRENT_TIMESTAMP);
            ");
            db.Database.ExecuteSqlRaw(@"
                INSERT OR IGNORE INTO Coupons (Id, Type, Amount, Title, IsActive, UpdatedAt)
                VALUES ('SHIPFREE', 'free_shipping', '0', 'شحن مجاني', 1, CURRENT_TIMESTAMP);
            ");
        }
        catch (Exception couponSchemaEx)
        {
            Console.Error.WriteLine("Coupons SQLite schema ensure failed: " + couponSchemaEx.Message);
        }
    }

    if (!databaseReady)
    {
        throw new InvalidOperationException("Database is not ready after migration/setup attempts.");
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
        db.Users.Add(new User { Username = "admin", Password = hashed, Role = "Admin", Permissions = PerfumeEmpire.Authorization.PermissionProfiles.ForRole("Admin") });
        db.SaveChanges();
    }
    else
    {
        // Ensure at least one admin has baseline admin permissions during local development
        var adminUser = db.Users.FirstOrDefault(u => u.Role == "Admin" || u.Role == "admin");
        if (adminUser != null)
        {
            var adminMask = PerfumeEmpire.Authorization.PermissionProfiles.ForRole("Admin");
            if (adminUser.Permissions == 0 || (adminUser.Permissions & (long)PerfumeEmpire.Authorization.Permission.ManageCoupons) == 0)
            {
                adminUser.Permissions = adminMask;
                db.SaveChanges();
            }
        }
    }

    // Optional production-safe bootstrap for admin credentials.
    // If ADMIN_BOOTSTRAP_PASSWORD is provided, sync that password to the bootstrap admin user.
    try
    {
        var bootstrapUsername = (Environment.GetEnvironmentVariable("ADMIN_BOOTSTRAP_USERNAME") ?? "admin").Trim();
        var bootstrapPassword = Environment.GetEnvironmentVariable("ADMIN_BOOTSTRAP_PASSWORD");
        if (!string.IsNullOrWhiteSpace(bootstrapUsername)
            && !string.IsNullOrWhiteSpace(bootstrapPassword)
            && bootstrapPassword.Length >= 8)
        {
            var loweredBootstrapUsername = bootstrapUsername.ToLower();
            var bootstrapAdmin = db.Users.FirstOrDefault(u => u.Username.ToLower() == loweredBootstrapUsername);

            if (bootstrapAdmin == null)
            {
                db.Users.Add(new User
                {
                    Username = bootstrapUsername,
                    Password = BCrypt.Net.BCrypt.HashPassword(bootstrapPassword),
                    Role = "Admin",
                    Permissions = PerfumeEmpire.Authorization.PermissionProfiles.ForRole("Admin")
                });
                db.SaveChanges();
                Console.WriteLine($"Bootstrap admin user created: {bootstrapUsername}");
            }
            else
            {
                var updated = false;
                if (!BCrypt.Net.BCrypt.Verify(bootstrapPassword, bootstrapAdmin.Password))
                {
                    bootstrapAdmin.Password = BCrypt.Net.BCrypt.HashPassword(bootstrapPassword);
                    updated = true;
                }

                if (!string.Equals(bootstrapAdmin.Role, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    bootstrapAdmin.Role = "Admin";
                    updated = true;
                }

                if (bootstrapAdmin.Permissions == 0 || (bootstrapAdmin.Permissions & (long)PerfumeEmpire.Authorization.Permission.ManageCoupons) == 0)
                {
                    bootstrapAdmin.Permissions = PerfumeEmpire.Authorization.PermissionProfiles.ForRole("Admin");
                    updated = true;
                }

                if (updated)
                {
                    db.SaveChanges();
                    Console.WriteLine($"Bootstrap admin user synchronized: {bootstrapUsername}");
                }
            }
        }
    }
    catch (Exception adminBootstrapEx)
    {
        Console.Error.WriteLine("Admin bootstrap skipped due to error: " + adminBootstrapEx.Message);
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();
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
app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
