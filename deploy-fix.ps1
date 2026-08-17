<#
    deploy-fix.ps1
    ------------------------------------------------------------------
    Merges the branding crash fix into `main` and pushes it, so your
    host rebuilds and planyourdeck.com stops showing:

        "Application error: a client-side exception has occurred"

    WHAT IT PUSHES
      Removes the client-side branding code that deleted the <link rel="icon">
      tags React owns, which crashed every page after any navigation.

        deleted   client/lib/BrandingContext.jsx      <- the crash source
        deleted   client/app/admin/branding/page.js   <- same bug on reset
        deleted   client/app/admin/page.js            <- redirect to the above
        modified  client/app/layout.js                <- drop BrandingProvider
        modified  client/components/Logo.jsx          <- always built-in logo
        modified  client/components/UserMenu.jsx      <- drop dead admin link

      Your server (/api/branding) and its stored data are NOT touched.

    SAFETY
      - Fast-forward only. If `main` moved, it stops instead of forcing.
      - Refuses to run with uncommitted changes.
      - Puts you back on your original branch when it finishes.
      - Read-only until the final push, which it asks you to confirm.

    USAGE
        cd <your deck folder>          # or anywhere, if you pass -Path
        .\deploy-fix.ps1

        .\deploy-fix.ps1 -Path "C:\code\deck"   # explicit repo location
        .\deploy-fix.ps1 -Yes                   # skip the confirmation
#>

