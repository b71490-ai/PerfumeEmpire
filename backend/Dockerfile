FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

COPY . ./
RUN dotnet publish PerfumeEmpire.csproj -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/out ./

ENV PORT=8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
RUN mkdir -p /app/AppData /app/wwwroot/media/uploads

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} dotnet PerfumeEmpire.dll"]