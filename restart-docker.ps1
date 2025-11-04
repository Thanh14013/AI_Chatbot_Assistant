# Script để stop và xóa containers cũ, sau đó start lại với docker-compose.dev.yml

Write-Host "🛑 Stopping và removing containers cũ..." -ForegroundColor Yellow

# Stop và remove containers
docker stop ai-chatbot-postgres ai-chatbot-redis 2>$null
docker rm ai-chatbot-postgres ai-chatbot-redis 2>$null

Write-Host "`n✅ Đã xóa containers cũ" -ForegroundColor Green
Write-Host "`n🚀 Starting containers mới với docker-compose.dev.yml..." -ForegroundColor Cyan

# Change to project directory and start containers
Set-Location "d:\Main character\XGAME\AI Chatbot Assistant"
docker-compose -f docker-compose.dev.yml up -d

Write-Host "`n✅ Hoàn tất! Chờ 5 giây để containers khởi động..." -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host "`n📊 Kiểm tra trạng thái containers:" -ForegroundColor Cyan
docker ps --filter "name=ai-chatbot"

Write-Host "`n✅ Xong! Bây giờ có thể test kết nối." -ForegroundColor Green
