use std::{
    env,
    fs::{self, OpenOptions},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::{
    menu::MenuBuilder,
    tray::TrayIconBuilder,
    AppHandle, Manager, State,
};

const DEFAULT_MCP_PROVIDERS: &str = r#"{
  "openai": {
    "type": "stdio",
    "command": "mcp-openai",
    "args": [],
    "tool": "summarize",
    "models": ["gpt-4o-mini", "gpt-4o", "o3-mini"],
    "env": {}
  },
  "claude": {
    "type": "stdio",
    "command": "mcp-claude",
    "args": [],
    "tool": "summarize",
    "models": ["claude-3-5-sonnet", "claude-3-5-haiku"],
    "env": {}
  },
  "deepseek": {
    "type": "stdio",
    "command": "mcp-deepseek",
    "args": [],
    "tool": "summarize",
    "models": ["deepseek-chat", "deepseek-reasoner"],
    "env": {}
  },
  "doubao": {
    "type": "stdio",
    "command": "mcp-doubao",
    "args": [],
    "tool": "summarize",
    "models": ["doubao-pro-128k", "doubao-lite-32k"],
    "env": {}
  },
  "local": {
    "type": "sse",
    "url": "http://127.0.0.1:8080/sse",
    "tool": "summarize",
    "models": ["qwen2.5:7b", "llama3.1:8b"],
    "env": {}
  }
}"#;

#[derive(Default)]
struct ProcessState {
    core: Mutex<Option<Child>>,
    worker: Mutex<Option<Child>>,
}

#[derive(serde::Serialize)]
struct ProcessStatus {
    core_running: bool,
    worker_running: bool,
}

fn python_command() -> PathBuf {
    // Use virtual environment Python
    let core = core_dir();
    let venv_python = core.join(".venv").join("bin").join("python3");
    
    // Fallback to system Python if venv doesn't exist
    if venv_python.exists() {
        venv_python
    } else {
        PathBuf::from(
            env::var("ECHOTRACE_PYTHON").unwrap_or_else(|_| {
                if cfg!(windows) {
                    "python".to_string()
                } else {
                    "python3".to_string()
                }
            })
        )
    }
}

fn core_dir() -> PathBuf {
    if let Ok(dir) = env::var("ECHOTRACE_CORE_DIR") {
        return PathBuf::from(dir);
    }
    
    // Try to find core directory relative to the executable
    if let Ok(exe) = env::current_exe() {
        // For .app bundles: EchoTrace.app/Contents/MacOS/EchoTrace
        // We need to go up and find the project root
        if let Some(parent) = exe.parent() {
            // Try going up several levels to find apps/core
            let core_path = parent
                .parent()  // Contents
                .and_then(|p: &std::path::Path| p.parent())  // EchoTrace.app
                .and_then(|p: &std::path::Path| p.parent())  // macos
                .and_then(|p: &std::path::Path| p.parent())  // bundle
                .and_then(|p: &std::path::Path| p.parent())  // release
                .map(|p: &std::path::Path| p.join("apps").join("core"));
            
            if let Some(path) = core_path {
                if path.exists() {
                    return path;
                }
            }
        }
    }
    
    // Fallback to relative path (for development)
    PathBuf::from("../core")
}

fn log_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir.join(name))
}

fn providers_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir.join("mcp-providers.json"))
}

fn ensure_providers_file(app: &AppHandle) -> Result<PathBuf, String> {
    let path = providers_path(app)?;
    if !path.exists() {
        fs::write(&path, DEFAULT_MCP_PROVIDERS).map_err(|err| err.to_string())?;
    }
    Ok(path)
}

fn spawn_process(app: &AppHandle, script: &str, log_name: &str) -> Result<Child, String> {
    let log_file = log_path(app, log_name)?;
    let providers_file = ensure_providers_file(app)?;
    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|err| err.to_string())?;
    let stderr = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|err| err.to_string())?;

    Command::new(python_command())
        .arg(script)
        .current_dir(core_dir())
        .env("MCP_PROVIDERS_PATH", providers_file)
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|err| err.to_string())
}

fn child_running(child: &mut Child) -> bool {
    match child.try_wait() {
        Ok(None) => true,
        _ => false,
    }
}

fn is_running(target: &Mutex<Option<Child>>) -> bool {
    if let Ok(mut guard) = target.lock() {
        if let Some(child) = guard.as_mut() {
            if child_running(child) {
                return true;
            }
            *guard = None;
        }
    }
    false
}

