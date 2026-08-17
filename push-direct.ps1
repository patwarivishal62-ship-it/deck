# Simplest — use already-pushed arena branch
git clone https://github.com/patwarivishal62-ship-it/deck.git
cd deck
git fetch origin
git checkout main
git pull origin main
git merge origin/arena/01a00e66-deck --no-edit
git push origin main
Write-Host "✅ Pushed to main" -ForegroundColor Green
