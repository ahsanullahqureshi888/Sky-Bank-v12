# Build Script for Sky Banking Frontend

# Clear previous dist folders
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend/dist -ErrorAction SilentlyContinue

# Execute Vite compilation inside frontend directory
$cmd = "npm run build --prefix frontend"
Invoke-Expression $cmd
if ($LASTEXITCODE -ne 0) {
  Write-Error "Vite compilation failed."
  exit $LASTEXITCODE
}

# Copy compiled assets to root dist directory for deployment compatibility
New-Item -ItemType Directory -Force -Path dist | Out-Null
Copy-Item -Path frontend/dist/* -Destination dist -Recurse -Force

Write-Output "Vite build and assets copy completed successfully."
