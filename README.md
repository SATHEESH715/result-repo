# result-repo

Holds the latest test result of each project, and the pipelines that turn them into one Teams report.

```
project1/summary.json   <- pushed by the project1 repo after every run
project2/summary.json   <- pushed by the project2 repo after every run
projects.json           <- the projects the report expects (a missing one shows as "no results")
scripts/post-report.mjs <- builds the table and posts it to Teams
azure-pipelines-repo.yml  Approach 1: report built from the files in this repo
azure-pipelines-blob.yml  Approach 2: report built from the files in blob storage
```

Each result file has the project, commit, run link, run time, and a total and failed count for four levels: .NET, Angular, Bruno and Playwright.

## How the two approaches work
Both approaches start the same way. After the tests, each project repo publishes its result file in parallel to:
1. this repo, under `<project>/summary.json`, and
2. blob storage, under `test-results/<project>/summary.json` (plus a dated copy in `history/`).

| | Approach 1 | Approach 2 |
|---|---|---|
| Source | this repo | blob storage |
| Pipeline | `azure-pipelines-repo.yml` | `azure-pipelines-blob.yml` |
| Starts when | a project pushes new results | weekdays 02:00 UTC, or by hand |

## Azure DevOps set-up (one time)
1. **Variable group.** In Pipelines, open Library and add a variable group named `test-reporting`. Add a variable `teamsWorkflowUrl` with your Teams Workflows webhook URL, and mark it **secret**.
2. **Approach 1 pipeline.**
   - Create a pipeline, choose **GitHub**, pick `SATHEESH715/result-repo`, then **Existing Azure Pipelines YAML file**, and choose `/azure-pipelines-repo.yml`.
   - Allow the pipeline to use the `test-reporting` variable group when asked.
3. **Approach 2 service connection.**
   - In Project settings, open Service connections and create an **Azure Resource Manager** connection named `azure-test-reporting`. Use workload identity federation (automatic) and scope it to the resource group `test-reporting-rg`.
   - In the Azure portal, give the identity this connection created the role **Storage Blob Data Reader** on the storage account `testreportsatheesh01`.
4. **Approach 2 pipeline.** Create a second pipeline from `/azure-pipelines-blob.yml` the same way, allow the variable group and the service connection, and run it once by hand.
5. **Agents.** The pipelines use `pool: name: Default`, a self-hosted Windows agent. Install it from Organization settings, Agent pools, Default, New agent, and keep `run.cmd` running. To use Microsoft-hosted agents instead, once the free grant is approved, change the pool to `vmImage: ubuntu-latest` and turn the PowerShell steps back into bash.

## Checking it
- Push a change in `project1` or `project2`. Its workflow publishes a result file here and to blob storage.
- Approach 1 runs by itself. For approach 2, run the pipeline by hand.
- Teams should show one table with a row per project. A project that has not reported shows `no results`, and one older than 72 hours shows `stale`.

Run the script locally without posting: `DRY_RUN=1 node scripts/post-report.mjs <folder-with-project-folders>`.
