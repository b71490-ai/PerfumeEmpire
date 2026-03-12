using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace PerfumeEmpire.Authorization;

public class PermissionPolicyRequirement : IAuthorizationRequirement
{
    public long PermissionMask { get; }
    public PermissionPolicyRequirement(long mask) => PermissionMask = mask;
}

public class PermissionPolicyHandler : AuthorizationHandler<PermissionPolicyRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionPolicyRequirement requirement)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            return Task.CompletedTask;
        }

        var permClaim = context.User.FindFirst("permissions")?.Value;
        if (!string.IsNullOrEmpty(permClaim))
        {
            // sanitize common bidi/rtl markers and non-numeric characters that may appear
            var cleaned = new string(permClaim.Where(c => char.IsDigit(c) || c == '-').ToArray());
            Console.WriteLine($"[PermissionPolicyHandler] permClaim='{permClaim}', cleaned='{cleaned}', requiredMask={requirement.PermissionMask}");
            if (long.TryParse(cleaned, out var permValue))
            {
                Console.WriteLine($"[PermissionPolicyHandler] parsed permValue={permValue}");
                var hasMask = (permValue & requirement.PermissionMask) == requirement.PermissionMask;
                Console.WriteLine($"[PermissionPolicyHandler] bitcheck: permValue={permValue} & required={requirement.PermissionMask} => {hasMask}");
                if (hasMask)
                {
                    Console.WriteLine($"[PermissionPolicyHandler] requirement satisfied for mask={requirement.PermissionMask}");
                    context.Succeed(requirement);
                }
            }
        }

        return Task.CompletedTask;
    }
}
