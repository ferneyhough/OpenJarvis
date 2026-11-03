# Exports the Playnite library to JSON so Open Jarvis can search, launch and recommend games.
function Export-JarvisLibrary {
    $dir = Join-Path $PlayniteApi.Paths.ExtensionsDataPath "OpenJarvisBridge"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $games = foreach ($g in $PlayniteApi.Database.Games) {
        [PSCustomObject]@{
            id          = $g.Id.ToString()
            name        = $g.Name
            installed   = [bool]$g.IsInstalled
            playtime    = [int64]$g.Playtime
            play_count  = [int64]$g.PlayCount
            last_played = if ($g.LastActivity) { $g.LastActivity.ToString("o") } else { $null }
            genres      = @($g.Genres | ForEach-Object { $_.Name })
            platforms   = @($g.Platforms | ForEach-Object { $_.Name })
            source      = if ($g.Source) { $g.Source.Name } else { $null }
            favorite    = [bool]$g.Favorite
            hidden      = [bool]$g.Hidden
            completion  = if ($g.CompletionStatus) { $g.CompletionStatus.Name } else { $null }
        }
    }
    ConvertTo-Json -InputObject @($games) -Depth 4 | Out-File -FilePath (Join-Path $dir "library.json") -Encoding utf8
}

function OnApplicationStarted() { param($evnArgs) Export-JarvisLibrary }
function OnLibraryUpdated() { param($evnArgs) Export-JarvisLibrary }
function OnGameStopped() { param($evnArgs) Export-JarvisLibrary }
function OnGameInstalled() { param($evnArgs) Export-JarvisLibrary }
function OnGameUninstalled() { param($evnArgs) Export-JarvisLibrary }
