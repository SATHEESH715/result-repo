<#
Adds one federated credential for each stripe repo to the Azure app registration, so the repo's pipeline can sign in
to Azure without a password. Run it after the repos exist, and after:  az login
Example:  .\New-AzureCredentials.ps1 -AppId <Application (client) ID of the app registration>
#>
param(
    [Parameter(Mandatory)][string]$AppId,
    [string]$Owner = 'SATHEESH715'
)

$ownerId = (Invoke-RestMethod "https://api.github.com/users/$Owner").id
$existing = az ad app federated-credential list --id $AppId --query "[].name" -o tsv
$projects = Get-Content (Join-Path $PSScriptRoot '..\projects.json') -Raw | ConvertFrom-Json

foreach ($p in $projects) {
    $name = "$($p.repo)-main"
    if ($existing -contains $name) { Write-Host "Already there: $name"; continue }

    $repoId = (Invoke-RestMethod "https://api.github.com/repos/$Owner/$($p.repo)").id
    # GitHub signs the token with the owner and repo IDs in the subject, so the credential must match exactly.
    $subject = "repo:$Owner@$ownerId/$($p.repo)@$($repoId):ref:refs/heads/main"
    $body = @{
        name      = $name
        issuer    = 'https://token.actions.githubusercontent.com'
        subject   = $subject
        audiences = @('api://AzureADTokenExchange')
    } | ConvertTo-Json

    $file = New-TemporaryFile
    $body | Set-Content -Path $file -Encoding ascii
    az ad app federated-credential create --id $AppId --parameters "@$file" | Out-Null
    Remove-Item $file
    Write-Host "Added $name  ($subject)"
}
