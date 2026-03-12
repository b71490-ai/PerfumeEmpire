using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Authentication;

namespace PerfumeEmpire.Authorization;

public class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly long _requiredMask;

    public RequirePermissionAttribute(Permission permission)
    {
        _requiredMask = (long)permission;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        Console.WriteLine($"[RequirePermission] requiredMask={_requiredMask}, user='{context.HttpContext.User?.Identity?.Name}'");

        // Ensure authentication runs so HttpContext.User is populated when only this custom attribute is used
        if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
        {
            try
            {
                var authResult = await context.HttpContext.AuthenticateAsync();
                if (authResult?.Principal != null)
                {
                    context.HttpContext.User = authResult.Principal;
                }
            }
            catch { }
        }

        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var permClaim = user.FindFirst("permissions")?.Value ?? string.Empty;
        var cleaned = new string(permClaim.Where(c => char.IsDigit(c) || c == '-').ToArray());
        // normalize common dash/minus variants before parsing
        var normalizedMinus = cleaned.Replace('\u2212', '-').Replace('\u2010', '-').Replace('\u2011', '-').Replace('\u2012', '-').Replace('\u2013', '-').Replace('\u2014', '-');
        if (!long.TryParse(normalizedMinus, System.Globalization.NumberStyles.AllowLeadingSign, System.Globalization.CultureInfo.InvariantCulture, out var permValue))
        {
            Console.WriteLine($"[RequirePermission] could not parse permissions claim '{permClaim}' (cleaned='{cleaned}')");
            context.Result = new ForbidResult();
            return;
        }

        Console.WriteLine($"[RequirePermission] parsed permValue={permValue}, checking (permValue & required) == required");
        if ((permValue & _requiredMask) != _requiredMask)
        {
            Console.WriteLine($"[RequirePermission] permission check failed: permValue={permValue}, required={_requiredMask}");
            context.Result = new ForbidResult();
            return;
        }

        Console.WriteLine($"[RequirePermission] permission check passed for user={context.HttpContext.User?.Identity?.Name}");
        return;
    }
}
