// Saves do aplicativo de desktop: gravados como arquivos .json numa pasta visível do usuário
// (Documentos/Political Brazilian Simulator). Assim a partida não depende do armazenamento do navegador
// embutido e pode ser copiada, guardada ou levada para outro computador.
//
// Segurança: o jogo só lê e escreve dentro dessa pasta, e só arquivos com nome simples terminado em .json.

use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::Manager;

const FOLDER: &str = "Political Brazilian Simulator";

fn saves_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())?;
    let dir = base.join(FOLDER);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn safe_name(name: &str) -> Result<String, String> {
    let ok = !name.is_empty()
        && name.len() <= 80
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok { Ok(format!("{name}.json")) } else { Err("nome de arquivo inválido".into()) }
}

#[derive(serde::Serialize)]
struct SaveFile {
    name: String,
    modified: u64,
    size: u64,
}

#[tauri::command]
fn saves_folder(app: tauri::AppHandle) -> Result<String, String> {
    Ok(saves_dir(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
fn write_save(app: tauri::AppHandle, name: String, text: String) -> Result<String, String> {
    let path = saves_dir(&app)?.join(safe_name(&name)?);
    // Grava num temporário e renomeia: um travamento no meio não corrompe o save anterior.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_save(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    let path = saves_dir(&app)?.join(safe_name(&name)?);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_saves(app: tauri::AppHandle) -> Result<Vec<SaveFile>, String> {
    let mut out = Vec::new();
    for entry in fs::read_dir(saves_dir(&app)?).map_err(|e| e.to_string())? {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if path.extension().and_then(|x| x.to_str()) != Some("json") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|x| x.to_str()) else { continue };
        if safe_name(stem).is_err() {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        out.push(SaveFile { name: stem.to_string(), modified, size: meta.len() });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![saves_folder, write_save, read_save, list_saves])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Political Brazilian Simulator");
}
