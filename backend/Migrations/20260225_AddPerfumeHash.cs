using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PerfumeEmpire.Migrations
{
    public partial class AddPerfumeHash : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "Hash",
                table: "Perfumes",
                type: "INTEGER",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Hash",
                table: "Perfumes");
        }
    }
}
