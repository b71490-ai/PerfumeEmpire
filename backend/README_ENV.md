Backend environment and local run instructions
===========================================

This file explains the minimal environment variables required to run the backend locally.

1. Create a local `.env` file

- Copy `backend/.env.example` to `backend/.env` and replace placeholder values with real local values.
- Ensure `JWT_KEY` is at least 32 characters long and does not include the substring `dev_secret`.
  - Set `JWT_ISSUER` and `JWT_AUDIENCE` to stable values shared with frontend middleware validation.
  - In Production, `ADMIN_BOOTSTRAP_PASSWORD` is mandatory or startup will stop by design.

1. Run the backend (from repository root)

```bash
cd backend
# If you prefer not to use .env you can provide JWT_KEY inline:
JWT_KEY='a-strong-key-without_devsecret_2026!' ASPNETCORE_URLS=http://localhost:5001 dotnet run

# Or, if .env exists, simply:
ASPNETCORE_URLS=http://localhost:5001 dotnet run
```

1. Useful tips

- If you run into port conflicts, change `ASPNETCORE_URLS` to another port (e.g. 5002).
- For production, store secrets in a proper secret manager (Azure Key Vault, AWS Secrets Manager, etc.) and do NOT use `.env`.
- Frontend middleware validation should use the same `JWT_KEY`, `JWT_ISSUER`, and `JWT_AUDIENCE` values.
- Address package vulnerability warnings before deploying to production (see project TODOs).
