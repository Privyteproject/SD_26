@echo off
mkdir "frontend\src\features\auth\pages" 2>nul
mkdir "frontend\src\features\assistant\pages" 2>nul
mkdir "frontend\src\features\dashboard\pages" 2>nul
mkdir "frontend\src\features\misc\pages" 2>nul

move "frontend\src\pages\Authentification.jsx" "frontend\src\features\auth\pages\"
move "frontend\src\pages\ForgotPassword.jsx" "frontend\src\features\auth\pages\"
move "frontend\src\pages\ResetPassword.jsx" "frontend\src\features\auth\pages\"
move "frontend\src\pages\AssistantIA.jsx" "frontend\src\features\assistant\pages\"
move "frontend\src\pages\DashboardAdmin.jsx" "frontend\src\features\dashboard\pages\"
move "frontend\src\pages\ErrorPages.jsx" "frontend\src\features\misc\pages\"

rmdir /S /Q "frontend\src\pages"
echo DONE
