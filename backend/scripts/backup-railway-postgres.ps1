param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$EnvironmentId,
  [Parameter(Mandatory = $true)][string]$ServiceId,
  [Parameter(Mandatory = $true)][string]$RailwayExecutable
)

$ErrorActionPreference = 'Stop'
foreach ($id in @($ProjectId, $EnvironmentId, $ServiceId)) {
  if ($id -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Identifiant Railway invalide.' }
}
if (!(Test-Path -LiteralPath $RailwayExecutable -PathType Leaf)) {
  throw 'Exécutable Railway introuvable.'
}

$archive = $null
$encrypted = $null
try {
  $remote = 'bash -o pipefail -c "pg_dump --format=custom --no-owner | base64 -w 0"'
  $encoded = & $RailwayExecutable ssh --project $ProjectId --environment $EnvironmentId --service $ServiceId -- $remote
  if ($LASTEXITCODE -ne 0) { throw 'Export PostgreSQL refusé ou interrompu.' }
  $archive = [Convert]::FromBase64String(($encoded -join '').Trim())
  if ($archive.Length -lt 5 -or [Text.Encoding]::ASCII.GetString($archive, 0, 5) -ne 'PGDMP') {
    throw 'Archive PostgreSQL invalide.'
  }
  $directory = Join-Path $env:LOCALAPPDATA 'Pencmi\backups'
  [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  $encrypted = [Security.Cryptography.ProtectedData]::Protect(
    $archive, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $file = Join-Path $directory ('pencmi-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.dump.dpapi')
  if (Test-Path -LiteralPath $file) { throw 'Le fichier de sauvegarde existe déjà.' }
  $stream = [System.IO.File]::Open($file, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($encrypted, 0, $encrypted.Length) } finally { $stream.Dispose() }
  $recovered = [Security.Cryptography.ProtectedData]::Unprotect(
    [System.IO.File]::ReadAllBytes($file), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  try {
    $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($archive))
    if ([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($recovered)) -ne $hash) {
      throw 'Échec de vérification de la sauvegarde chiffrée.'
    }
  } finally {
    if ($recovered) { [Array]::Clear($recovered, 0, $recovered.Length) }
  }
  [pscustomobject]@{
    path = $file
    format = 'PostgreSQL custom archive encrypted with Windows DPAPI CurrentUser'
    plaintextBytes = $archive.Length
    sha256 = $hash
    encryptedReadbackVerified = $true
    restored = $false
  } | ConvertTo-Json
} finally {
  if ($archive) { [Array]::Clear($archive, 0, $archive.Length) }
  $encoded = $null
  $encrypted = $null
}
