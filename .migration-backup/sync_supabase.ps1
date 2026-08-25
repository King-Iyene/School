# Sync Supabase Remote with Local Migrations
$project_ref = "fxmlolcxyiaxqicrnidn"
$db_password = Read-Host "Enter your Supabase Database Password"
if (-not $db_password) { exit }
supabase link --project-ref $project_ref --password $db_password
supabase db push
if ($LASTEXITCODE -eq 0) { Write-Host "Successfully updated remote database schema!" -ForegroundColor Green }
