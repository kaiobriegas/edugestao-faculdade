@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\next" (
  echo Dependencias nao encontradas. Siga o README para instalar com npm.cmd ci.
  goto erro
)
if not exist ".env" (
  echo Configuracao nao encontrada. Execute npm.cmd run env:init e siga o README.
  goto erro
)
echo Iniciando PostgreSQL e Mailpit locais...
call npm.cmd run db:local:start
if errorlevel 1 goto erro
call npm.cmd run mail:local:start
if errorlevel 1 goto erro
echo.
echo Abra http://localhost:3000/login no navegador.
echo Primeiro acesso: crie sua conta com npm.cmd run bootstrap:root em outro terminal.
echo Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.
echo.
call npm.cmd run dev -- --port 3000
if errorlevel 1 goto erro
exit /b 0
:erro
echo.
echo Nao foi possivel iniciar. Consulte docs\GUIA_EXECUCAO.md e a mensagem acima.
pause
exit /b 1
