<#
Creates each stripe repo on GitHub (public) if it does not exist, then pushes the local repo.
Run it while GitHub CLI is signed in as the owner:  gh auth login
#>
param(
    [string]$Owner = 'SATHEESH715',
    [string]$ReposPath = (Join-Path $PSScriptRoot '..\..')
)

$signedIn = gh api user --jq .login
if ($signedIn -ne $Owner) { throw "GitHub CLI is signed in as '$signedIn', not '$Owner'. Run: gh auth login" }

$projects = Get-Content (Join-Path $PSScriptRoot '..\projects.json') -Raw | ConvertFrom-Json
foreach ($p in $projects) {
    $path = Join-Path $ReposPath $p.repo
    if (-not (Test-Path $path)) { Write-Warning "Skipping $($p.repo): $path not found"; continue }

    gh repo view "$Owner/$($p.repo)" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        gh repo create "$Owner/$($p.repo)" --public | Out-Null
        Write-Host "Created $Owner/$($p.repo)"
    }

    git -C $path remote remove origin 2>$null
    git -C $path remote add origin "https://github.com/$Owner/$($p.repo).git"
    git -C $path push -u origin main
    if ($LASTEXITCODE -ne 0) { Write-Warning "Push failed for $($p.repo)" } else { Write-Host "Pushed $($p.repo)" }
}
