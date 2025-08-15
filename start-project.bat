@echo off
echo Starting Real-Time Code Editor...

:: Start Docker in WSL
echo Starting Docker in WSL...
wsl -d Ubuntu -u root service docker start

:: Start backend server (port 3000)
start "Backend" wsl -d Ubuntu bash -c "cd /mnt/d/RealTimeCodeEditor/backend && node server.js"

:: Start frontend (static files for manual browsing, not auto-open index.html)
cd frontend
start "Frontend" npx http-server -p 8081

echo All services started! Open http://localhost:3000 in your browser.
pause
