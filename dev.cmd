@echo off
setlocal
set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%BUNDLED_NODE%" (
  echo [persona-hub] 使用 Codex 打包的 Node 运行...
  "%BUNDLED_NODE%" "%~dp0server.mjs" %*
) else (
  node "%~dp0server.mjs" %*
)
