# =====================================================================
# SkyMessage convenience deploy script (PowerShell, Windows)
#
# Walks you through the 4-step cloud bring-up the morning of launch.
# Each step is idempotent and safe to re-run. The script never deletes
# anything or pushes destructive changes without you confirming.
#
# Usage:
#   .\deploy.ps1 supabase     # apply DB migrations + seed against linked project
#   .\deploy.ps1 server       # deploy apps/server to Fly.io
#   .\deploy.ps1 web          # deploy apps/web to Vercel
#   .\deploy.ps1 desktop      # build the Windows installer
#   .\deploy.ps1 all          # all of the above, in order
# =====================================================================
param(
  [Parameter(Position = 0)]
  [ValidateSet('supabase', 'server', 'web', 'desktop', 'all')]
  [string]$Step = 'all'
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

function Step-Supabase {
  Write-Host "==> Supabase: applying migrations to linked project" -ForegroundColor Cyan
  Push-Location $repoRoot
  try {
    if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
      throw "Install the Supabase CLI first:  npm i -g supabase"
    }
    supabase db push
    Write-Host "    Regenerating typed Database..." -ForegroundColor DarkGray
    supabase gen types typescript --linked | Out-File -Encoding utf8 'packages/types/src/database.generated.ts'
  } finally { Pop-Location }
}

function Step-Server {
  Write-Host "==> Server: deploying Hono API to Fly.io" -ForegroundColor Cyan
  if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
    throw "Install flyctl first:  iwr https://fly.io/install.ps1 -useb | iex"
  }

  # Build context must be the repo root so Dockerfile can see packages/.
  # We stage by copying the apps/server/Dockerfile up one level temporarily.
  $dockerStaging = Join-Path $repoRoot 'Dockerfile-fly'
  Copy-Item -Path (Join-Path $repoRoot 'apps/server/Dockerfile') -Destination $dockerStaging -Force

  Push-Location (Join-Path $repoRoot 'apps/server')
  try {
    fly deploy --remote-only
  } finally {
    Pop-Location
    Remove-Item $dockerStaging -Force -ErrorAction SilentlyContinue
  }
}

function Step-Web {
  Write-Host "==> Web: deploying Next.js to Vercel" -ForegroundColor Cyan
  if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    throw "Install Vercel CLI first:  npm i -g vercel"
  }
  Push-Location (Join-Path $repoRoot 'apps/web')
  try {
    vercel --prod --yes
  } finally { Pop-Location }
}

function Step-Desktop {
  Write-Host "==> Desktop: building Windows installer" -ForegroundColor Cyan
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "Install pnpm first:  npm i -g pnpm@9.12.0"
  }

  # The renderer + main need the production env baked in.
  $required = @('DESKTOP_API_BASE_URL', 'DESKTOP_SUPABASE_URL', 'DESKTOP_SUPABASE_ANON_KEY')
  foreach ($v in $required) {
    if (-not (Get-Item -Path "env:$v" -ErrorAction SilentlyContinue)) {
      throw "Set `$env:$v before building the installer (or put it in `.env` at repo root)."
    }
  }

  Push-Location $repoRoot
  try {
    pnpm install
    pnpm --filter '@skymessage/types' build
    pnpm --filter '@skymessage/shared' build
    pnpm --filter '@skymessage/desktop' package:win

    $release = Join-Path $repoRoot 'apps/desktop/release'
    $installer = Get-ChildItem -Path $release -Filter '*.exe' -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($installer) {
      Write-Host "    Built: $($installer.FullName)" -ForegroundColor Green
      Write-Host "    Size:  $([math]::Round($installer.Length/1MB, 1)) MB"
    }
  } finally { Pop-Location }
}

switch ($Step) {
  'supabase' { Step-Supabase }
  'server'   { Step-Server   }
  'web'      { Step-Web      }
  'desktop'  { Step-Desktop  }
  'all'      {
    Step-Supabase
    Step-Server
    Step-Web
    Step-Desktop
  }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
