$ErrorActionPreference = "Stop"
$base = "C:\Users\mokht\OneDrive\Desktop\SD_26\frontend\src"

New-Item -ItemType Directory -Force -Path "$base\features\auth\pages"
New-Item -ItemType Directory -Force -Path "$base\features\assistant\pages"
New-Item -ItemType Directory -Force -Path "$base\features\dashboard\pages"
New-Item -ItemType Directory -Force -Path "$base\features\misc\pages"

Move-Item -Force "$base\pages\Authentification.jsx" "$base\features\auth\pages\"
Move-Item -Force "$base\pages\ForgotPassword.jsx" "$base\features\auth\pages\"
Move-Item -Force "$base\pages\ResetPassword.jsx" "$base\features\auth\pages\"
Move-Item -Force "$base\pages\AssistantIA.jsx" "$base\features\assistant\pages\"
Move-Item -Force "$base\pages\DashboardAdmin.jsx" "$base\features\dashboard\pages\"
Move-Item -Force "$base\pages\ErrorPages.jsx" "$base\features\misc\pages\"

Remove-Item -Recurse -Force "$base\pages"
Write-Output "DONE"
