<#
Adds the Application Insights connection string as a secret to every stripe repo.
You type the value once, and it is never shown or saved.
Run it while GitHub CLI is signed in as the owner:  gh auth login
#>
param([string]$Owner = 'SATHEESH715')

$secure = Read-Host 'Enter the Application Insights connection string' -AsSecureString
$value = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

$projects = Get-Content (Join-Path $PSScriptRoot '..\projects.json') -Raw | ConvertFrom-Json
foreach ($p in $projects) {
    # The value goes in through standard input, so it never appears on a command line.
    $value | gh secret set APPINSIGHTS_CONNECTION_STRING --repo "$Owner/$($p.repo)"
    Write-Host "Secret set for $($p.repo)"
}
