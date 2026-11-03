$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$gitBashCandidates = @(
    (Join-Path ${env:ProgramFiles} 'Git\bin\bash.exe'),
    (Join-Path ${env:ProgramFiles} 'Git\usr\bin\bash.exe'),
    (Join-Path ${env:LOCALAPPDATA} 'Programs\Git\bin\bash.exe')
)

$bash = $gitBashCandidates |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

if (-not $bash) {
    $bashCommand = Get-Command bash.exe -ErrorAction SilentlyContinue
    if ($bashCommand) {
        $bash = $bashCommand.Source
    }
}

if (-not $bash) {
    throw @'
Git Bash was not found.

Install Git for Windows from:
https://git-scm.com/download/win

Then reopen PowerShell and run this script again.
'@
}

Set-Location $repoRoot

Write-Host "Starting OpenJarvis through Git Bash..." -ForegroundColor Cyan
& $bash './scripts/quickstart.sh'

if ($LASTEXITCODE -ne 0) {
    throw "OpenJarvis quickstart failed with exit code $LASTEXITCODE."
}