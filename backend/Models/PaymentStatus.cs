using System.Text.Json.Serialization;

namespace PerfumeEmpire.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PaymentStatus
{
    Pending,
    Paid,
    Failed,
    Refunded
}
