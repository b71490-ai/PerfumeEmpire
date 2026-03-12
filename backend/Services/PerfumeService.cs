using PerfumeEmpire.Data;
using PerfumeEmpire.Models;

namespace PerfumeEmpire.Services;

public class PerfumeService
{
    private readonly ApplicationDbContext _db;
    public PerfumeService(ApplicationDbContext db) => _db = db;

    public IQueryable<Perfume> Query() => _db.Perfumes;
}