fn start_process(
    app: &AppHandle,
    target: &Mutex<Option<Child>>,
    script: &str,
    log_name: &str,
) -> Result<bool, String> {
    let mut guard = target.lock().map_err(|_| "lock failed".to_string())?;
    if let Some(child) = guard.as_mut() {
        if child_running(child) {
            return Ok(false);
        }
    }
    let child = spawn_process(app, script, log_name)?;
    *guard = Some(child);
    Ok(true)
}

fn stop_process(target: &Mutex<Option<Child>>) -> Result<bool, String> {
    let mut guard = target.lock().map_err(|_| "lock failed".to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn start_core(app: AppHandle, state: State<'_, ProcessState>) -> Result<bool, String> {
    start_process(&app, &state.core, "app.py", "core.log")
}

#[tauri::command]
fn stop_core(state: State<'_, ProcessState>) -> Result<bool, String> {
    stop_process(&state.core)
}

#[tauri::command]
fn start_worker(app: AppHandle, state: State<'_, ProcessState>) -> Result<bool, String> {
    start_process(&app, &state.worker, "worker.py", "worker.log")
}

#[tauri::command]
fn stop_worker(state: State<'_, ProcessState>) -> Result<bool, String> {
    stop_process(&state.worker)
}

#[tauri::command]
fn process_status(state: State<'_, ProcessState>) -> ProcessStatus {
    ProcessStatus {
        core_running: is_running(&state.core),
        worker_running: is_running(&state.worker),
    }
}

#[tauri::command]
fn read_logs(app: AppHandle, kind: String, lines: Option<usize>) -> Result<String, String> {
    let name = match kind.as_str() {
        "core" => "core.log",
        "worker" => "worker.log",
        _ => return Err("unknown log kind".into()),
    };
    let path = log_path(&app, name)?;
    if !path.exists() {
        return Ok(String::new());
    }
    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let count = lines.unwrap_or(200);
    let mut tail = content
        .lines()
        .rev()
        .take(count)
        .collect::<Vec<_>>();
    tail.reverse();
    Ok(tail.join("\n"))
}

#[tauri::command]
fn clear_logs(app: AppHandle, kind: String) -> Result<(), String> {
    let name = match kind.as_str() {
        "core" => "core.log",
        "worker" => "worker.log",
        _ => return Err("unknown log kind".into()),
    };
    let path = log_path(&app, name)?;
    fs::write(path, "").map_err(|err| err.to_string())
}

#[tauri::command]
fn load_mcp_config(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = ensure_providers_file(&app)?;
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

#[tauri::command]
fn save_mcp_config(app: AppHandle, config: serde_json::Value) -> Result<(), String> {
    let path = providers_path(&app)?;
    let raw = serde_json::to_string_pretty(&config).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

fn handle_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("start_core", "Start Core")
        .text("stop_core", "Stop Core")
        .separator()
        .text("start_worker", "Start Worker")
        .text("stop_worker", "Stop Worker")
        .separator()
        .text("quit", "Quit")
        .build()?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("EchoTrace");

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .on_menu_event(|app, event| match event.id() {
            id if id == "start_core" => {
                let _ = start_process(app, &app.state::<ProcessState>().core, "app.py", "core.log");
            }
            id if id == "stop_core" => {
                let _ = stop_process(&app.state::<ProcessState>().core);
            }
            id if id == "start_worker" => {
                let _ = start_process(app, &app.state::<ProcessState>().worker, "worker.py", "worker.log");
            }
            id if id == "stop_worker" => {
                let _ = stop_process(&app.state::<ProcessState>().worker);
            }
            id if id == "quit" => {
                let _ = stop_process(&app.state::<ProcessState>().worker);
                let _ = stop_process(&app.state::<ProcessState>().core);
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProcessState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle();
            handle_tray(&app_handle)?;
            
            // Auto-start core and worker services
            let state = app.state::<ProcessState>();
            
            // Start Core API
            match start_process(&app_handle, &state.core, "app.py", "core.log") {
                Ok(_) => println!("✅ Core API started automatically"),
                Err(e) => eprintln!("⚠️  Failed to start Core API: {}", e),
            }
            
            // Give Core API a moment to start, then start Worker
            let app_handle_clone = app_handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                let state = app_handle_clone.state::<ProcessState>();
                match start_process(&app_handle_clone, &state.worker, "worker.py", "worker.log") {
                    Ok(_) => println!("✅ Worker started automatically"),
                    Err(e) => eprintln!("⚠️  Failed to start Worker: {}", e),
                }
            });
            
            Ok(())
        })
        .on_window_event(|window, event| {
            // Clean up processes when app is closing
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<ProcessState>();
                let _ = stop_process(&state.worker);
                let _ = stop_process(&state.core);
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_core,
            stop_core,
            start_worker,
            stop_worker,
            process_status,
            read_logs,
            clear_logs,
            load_mcp_config,
            save_mcp_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
