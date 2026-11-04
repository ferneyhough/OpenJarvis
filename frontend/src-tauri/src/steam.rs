use super::SECURE_KEY_SERVICE;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

const STEAM_API_KEY_NAME: &str = "STEAM_WEB_API_KEY";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamGame {
    app_id: u32,
    name: String,
    playtime_hours: f64,
    installed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamNowPlaying {
    app_id: u32,
    name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamLibrary {
    supported: bool,
    installed: bool,
    api_configured: bool,
    games: Vec<SteamGame>,
    now_playing: Option<SteamNowPlaying>,
    api_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamStatus {
    supported: bool,
    installed: bool,
}

#[derive(Debug, Deserialize)]
struct OwnedGamesResponse {
    response: OwnedGames,
}

#[derive(Debug, Default, Deserialize)]
struct OwnedGames {
    #[serde(default)]
    games: Vec<OwnedGame>,
}

#[derive(Debug, Deserialize)]
struct OwnedGame {
    appid: u32,
    name: String,
    #[serde(default)]
    playtime_forever: u64,
}

#[derive(Debug, Deserialize)]
struct PlayerSummariesResponse {
    response: PlayerSummaries,
}

#[derive(Debug, Default, Deserialize)]
struct PlayerSummaries {
    #[serde(default)]
    players: Vec<PlayerSummary>,
}

#[derive(Debug, Deserialize)]
struct PlayerSummary {
    #[serde(default)]
    gameid: Option<String>,
    #[serde(default)]
    gameextrainfo: Option<String>,
}

fn parse_vdf_tokens(line: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut chars = line.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '"' {
            continue;
        }
        let mut token = String::new();
        while let Some(ch) = chars.next() {
            match ch {
                '"' => break,
                '\\' => match chars.next() {
                    Some('\\') => token.push('\\'),
                    Some('"') => token.push('"'),
                    Some(other) => {
                        token.push('\\');
                        token.push(other);
                    }
                    None => token.push('\\'),
                },
                other => token.push(other),
            }
        }
        tokens.push(token);
    }
    tokens
}

fn vdf_field(contents: &str, field: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let tokens = parse_vdf_tokens(line);
        tokens
            .windows(2)
            .find(|pair| pair[0].eq_ignore_ascii_case(field))
            .map(|pair| pair[1].clone())
    })
}

fn is_valid_steam_id(steam_id: &str) -> bool {
    steam_id.len() == 17 && steam_id.bytes().all(|byte| byte.is_ascii_digit())
}

#[cfg(target_os = "windows")]
fn steam_root_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(output) = std::process::Command::new("reg.exe")
        .args(["query", r"HKCU\Software\Valve\Steam", "/v", "SteamPath"])
        .output()
    {
        let registry_output = String::from_utf8_lossy(&output.stdout);
        if let Some(path) = registry_output.lines().find_map(|line| {
            let (_, value) = line.split_once("REG_SZ")?;
            let value = value.trim();
            (!value.is_empty()).then(|| PathBuf::from(value))
        }) {
            candidates.push(path);
        }
    }
    if let Some(path) = std::env::var_os("STEAM_PATH") {
        candidates.push(PathBuf::from(path));
    }
    for variable in ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"] {
        if let Some(path) = std::env::var_os(variable) {
            candidates.push(PathBuf::from(path).join("Steam"));
        }
    }
    candidates
}

#[cfg(target_os = "windows")]
pub fn find_steam_root() -> Option<PathBuf> {
    steam_root_candidates()
        .into_iter()
        .find(|path| path.join("steam.exe").is_file() || path.join("steamapps").is_dir())
}

