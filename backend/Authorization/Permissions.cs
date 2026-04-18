namespace PerfumeEmpire.Authorization;

[System.Flags]
public enum Permission : long
{
    None = 0,

    // Product management
    ManageProducts = 1L << 0,
    CreateProduct  = 1L << 1,
    EditProduct    = 1L << 2,
    DeleteProduct  = 1L << 3,

    // Orders
    ViewOrders       = 1L << 10,
    UpdateOrderStatus= 1L << 11,
    CancelOrders     = 1L << 12,

    // Customers
    ViewCustomers = 1L << 20,
    EditCustomers = 1L << 21,

    // Inventory
    ManageInventory = 1L << 30,

    // Reports
    ViewReports = 1L << 40,

    // Users
    ManageUsers = 1L << 50,

    // Coupons
    ManageCoupons = 1L << 51,

    // Composite shortcuts
    AllProducts = ManageProducts | CreateProduct | EditProduct | DeleteProduct,
    AllOrders = ViewOrders | UpdateOrderStatus | CancelOrders,
    AllCustomers = ViewCustomers | EditCustomers,
    All = ~0L
}
