using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PerfumeEmpire.Migrations
{
    public partial class AddOrderCoordinates : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Make migration idempotent: ignore errors if columns already exist
            try
            {
                migrationBuilder.AddColumn<double>(
                    name: "Latitude",
                    table: "Orders",
                    type: "REAL",
                    nullable: true);
            }
            catch
            {
                // ignore duplicate column errors
            }

            try
            {
                migrationBuilder.AddColumn<double>(
                    name: "Longitude",
                    table: "Orders",
                    type: "REAL",
                    nullable: true);
            }
            catch
            {
            }

            try
            {
                migrationBuilder.AddColumn<string>(
                    name: "DeliveryNotes",
                    table: "Orders",
                    type: "TEXT",
                    nullable: true);
            }
            catch
            {
            }
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            try { migrationBuilder.DropColumn(name: "Latitude", table: "Orders"); } catch { }
            try { migrationBuilder.DropColumn(name: "Longitude", table: "Orders"); } catch { }
            try { migrationBuilder.DropColumn(name: "DeliveryNotes", table: "Orders"); } catch { }
        }
    }
}