#[cfg(target_os = "windows")]
fn local_steam_games(root: &Path) -> Result<Vec<SteamGame>, String> {
    let mut libraries = vec![root.to_path_buf()];
    let folders = root.join("steamapps").join("libraryfolders.vdf");
    if let Ok(contents) = std::fs::read_to_string(&folders) {
        for line in contents.lines() {
            let tokens = parse_vdf_tokens(line);
            if let Some(path) = tokens
                .windows(2)
                .find(|pair| pair[0].eq_ignore_ascii_case("path"))
                .map(|pair| PathBuf::from(&pair[1]))
            {
                libraries.push(path);
            }
        }
    }

    let mut games = HashMap::new();
    for library in libraries {
        let steamapps = library.join("steamapps");
        let entries = match std::fs::read_dir(&steamapps) {
            Ok(entries) => entries,
            Err(error) if steamapps == root.join("steamapps") => {
                return Err(format!("Could not read the Steam library: {error}"));
            }
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
                continue;
            }
            let Ok(contents) = std::fs::read_to_string(entry.path()) else {
                continue;
            };
            let Some(app_id) =
                vdf_field(&contents, "appid").and_then(|value| value.parse::<u32>().ok())
            else {
                continue;
            };
            let Some(name) = vdf_field(&contents, "name") else {
                continue;
            };
            let installdir = vdf_field(&contents, "installdir").unwrap_or_default();
            let installed =
                !installdir.is_empty() && steamapps.join("common").join(installdir).is_dir();
            games.insert(
                app_id,
                SteamGame {
                    app_id,
                    name,
                    playtime_hours: 0.0,
                    installed,
                },
            );
        }
    }
    let mut games: Vec<_> = games.into_values().collect();
    games.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(games)
}

async fn fetch_web_library(
    api_key: &str,
    steam_id: &str,
) -> Result<(Vec<SteamGame>, Option<SteamNowPlaying>), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|_| "Could not initialize the Steam Web API client.".to_string())?;
    let owned_response = client
        .get("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/")
        .query(&[
            ("key", api_key),
            ("steamid", steam_id),
            ("include_appinfo", "1"),
            ("include_played_free_games", "1"),
        ])
        .send()
        .await
        .map_err(|_| {
            "Steam library request failed. Check your connection and profile privacy.".to_string()
        })?;
    if !owned_response.status().is_success() {
        return Err(format!(
            "Steam library request returned HTTP {}. Check the API key and profile privacy.",
            owned_response.status()
        ));
    }
    let owned: OwnedGamesResponse = owned_response
        .json()
        .await
        .map_err(|_| "Steam returned an unreadable library response.".to_string())?;
    let games = owned
        .response
        .games
        .into_iter()
        .map(|game| SteamGame {
            app_id: game.appid,
            name: game.name,
            playtime_hours: game.playtime_forever as f64 / 60.0,
            installed: false,
        })
        .collect();

    let player_response = client
        .get("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/")
        .query(&[("key", api_key), ("steamids", steam_id)])
        .send()
        .await
        .map_err(|_| "Steam now-playing request failed. Check your connection.".to_string())?;
    if !player_response.status().is_success() {
        return Err(format!(
            "Steam now-playing request returned HTTP {}.",
            player_response.status()
        ));
    }
    let players: PlayerSummariesResponse = player_response
        .json()
        .await
        .map_err(|_| "Steam returned an unreadable player status response.".to_string())?;
    let now_playing = players.response.players.into_iter().find_map(|player| {
        let app_id = player.gameid?.parse::<u32>().ok()?;
        Some(SteamNowPlaying {
            app_id,
            name: player.gameextrainfo?,
        })
    });
    Ok((games, now_playing))
}

fn secure_api_key() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SECURE_KEY_SERVICE, STEAM_API_KEY_NAME)
        .map_err(|_| "Could not access secure Steam API key storage.".to_string())?;
    match entry.get_password() {
        Ok(value) if !value.is_empty() => Ok(Some(value)),
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read the Steam API key from secure storage.".to_string()),
    }
}

#[tauri::command]
pub fn save_steam_api_key(api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.len() > 256 || api_key.chars().any(char::is_control) {
        return Err("The Steam API key has an invalid format.".to_string());
    }
    let entry = keyring::Entry::new(SECURE_KEY_SERVICE, STEAM_API_KEY_NAME)
        .map_err(|_| "Could not access secure Steam API key storage.".to_string())?;
    if api_key.is_empty() {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Could not remove the Steam API key from secure storage.".to_string()),
        };
    }
    entry
        .set_password(api_key)
        .map_err(|_| "Could not save the Steam API key to secure storage.".to_string())
}

#[tauri::command]
pub fn get_steam_api_key_status() -> Result<bool, String> {
    Ok(secure_api_key()?.is_some())
}

