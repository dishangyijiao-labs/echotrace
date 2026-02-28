use std::{
    env,
    fs::{self, OpenOptions},
    net::TcpStream,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
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

impl Drop for ProcessState {
    fn drop(&mut self) {
        // Ensure processes are stopped when ProcessState is dropped
        let _ = stop_process(&self.worker);
        let _ = stop_process(&self.core);
    }
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
        PathBuf::from(env::var("ECHOTRACE_PYTHON").unwrap_or_else(|_| {
            if cfg!(windows) {
                "python".to_string()
            } else {
                "python3.12".to_string()
            }
        }))
    }
}

fn core_dir() -> PathBuf {
    // 1. Check environment variable first
    if let Ok(dir) = env::var("ECHOTRACE_CORE_DIR") {
        let path = PathBuf::from(&dir);
        if path.exists() && path.join("app.py").exists() {
            return path;
        }
    }
    
    // 2. Try to find core directory relative to the executable
    if let Ok(exe) = env::current_exe() {
        // Get the directory containing the executable
        if let Some(exe_dir) = exe.parent() {
            // Try multiple possible locations
            let candidates = vec![
                // Packaged .app bundle: EchoTrace.app/Contents/MacOS/echotrace
                // Core should be in: EchoTrace.app/Contents/Resources/core
                exe_dir.join("../../Resources/core"),
                
                // Development mode: running from src-tauri/target/debug or release
                // Executable: apps/desktop/src-tauri/target/debug/echotrace
                // Core: apps/core
                exe_dir.join("../../../..").join("core"),
                exe_dir.join("../../../../apps/core"),
                exe_dir.join("../../../..").join("apps/core"),
                exe_dir.join("../../../../..").join("apps/core"),
            ];
            
            for candidate in candidates {
                if let Ok(canonical) = candidate.canonicalize() {
                    if canonical.join("app.py").exists() {
                        return canonical;
                    }
                }
            }
        }
    }
    
    // 3. Try current working directory relative path (development fallback)
    let cwd_relative = PathBuf::from("../core");
    if cwd_relative.join("app.py").exists() {
        return cwd_relative;
    }
    
    let cwd_relative_apps_core = PathBuf::from("../apps/core");
    if cwd_relative_apps_core.join("app.py").exists() {
        return cwd_relative_apps_core;
    }
    
    // 4. Try to find core directory in parent directories
    if let Ok(cwd) = env::current_dir() {
        let mut current = cwd;
        let max_depth = 10;
        for _ in 0..max_depth {
            if let Some(parent) = current.parent() {
                let core_path = parent.join("apps/core");
                if core_path.join("app.py").exists() {
                    if let Ok(canonical) = core_path.canonicalize() {
                        return canonical;
                    }
                    return core_path;
                }
                
                let core_path_alternate = parent.join("core");
                if core_path_alternate.join("app.py").exists() {
                    if let Ok(canonical) = core_path_alternate.canonicalize() {
                        return canonical;
                    }
                    return core_path_alternate;
                }
                
                current = parent.to_path_buf();
            }
        }
    }
    
    // Last resort fallback - try to find apps/core relative to current directory
    let fallback = PathBuf::from("../core");
    eprintln!("⚠️  Unable to find core directory automatically, using fallback: {:?}", fallback);
    fallback
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

/// Check if a port is listening (service is running)
fn is_port_listening(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
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
    // Use port detection as primary method (more reliable with Uvicorn reloader)
    // Core API runs on port 8787
    let core_running = is_port_listening(8787) || is_running(&state.core);
    
    // Worker doesn't have a port, so we check process status
    // But also check if there's a worker process running via ps
    let worker_running = is_running(&state.worker) || check_worker_process();
    
    ProcessStatus {
        core_running,
        worker_running,
    }
}

/// Check if worker.py process is running
fn check_worker_process() -> bool {
    Command::new("pgrep")
        .args(["-f", "worker.py"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
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
            
            // Auto-start core and worker services in background
            let app_handle_clone = app_handle.clone();
            std::thread::spawn(move || {
                let state = app_handle_clone.state::<ProcessState>();
                
                // Start Core API
                match start_process(&app_handle_clone, &state.core, "app.py", "core.log") {
                    Ok(started) => {
                        if started {
                            eprintln!("✅ Core API process started");
                            
                            // Wait for Core API to be ready (check port 8787)
                            let mut retries = 0;
                            let max_retries = 30; // 30 seconds timeout
                            while retries < max_retries {
                                if is_port_listening(8787) {
                                    eprintln!("✅ Core API is ready on port 8787");
                                    
                                    // Start Worker after Core API is ready
                                    std::thread::sleep(std::time::Duration::from_secs(1));
                                    match start_process(&app_handle_clone, &state.worker, "worker.py", "worker.log") {
                                        Ok(worker_started) => {
                                            if worker_started {
                                                eprintln!("✅ Worker started automatically");
                                            } else {
                                                eprintln!("ℹ️  Worker was already running");
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("⚠️  Failed to start Worker: {}", e);
                                        }
                                    }
                                    return;
                                }
                                std::thread::sleep(std::time::Duration::from_secs(1));
                                retries += 1;
                            }
                            eprintln!("⚠️  Core API did not become ready within {} seconds", max_retries);
                        } else {
                            eprintln!("ℹ️  Core API was already running");
                            
                            // Core already running, start worker anyway
                            std::thread::sleep(std::time::Duration::from_secs(1));
                            match start_process(&app_handle_clone, &state.worker, "worker.py", "worker.log") {
                                Ok(worker_started) => {
                                    if worker_started {
                                        eprintln!("✅ Worker started automatically");
                                    } else {
                                        eprintln!("ℹ️  Worker was already running");
                                    }
                                }
                                Err(e) => {
                                    eprintln!("⚠️  Failed to start Worker: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("⚠️  Failed to start Core API: {}", e);
                        eprintln!("   Please check Python environment and core directory");
                        eprintln!("   Core dir: {:?}", core_dir());
                        eprintln!("   Python: {:?}", python_command());
                    }
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