[CmdletBinding()]
param(
    [string]$Path = ".",
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

$FixBranch = "arena/01a00fcf-deck"
$Target    = "main"
$FixCommit = "c59e0d5e112d325b6c1d418bf9b3a1cc21793bcb"
$RepoUrl   = "https://github.com/patwarivishal62-ship-it/deck.git"

function Write-Step { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "    $m"   -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "    $m"   -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "`n$m`n"   -ForegroundColor Red }

# Runs git and throws on a non-zero exit code, so failures never pass silently.
function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $out = & git @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Args -join ' ') failed:`n$out"
    }
    return ($out | Out-String).Trim()
}

$originalBranch = $null
$startDir       = Get-Location

try {
    # ---------------------------------------------------------------- checks
    Write-Step "Checking prerequisites"

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "git is not installed or not on PATH. Install it from https://git-scm.com/download/win"
    }
    Write-Ok "git found: $((& git --version))"

    Set-Location $Path

    # Make sure we're actually inside the right repository.
    try   { $null = Invoke-Git rev-parse --is-inside-work-tree }
    catch { throw "'$((Get-Location).Path)' is not a git repository.`nOpen your deck folder first, or pass -Path 'C:\path\to\deck'." }

    $repoRoot = Invoke-Git rev-parse --show-toplevel
    Set-Location $repoRoot
    Write-Ok "repository: $repoRoot"

    $remote = (Invoke-Git remote get-url origin) -replace '\.git$', ''
    if ($remote -notlike "*patwarivishal62-ship-it/deck*") {
        throw "This folder points at '$remote', not the deck repository.`nExpected: $RepoUrl"
    }
    Write-Ok "remote: $remote"

    # A dirty tree means a checkout could silently discard the user's work.
    $dirty = Invoke-Git status --porcelain
    if ($dirty) {
        Write-Host ""
        Write-Host $dirty -ForegroundColor Yellow
        throw "You have uncommitted changes. Commit or stash them first, then re-run:`n    git stash"
    }
    Write-Ok "working tree is clean"

    $originalBranch = Invoke-Git rev-parse --abbrev-ref HEAD
    Write-Ok "current branch: $originalBranch"

    # ----------------------------------------------------------------- fetch
    Write-Step "Fetching from GitHub"
    Invoke-Git fetch origin --prune | Out-Null
    Write-Ok "fetched"

    # Confirm the fix commit really is on the remote branch.
    $remoteFix = Invoke-Git rev-parse "origin/$FixBranch"
    if ($remoteFix -ne $FixCommit) {
        Write-Warn "expected $FixCommit"
        Write-Warn "found    $remoteFix"
        throw "origin/$FixBranch is not at the expected fix commit. Stopping so nothing unexpected is published."
    }
    Write-Ok "fix commit verified: $($FixCommit.Substring(0,7))"

    # ------------------------------------------------------- already shipped?
    # Note: raw `& git` here, not Invoke-Git. `--is-ancestor` signals its answer
    # through the exit code (1 = "no"), which Invoke-Git would treat as a failure.
    & git merge-base --is-ancestor $FixCommit "origin/$Target" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "The fix is ALREADY on $Target - nothing to push." -ForegroundColor Green
        Write-Host "If the site still breaks, it is a deploy/cache issue, not a code issue:" -ForegroundColor Yellow
        Write-Host "  1. Trigger a redeploy of the frontend (with the build cache cleared)."
        Write-Host "  2. Hard-refresh the browser: Ctrl + Shift + R"
        exit 0
    }

    # -------------------------------------------------- fast-forward possible?
    Write-Step "Checking the merge is safe"
    & git merge-base --is-ancestor "origin/$Target" $FixCommit 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "$Target has commits the fix branch does not include, so this is not a clean fast-forward.`nStopping rather than risk overwriting someone else's work.`nMerge it manually, or open a pull request instead."
    }
    Write-Ok "clean fast-forward - no other work will be overwritten"

    Write-Host ""
    Write-Host "  Commits to publish:" -ForegroundColor White
    (Invoke-Git log --oneline "origin/$Target..$FixCommit") -split "`n" |
        ForEach-Object { Write-Host "    $_" -ForegroundColor White }

    Write-Host ""
    Write-Host "  Files changed:" -ForegroundColor White
    (Invoke-Git diff --name-status "origin/$Target" $FixCommit) -split "`n" |
        ForEach-Object { Write-Host "    $_" -ForegroundColor White }

    # --------------------------------------------------------------- confirm
    if (-not $Yes) {
        Write-Host ""
        $answer = Read-Host "Push these changes to '$Target'? (y/N)"
        if ($answer -notmatch '^[Yy]') {
            Write-Host "`nCancelled - nothing was pushed." -ForegroundColor Yellow
            exit 0
        }
    }

    # ----------------------------------------------------------- merge + push
    Write-Step "Updating $Target"

    # Use a local tracking branch so the merge is an ordinary fast-forward.
    & git show-ref --verify --quiet "refs/heads/$Target"
    if ($LASTEXITCODE -eq 0) {
        Invoke-Git checkout $Target | Out-Null
        Invoke-Git merge --ff-only "origin/$Target" | Out-Null
    }
    else {
        Invoke-Git checkout -b $Target "origin/$Target" | Out-Null
    }

    Invoke-Git merge --ff-only $FixCommit | Out-Null
    Write-Ok "$Target fast-forwarded to $($FixCommit.Substring(0,7))"

    Write-Step "Pushing to GitHub"
    Invoke-Git push origin $Target | Out-Null
    Write-Ok "pushed"

    # ---------------------------------------------------------------- verify
    Invoke-Git fetch origin --prune | Out-Null
    $nowOnRemote = Invoke-Git rev-parse "origin/$Target"
    if ($nowOnRemote -ne $FixCommit) {
        throw "Push reported success but origin/$Target is at $nowOnRemote. Please check GitHub."
    }

    Write-Host ""
    Write-Host "  SUCCESS - $Target is now at $($FixCommit.Substring(0,7))" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next, and this part matters:" -ForegroundColor Yellow
    Write-Host "    1. Wait for the frontend deploy to finish (Vercel/Render dashboard)."
    Write-Host "    2. Hard-refresh the site: Ctrl + Shift + R"
    Write-Host "       The old broken JavaScript is cached, so a normal refresh"
    Write-Host "       can still show the error even once the fix is live."
    Write-Host ""
    Write-Host "  Note: your uploaded custom logo will no longer appear -" -ForegroundColor DarkGray
    Write-Host "  the app now uses the built-in DECK logo everywhere." -ForegroundColor DarkGray
    Write-Host ""
}
catch {
    Write-Err "FAILED: $($_.Exception.Message)"
    Write-Host "Nothing was pushed. Your repository is unchanged." -ForegroundColor Yellow
    exit 1
}
finally {
    # Always hand the user's checkout back the way we found it.
    if ($originalBranch) {
        $current = (& git rev-parse --abbrev-ref HEAD 2>$null)
        if ($LASTEXITCODE -eq 0 -and $current -ne $originalBranch) {
            & git checkout $originalBranch 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Returned to branch '$originalBranch'." -ForegroundColor DarkGray
            }
        }
    }
    Set-Location $startDir
}
