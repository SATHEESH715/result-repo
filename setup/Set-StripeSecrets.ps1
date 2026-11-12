<#
Adds the 4 repository secrets to every stripe repo. You type each value once, and it is never shown or saved.
Run it while GitHub CLI is signed in as the owner:  gh auth login
#>
param([string]$Owner = 'SATHEESH715')

$names = 'AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_SUBSCRIPTION_ID', 'RESULTS_REPO_TOKEN'
$values = @{}
foreach ($n in $names) {
    $secure = Read-Host "Enter $n" -AsSecureString
    $values[$n] = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$projects = Get-Content (Join-Path $PSScriptRoot '..\projects.json') -Raw | ConvertFrom-Json
foreach ($p in $projects) {
    foreach ($n in $names) {
        # The value goes in through standard input, so it never appears on a command line.
        $values[$n] | gh secret set $n --repo "$Owner/$($p.repo)"
    }
    Write-Host "Secrets set for $($p.repo)"
}
