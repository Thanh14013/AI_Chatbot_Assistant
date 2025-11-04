@echo off
echo Creating database 'chatbot' in PostgreSQL container...
docker exec -it ai-chatbot-postgres psql -U postgres -c "CREATE DATABASE chatbot;"
echo Done!
pause