#[tauri::command]
pub fn get_steam_status() -> SteamStatus {
    #[cfg(target_os = "windows")]
    {
        SteamStatus {
            supported: true,
            installed: find_steam_root().is_some(),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        SteamStatus {
            supported: false,
            installed: false,
        }
    }
}

#[tauri::command]
pub async fn get_steam_library(steam_id64: String) -> Result<SteamLibrary, String> {
    #[cfg(target_os = "windows")]
    let (supported, root, local_games) = match find_steam_root() {
        Some(root) => (true, Some(root.clone()), local_steam_games(&root)?),
        None => (true, None, Vec::new()),
    };
    #[cfg(not(target_os = "windows"))]
    let (supported, root, local_games): (bool, Option<PathBuf>, Vec<SteamGame>) =
        (false, None, Vec::new());

    let api_key = secure_api_key()?;
    let api_configured = api_key.is_some();
    let installed = root.is_some();
    let mut library = SteamLibrary {
        supported,
        installed,
        api_configured,
        games: local_games,
        now_playing: None,
        api_error: None,
    };

    if let Some(api_key) = api_key {
        let steam_id = steam_id64.trim();
        if !is_valid_steam_id(steam_id) {
            library.api_error =
                Some("Enter a 17-digit SteamID64 in Settings to load online data.".to_string());
            return Ok(library);
        }
        match fetch_web_library(&api_key, steam_id).await {
            Ok((remote_games, now_playing)) => {
                let local_by_id: HashMap<_, _> = library
                    .games
                    .drain(..)
                    .map(|game| (game.app_id, game))
                    .collect();
                let mut merged: HashMap<u32, SteamGame> = remote_games
                    .into_iter()
                    .map(|mut game| {
                        if let Some(local) = local_by_id.get(&game.app_id) {
                            game.installed = local.installed;
                            if game.name.is_empty() {
                                game.name = local.name.clone();
                            }
                        }
                        (game.app_id, game)
                    })
                    .collect();
                for (app_id, game) in local_by_id {
                    merged.entry(app_id).or_insert(game);
                }
                library.games = merged.into_values().collect();
                library.now_playing = now_playing;
                library.games.sort_by(|left, right| {
                    right
                        .installed
                        .cmp(&left.installed)
                        .then_with(|| right.playtime_hours.total_cmp(&left.playtime_hours))
                        .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
                });
            }
            Err(error) => library.api_error = Some(error),
        }
    }
    Ok(library)
}

#[tauri::command]
pub fn open_steam() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if find_steam_root().is_none() {
            return Err(
                "Steam was not found. Install the Steam client, then restart OpenJarvis."
                    .to_string(),
            );
        }
        std::process::Command::new("explorer.exe")
            .arg("steam://open/main")
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not open Steam: {error}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Steam launching is currently available in OpenJarvis Desktop on Windows.".to_string())
    }
}

#[tauri::command]
pub fn launch_steam_game(app_id: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let root = find_steam_root()
            .ok_or_else(|| "Steam was not found. Install the Steam client first.".to_string())?;
        let games = local_steam_games(&root)?;
        if !games
            .iter()
            .any(|game| game.app_id == app_id && game.installed)
        {
            return Err("Only installed Steam games can be launched from OpenJarvis.".to_string());
        }
        std::process::Command::new("explorer.exe")
            .arg(format!("steam://rungameid/{app_id}"))
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not launch the Steam game: {error}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_id;
        Err("Steam launching is currently available in OpenJarvis Desktop on Windows.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{is_valid_steam_id, parse_vdf_tokens, vdf_field};

    #[test]
    fn parses_escaped_windows_paths_from_vdf() {
        assert_eq!(
            parse_vdf_tokens(r#""path" "D:\\Steam Library""#),
            vec!["path".to_string(), r"D:\Steam Library".to_string()]
        );
    }

    #[test]
    fn reads_fields_without_matching_substrings() {
        let manifest = "\"name\" \"Portal 2\"\n\"installdir\" \"Portal 2\"\n";
        assert_eq!(vdf_field(manifest, "name").as_deref(), Some("Portal 2"));
        assert_eq!(vdf_field(manifest, "appid"), None);
    }

    #[test]
    fn validates_steam_id64_shape() {
        assert!(is_valid_steam_id("76561198000000000"));
        assert!(!is_valid_steam_id("12345"));
        assert!(!is_valid_steam_id("7656119800000000x"));
    }
}
