$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$projectRoot = Split-Path -Parent $PSScriptRoot
$installRoot = Join-Path $projectRoot 'tools\PlaynitePortable'
$installedExecutable = Join-Path $installRoot 'Playnite.DesktopApp.exe'

if (Test-Path -LiteralPath $installedExecutable) {
    Write-Output "Playnite portable is already installed at $installedExecutable"
    exit 0
}

$release = Invoke-RestMethod `
    -Uri 'https://api.github.com/repos/JosefNemec/Playnite/releases/latest' `
    -Headers @{ 'User-Agent' = 'OpenJarvis-Playnite-Setup' }
$asset = $release.assets | Where-Object { $_.name -eq "$($release.tag_name).7z" } | Select-Object -First 1
if (-not $asset -or $asset.digest -notmatch '^sha256:([a-fA-F0-9]{64})$') {
    throw "The official Playnite release $($release.tag_name) did not provide a verifiable portable archive."
}
$expectedHash = $asset.digest.Substring(7).ToUpperInvariant()

$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) "OpenJarvis-Playnite-$($release.tag_name)"
$archivePath = Join-Path $workRoot $asset.name
$extractRoot = Join-Path $workRoot 'extracted'
New-Item -ItemType Directory -Force -Path $workRoot, $extractRoot | Out-Null
$completed = $false

try {
    if (-not (Test-Path -LiteralPath $archivePath)) {
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archivePath
    }

    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) {
        throw "Playnite archive SHA-256 mismatch. Expected $expectedHash, got $actualHash."
    }

    $sevenZip = Get-Command '7z.exe', '7za.exe', '7zz.exe' -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($sevenZip) {
        & $sevenZip.Source x '-y' "-o$extractRoot" $archivePath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "7-Zip failed to extract the Playnite archive (exit code $LASTEXITCODE)."
        }
    } else {
        $extractorRelease = Invoke-RestMethod `
            -Uri 'https://api.github.com/repos/ip7z/7zip/releases/latest' `
            -Headers @{ 'User-Agent' = 'OpenJarvis-Playnite-Setup' }
        $extractorName = "7z$($extractorRelease.tag_name.Replace('.', ''))-x64.exe"
        $extractorAsset = $extractorRelease.assets |
            Where-Object { $_.name -eq $extractorName } |
            Select-Object -First 1
        if (-not $extractorAsset -or $extractorAsset.digest -notmatch '^sha256:([a-fA-F0-9]{64})$') {
            throw 'The official 7-Zip release did not provide a verifiable Windows extractor.'
        }
        $extractorInstaller = Join-Path $workRoot $extractorName
        if (-not (Test-Path -LiteralPath $extractorInstaller)) {
            Invoke-WebRequest -Uri $extractorAsset.browser_download_url -OutFile $extractorInstaller
        }
        $extractorHash = (Get-FileHash -LiteralPath $extractorInstaller -Algorithm SHA256).Hash
        $expectedExtractorHash = $extractorAsset.digest.Substring(7).ToUpperInvariant()
        if ($extractorHash -ne $expectedExtractorHash) {
            throw "7-Zip installer SHA-256 mismatch. Expected $expectedExtractorHash, got $extractorHash."
        }

        $extractorDirectory = Join-Path $workRoot '7zip'
        $installArguments = "/S /D=`"$extractorDirectory`""
        $installerProcess = Start-Process `
            -FilePath $extractorInstaller `
            -ArgumentList $installArguments `
            -Wait `
            -PassThru
        if ($installerProcess.ExitCode -ne 0) {
            throw "The verified 7-Zip installer failed (exit code $($installerProcess.ExitCode))."
        }

        $extractorPath = Join-Path $extractorDirectory '7z.exe'
        if (-not (Test-Path -LiteralPath $extractorPath)) {
            throw 'The verified 7-Zip installer did not produce 7z.exe.'
        }
        & $extractorPath x '-y' "-o$extractRoot" $archivePath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "7-Zip failed to extract the Playnite archive (exit code $LASTEXITCODE)."
        }
    }

    $executable = Get-ChildItem -LiteralPath $extractRoot -Filter 'Playnite.DesktopApp.exe' -File -Recurse |
        Select-Object -First 1
    if (-not $executable) {
        throw 'The downloaded official archive did not contain Playnite.DesktopApp.exe.'
    }

    New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
    Get-ChildItem -LiteralPath $executable.DirectoryName -Force |
        Copy-Item -Destination $installRoot -Recurse -Force

    if (-not (Test-Path -LiteralPath $installedExecutable)) {
        throw "Playnite extraction did not produce the expected executable at $installedExecutable."
    }

    Write-Output "Installed Playnite $($release.tag_name) portable at $installedExecutable"
    Write-Output "Verified SHA-256: $actualHash"
    $completed = $true
} finally {
    if ($completed) {
        Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Output "Installation files were kept for retry at $workRoot"
    }
}
