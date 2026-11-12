param(
    [Parameter(Mandatory = $true)]
    [string]$CredentialPath
)

$ErrorActionPreference = 'Stop'
$credentials = Import-Clixml -LiteralPath $CredentialPath
if ($credentials.AccessKey -isnot [System.Security.SecureString]) {
    throw 'Le fichier ne contient pas de cle protegee pour cette session Windows.'
}
$url = [uri]$credentials.URL
if ($url.Scheme -ne 'https') {
    throw 'Une adresse HTTPS est requise.'
}
$key = [System.Net.NetworkCredential]::new('', $credentials.AccessKey).Password
try {
    Set-Clipboard -Value $key
    Write-Host "Adresse : $url"
    Write-Host "Cle d'acces copiee dans le presse-papiers. Collez-la dans le formulaire de recette."
    Write-Host "Cette cle ne remplace pas la connexion a votre compte Pencmi."
} finally {
    Remove-Variable key
}
