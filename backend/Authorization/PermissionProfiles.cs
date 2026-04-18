namespace PerfumeEmpire.Authorization;

public static class PermissionProfiles
{
    public static long ForRole(string? role)
    {
        var normalized = NormalizeRole(role);

        if (normalized == "Admin")
        {
            return (long)(
                Permission.AllProducts |
                Permission.AllOrders |
                Permission.AllCustomers |
                Permission.ManageInventory |
                Permission.ViewReports |
                Permission.ManageUsers |
                Permission.ManageCoupons
            );
        }

        if (normalized == "Manager")
        {
            return (long)(
                Permission.AllProducts |
                Permission.AllOrders |
                Permission.ManageInventory |
                Permission.ViewReports |
                Permission.ManageCoupons
            );
        }

        if (normalized == "Editor")
        {
            return (long)(
                Permission.ManageProducts |
                Permission.CreateProduct |
                Permission.EditProduct
            );
        }

        if (normalized == "Support")
        {
            return (long)(
                Permission.ViewOrders |
                Permission.UpdateOrderStatus |
                Permission.CancelOrders |
                Permission.ViewReports
            );
        }

        return 0;
    }

    public static string NormalizeRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return string.Empty;

        var trimmed = role.Trim();
        if (string.Equals(trimmed, "admin", StringComparison.OrdinalIgnoreCase)) return "Admin";
        if (string.Equals(trimmed, "manager", StringComparison.OrdinalIgnoreCase)) return "Manager";
        if (string.Equals(trimmed, "editor", StringComparison.OrdinalIgnoreCase)) return "Editor";
        if (string.Equals(trimmed, "support", StringComparison.OrdinalIgnoreCase)) return "Support";

        return trimmed;
    }
}
