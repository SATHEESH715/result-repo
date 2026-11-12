<#
Removes the old Project 1 and Project 2 samples: their GitHub repos, their Azure credentials, and their blob folders.
This cannot be undone, so it asks you to type YES first.
Before the first step, give GitHub CLI permission to delete repos:  gh auth refresh -h github.com -s delete_repo
#>
param(
    [string]$Owner = 'SATHEESH715',
    [string]$AppId,
    [string]$StorageAccount = 'testreportsatheesh01',
    [string]$Container = 'test-results'
)

$answer = Read-Host "This permanently deletes the repos project1 and project2 under $Owner and their results. Type YES to continue"
if ($answer -ne 'YES') { Write-Host 'Cancelled'; return }

foreach ($n in 'project1', 'project2') {
    gh repo delete "$Owner/$n" --yes
    if ($AppId) { az ad app federated-credential delete --id $AppId --federated-credential-id "$n-main" }
    az storage blob delete-batch --account-name $StorageAccount --source $Container --pattern "$n/*" --auth-mode login
    Write-Host "Removed $n"
}
