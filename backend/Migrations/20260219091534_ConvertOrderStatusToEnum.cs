using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PerfumeEmpire.Migrations
{
    /// <inheritdoc />
    public partial class ConvertOrderStatusToEnum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // If Orders table already exists (production/dev), migrate Status string -> integer safely.
            migrationBuilder.Sql(@"
                PRAGMA foreign_keys=off;

                -- Add temporary integer column to hold enum values
                ALTER TABLE Orders ADD COLUMN StatusTemp INTEGER NOT NULL DEFAULT 0;

                -- Map existing string statuses to enum int values (adjust values if enum ordering differs)
                UPDATE Orders
                SET StatusTemp = CASE
                    WHEN Status = 'Pending' THEN 0
                    WHEN Status = 'Processing' THEN 1
                    WHEN Status = 'Shipped' THEN 2
                    WHEN Status = 'Delivered' THEN 3
                    WHEN Status = 'Cancelled' THEN 4
                    ELSE 0 END;

                -- Recreate Orders table with Status as INTEGER and copy data
                CREATE TABLE IF NOT EXISTS Orders_new (
                    Id INTEGER NOT NULL CONSTRAINT PK_Orders PRIMARY KEY AUTOINCREMENT,
                    CustomerName TEXT NOT NULL,
                    Email TEXT NOT NULL,
                    Phone TEXT NOT NULL,
                    Address TEXT NOT NULL,
                    Total TEXT NOT NULL,
                    Status INTEGER NOT NULL,
                    CreatedAt TEXT NOT NULL
                );

                INSERT OR REPLACE INTO Orders_new (Id, CustomerName, Email, Phone, Address, Total, Status, CreatedAt)
                SELECT Id, CustomerName, Email, Phone, Address, Total, StatusTemp, CreatedAt FROM Orders;

                DROP TABLE IF EXISTS Orders;
                ALTER TABLE Orders_new RENAME TO Orders;

                PRAGMA foreign_keys=on;
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS Perfumes (
                    Id INTEGER NOT NULL CONSTRAINT PK_Perfumes PRIMARY KEY AUTOINCREMENT,
                    Name TEXT NULL,
                    Brand TEXT NULL,
                    Price TEXT NOT NULL,
                    ImageUrl TEXT NULL,
                    Discount INTEGER NOT NULL,
                    Category TEXT NULL
                );
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS Users (
                    Id INTEGER NOT NULL CONSTRAINT PK_Users PRIMARY KEY AUTOINCREMENT,
                    Username TEXT NOT NULL,
                    Password TEXT NOT NULL,
                    Role TEXT NOT NULL
                );
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS OrderItems (
                    Id INTEGER NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY AUTOINCREMENT,
                    OrderId INTEGER NOT NULL,
                    PerfumeId INTEGER NOT NULL,
                    Name TEXT NOT NULL,
                    Price TEXT NOT NULL,
                    Quantity INTEGER NOT NULL,
                    CONSTRAINT FK_OrderItems_Orders_OrderId FOREIGN KEY (OrderId) REFERENCES Orders (Id) ON DELETE CASCADE
                );
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS RefreshTokens (
                    Id INTEGER NOT NULL CONSTRAINT PK_RefreshTokens PRIMARY KEY AUTOINCREMENT,
                    Token TEXT NOT NULL,
                    UserId INTEGER NOT NULL,
                    ExpiresAt TEXT NOT NULL,
                    CreatedAt TEXT NOT NULL,
                    CONSTRAINT FK_RefreshTokens_Users_UserId FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
                );
            ");

            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS IX_OrderItems_OrderId ON OrderItems (OrderId);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS IX_RefreshTokens_UserId ON RefreshTokens (UserId);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderItems");

            migrationBuilder.DropTable(
                name: "Perfumes");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "Orders");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
