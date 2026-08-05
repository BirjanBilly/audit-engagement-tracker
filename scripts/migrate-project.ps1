[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OldDbUrl,

  [Parameter(Mandatory = $true)]
  [string]$NewDbUrl,

  [string]$ArtifactsDirectory = "migration-artifacts"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-ExitCode {
  param([Parameter(Mandatory = $true)][string]$Step)
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE."
  }
}

function Run-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  & $Command
  Assert-ExitCode $Name
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is required by supabase db dump."
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql is required."
}

New-Item -ItemType Directory -Force -Path $ArtifactsDirectory | Out-Null

$storageCount = (
  & psql "--dbname=$OldDbUrl" "--tuples-only" "--no-align" `
    "--command=select count(*) from storage.objects;"
).Trim()
Assert-ExitCode "Checking source Storage"
if ([int]$storageCount -ne 0) {
  throw "Source project has $storageCount Storage objects. Transfer object bytes separately."
}
Write-Host "Storage check passed: source has zero objects." -ForegroundColor Green

Run-Step "Dump database roles for audit evidence" {
  npx supabase db dump --db-url $OldDbUrl `
    -f "$ArtifactsDirectory/roles.sql" --role-only
}

Run-Step "Dump schema" {
  npx supabase db dump --db-url $OldDbUrl `
    -f "$ArtifactsDirectory/schema.sql"
}

Run-Step "Dump data, including Auth users" {
  npx supabase db dump --db-url $OldDbUrl `
    -f "$ArtifactsDirectory/data.sql" `
    --use-copy --data-only `
    -x "storage.buckets_vectors" `
    -x "storage.vector_indexes"
}

Run-Step "Dump migration-history schema" {
  npx supabase db dump --db-url $OldDbUrl `
    -f "$ArtifactsDirectory/history_schema.sql" `
    --schema supabase_migrations
}

Run-Step "Dump migration-history rows" {
  npx supabase db dump --db-url $OldDbUrl `
    -f "$ArtifactsDirectory/history_data.sql" `
    --use-copy --data-only `
    --schema supabase_migrations
}

$schemaInput = Join-Path $ArtifactsDirectory "schema.sql"
$schemaClean = Join-Path $ArtifactsDirectory "schema.clean.sql"
$removedOwnerLines = 0
$cleanLines = foreach ($line in Get-Content -LiteralPath $schemaInput) {
  if ($line -match '^\s*ALTER\s+.+\s+OWNER\s+TO\s+"?supabase_admin"?;\s*$') {
    $removedOwnerLines++
    "-- Skipped during cross-project restore: $line"
  } else {
    $line
  }
}
$cleanLines | Set-Content -LiteralPath $schemaClean -Encoding UTF8
Write-Host "Prepared schema.clean.sql; skipped $removedOwnerLines supabase_admin OWNER statement(s)."

# Supabase-managed roles already exist in every hosted target project.
# roles.sql is retained as evidence. This project creates no custom LOGIN roles.
Run-Step "Restore schema and data in one transaction" {
  & psql `
    "--dbname=$NewDbUrl" `
    "--single-transaction" `
    "--set=ON_ERROR_STOP=1" `
    "--file=$schemaClean" `
    "--command=SET session_replication_role = replica;" `
    "--file=$(Join-Path $ArtifactsDirectory 'data.sql')"
}

Run-Step "Replace and restore migration history" {
  & psql "--dbname=$NewDbUrl" "--set=ON_ERROR_STOP=1" `
    "--command=drop schema if exists supabase_migrations cascade;"

  & psql `
    "--dbname=$NewDbUrl" `
    "--single-transaction" `
    "--set=ON_ERROR_STOP=1" `
    "--file=$(Join-Path $ArtifactsDirectory 'history_schema.sql')" `
    "--file=$(Join-Path $ArtifactsDirectory 'history_data.sql')"
}

Write-Host "`nRestore finished. Run the migration verification script." -ForegroundColor Green
Write-Host "Do not delete or modify the source project." -ForegroundColor Yellow
