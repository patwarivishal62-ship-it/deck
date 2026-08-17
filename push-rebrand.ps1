# DECK — Push to main (includes Instagram + Facebook links)
$Bundle = "deck-rebrand.bundle"
if (-not (Test-Path $Bundle)) { Write-Error "Put $Bundle next to this script"; exit 1 }
git bundle verify $Bundle
git clone https://github.com/patwarivishal62-ship-it/deck.git temp-deck
Set-Location temp-deck
Copy-Item ..\$Bundle .\$Bundle
git fetch ./$Bundle arena/01a00e66-deck:arena/01a00e66-deck
git checkout main
git pull origin main
git merge arena/01a00e66-deck --no-edit
git push origin main
Write-Host "✅ Done — planyourdeck.com will redeploy. Verify social icons in footer." -ForegroundColor Green
