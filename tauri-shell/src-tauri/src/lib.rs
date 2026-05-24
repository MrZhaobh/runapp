use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const HISTORY_KEY: &str = "history";
const LAST_KEY: &str = "last_url";
const MAX_ITEMS: usize = 200;
const DEFAULT_URL: &str = "https://mrzhaobh.github.io/runapp/";
const INIT_JS: &str = include_str!("inject.js");

#[derive(Clone, Debug, Serialize, Deserialize)]
struct HistoryItem {
    url: String,
    title: String,
    ts: i64,
}

#[derive(Default)]
struct AppState {
    inner: Mutex<()>,
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn load_history(app: &tauri::AppHandle) -> Vec<HistoryItem> {
    use tauri_plugin_store::StoreExt;
    let store = match app.store("history.json") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    store
        .get(HISTORY_KEY)
        .and_then(|v| serde_json::from_value::<Vec<HistoryItem>>(v).ok())
        .unwrap_or_default()
}

fn save_history(app: &tauri::AppHandle, items: &Vec<HistoryItem>) {
    use tauri_plugin_store::StoreExt;
    if let Ok(store) = app.store("history.json") {
        store.set(HISTORY_KEY, serde_json::to_value(items).unwrap_or_default());
        let _ = store.save();
    }
}

#[tauri::command]
fn record_url(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    let _g = state.inner.lock().map_err(|e| e.to_string())?;
    let mut items = load_history(&app);
    items.retain(|x| x.url != url);
    items.insert(
        0,
        HistoryItem {
            url: url.clone(),
            title: title.unwrap_or_else(|| url.clone()),
            ts: now_ms(),
        },
    );
    if items.len() > MAX_ITEMS {
        items.truncate(MAX_ITEMS);
    }
    save_history(&app, &items);
    use tauri_plugin_store::StoreExt;
    if let Ok(store) = app.store("history.json") {
        store.set(LAST_KEY, serde_json::Value::String(url));
        let _ = store.save();
    }
    Ok(())
}

#[tauri::command]
fn get_history(app: tauri::AppHandle) -> Vec<HistoryItem> {
    load_history(&app)
}

#[tauri::command]
fn get_last_url(app: tauri::AppHandle) -> Option<String> {
    load_last_url(&app)
}

fn load_last_url(app: &tauri::AppHandle) -> Option<String> {
    use tauri_plugin_store::StoreExt;
    app.store("history.json")
        .ok()
        .and_then(|s| s.get(LAST_KEY))
        .and_then(|v| v.as_str().map(|s| s.to_string()))
}

#[tauri::command]
fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    if let Ok(store) = app.store("history.json") {
        store.set(HISTORY_KEY, serde_json::Value::Array(vec![]));
        store.delete(LAST_KEY);
        store.save().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            record_url,
            get_history,
            get_last_url,
            clear_history
        ])
        .setup(|app| {
            // 直接从 store 读上次最后访问的 URL,没有就用默认首页
            // 关键: 不走 frontend redirect 中转 —— webview 一启动就指向目标
            // (之前的方案: frontend/index.html 调 IPC get_last_url 再 location.replace,
            //  第二次启动时这条链路会卡住,见 commit history)
            let app_handle = app.handle().clone();
            let last = load_last_url(&app_handle).unwrap_or_else(|| DEFAULT_URL.to_string());
            let target = last.parse::<tauri::Url>().unwrap_or_else(|_| {
                DEFAULT_URL.parse::<tauri::Url>().expect("default URL must parse")
            });
            let _w = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(target))
                .title("QingLong Shell")
                .initialization_script(INIT_JS)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
