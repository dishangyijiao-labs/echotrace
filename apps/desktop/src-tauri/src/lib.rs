use std::{
    env,
    fs::{self, OpenOptions},
    net::TcpStream,
    path::{Path, PathBuf},
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

fn venv_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("core-venv")
}

fn python_command_with_app(app: &AppHandle) -> PathBuf {
    // 1. Prefer the managed venv in app data dir (portable, created at first launch)
    let managed = venv_dir(app).join("bin").join("python3");
    if managed.exists() {
        return managed;
    }

    // 2. Fallback: venv co-located with core source (dev mode)
    let dev_venv = core_dir().join(".venv").join("bin").join("python3");
    if dev_venv.exists() {
        return dev_venv;
    }

    // 3. System Python
    PathBuf::from(env::var("ECHOTRACE_PYTHON").unwrap_or_else(|_| {
        if cfg!(windows) { "python".to_string() } else { "python3".to_string() }
    }))
}

fn python_command() -> PathBuf {
    // Used only before AppHandle is available; checks dev venv then system Python
    let dev_venv = core_dir().join(".venv").join("bin").join("python3");
    if dev_venv.exists() {
        return dev_venv;
    }
    PathBuf::from(env::var("ECHOTRACE_PYTHON").unwrap_or_else(|_| {
        if cfg!(windows) { "python".to_string() } else { "python3".to_string() }
    }))
}

/// Minimum acceptable Python version (major, minor).
const MIN_PYTHON: (u64, u64) = (3, 11);

fn python_version(exe: &Path) -> Option<(u64, u64)> {
    let out = Command::new(exe).arg("--version").output().ok()?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let combined = format!("{}{}", stdout, stderr);
    // "Python 3.12.4"
    let ver = combined.trim().strip_prefix("Python ")?;
    let mut parts = ver.split('.');
    let major: u64 = parts.next()?.parse().ok()?;
    let minor: u64 = parts.next()?.parse().ok()?;
    Some((major, minor))
}

fn find_system_python() -> Option<PathBuf> {
    // Explicit Homebrew paths first (not always on PATH inside .app sandbox)
    let candidates = [
        "/opt/homebrew/opt/python@3.12/bin/python3.12",
        "/opt/homebrew/opt/python@3.11/bin/python3.11",
        "/opt/homebrew/bin/python3.12",
        "/opt/homebrew/bin/python3.11",
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3.12",
        "/usr/local/bin/python3.11",
        "/usr/local/bin/python3",
        "python3.12",
        "python3.11",
        "python3",
    ];
    candidates.iter().find_map(|&p| {
        let path = PathBuf::from(p);
        if let Some(ver) = python_version(&path) {
            if ver >= MIN_PYTHON {
                return Some(path);
            }
        }
        None
    })
}

/// Create (or reuse) a venv in the app data dir and install requirements.
/// Recreates the venv if it was built with a too-old Python.
/// Uses a marker file (.installed) to skip pip on subsequent launches.
/// Returns the path to the python executable inside the venv.
fn setup_venv(app: &AppHandle) -> Result<PathBuf, String> {
    let venv = venv_dir(app);
    let python_bin = venv.join("bin").join("python3");
    let marker = venv.join(".installed");

    // Check existing venv Python version
    if python_bin.exists() {
        if let Some(ver) = python_version(&python_bin) {
            if ver >= MIN_PYTHON {
                if marker.exists() {
                    eprintln!("✅ Venv ready (Python {}.{})", ver.0, ver.1);
                    return Ok(python_bin);
                }
                eprintln!("✅ Venv Python ok ({}.{}), packages not yet installed", ver.0, ver.1);
                // Fall through to pip install
            } else {
                eprintln!("⚠️  Venv Python {}.{} < {}.{}, recreating", ver.0, ver.1, MIN_PYTHON.0, MIN_PYTHON.1);
                let _ = fs::remove_dir_all(&venv);
            }
        } else {
            eprintln!("⚠️  Could not determine venv Python version, recreating");
            let _ = fs::remove_dir_all(&venv);
        }
    }

    // Create venv if it doesn't exist (or was just deleted above)
    if !python_bin.exists() {
        let system_python = find_system_python()
            .ok_or_else(|| "No Python 3.11+ found. Install Python 3.12 via Homebrew: brew install python@3.12".to_string())?;
        eprintln!("🐍 Creating venv with {:?} at {:?}", system_python, venv);
        let status = Command::new(&system_python)
            .args(["-m", "venv", venv.to_str().unwrap_or(".")])
            .status()
            .map_err(|e| format!("venv creation failed: {e}"))?;
        if !status.success() {
            return Err("python -m venv failed".to_string());
        }
    }

    // Install requirements (only when marker is absent)
    let req = core_dir().join("requirements.txt");
    if req.exists() {
        eprintln!("📦 Installing requirements from {:?}", req);
        let pip = venv.join("bin").join("pip");
        let out = Command::new(&pip)
            .args(["install", "-r", req.to_str().unwrap_or("requirements.txt")])
            .output()
            .map_err(|e| format!("pip install failed: {e}"))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            eprintln!("⚠️  pip stderr: {}", stderr);
            return Err(format!("pip install failed: {}", stderr));
        }
        // Write marker so we skip pip on next launch
        let _ = fs::write(&marker, "ok");
        eprintln!("✅ Requirements installed");
    } else {
        eprintln!("⚠️  requirements.txt not found at {:?}", req);
        return Err(format!("requirements.txt missing at {:?}", req));
    }

    eprintln!("✅ Venv ready: {:?}", python_bin);
    Ok(python_bin)
}

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
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
                // exe_dir = .../Contents/MacOS  →  ../Resources/core = .../Contents/Resources/core
                exe_dir.join("../Resources/core"),
                
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

    let python = python_command_with_app(app);
    let core = core_dir();
    let data_dir = app_data_dir(app);
    eprintln!("🚀 spawn_process: python={:?} script={} cwd={:?} data={:?}", python, script, core, data_dir);

    // Augment PATH so child processes can find ffmpeg, git, etc.
    // macOS .app bundles have a minimal PATH that excludes Homebrew paths.
    let system_path = env::var("PATH").unwrap_or_default();
    let extra_paths = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/local/bin",
        "/usr/bin",
    ];
    let augmented_path = extra_paths
        .iter()
        .filter(|p| !system_path.contains(*p))
        .copied()
        .chain(std::iter::once(system_path.as_str()))
        .collect::<Vec<_>>()
        .join(":");

    // Point to bundled ffmpeg if it exists: <core>/bin/ffmpeg
    let bundled_ffmpeg = core.join("bin").join("ffmpeg");

    // Sanitize NO_PROXY: httpx cannot parse IPv6 CIDR entries (e.g. fd7a:115c:a1e0::/48)
    // and misinterprets the colons as port separators. Strip them to avoid runtime errors.
    let no_proxy = env::var("NO_PROXY")
        .or_else(|_| env::var("no_proxy"))
        .unwrap_or_default();
    let sanitized_no_proxy: String = no_proxy
        .split(',')
        .filter(|entry| {
            let trimmed = entry.trim();
            // Keep entries that don't look like raw IPv6 (contain multiple colons)
            trimmed.matches(':').count() < 2
        })
        .collect::<Vec<_>>()
        .join(",");

    let mut cmd = Command::new(python);
    cmd.arg(script)
        .current_dir(&core)
        .env("PATH", &augmented_path)
        .env("NO_PROXY", &sanitized_no_proxy)
        .env("no_proxy", &sanitized_no_proxy)
        .env("MCP_PROVIDERS_PATH", providers_file)
        .env("ECHOTRACE_DATA_DIR", &data_dir);

    if bundled_ffmpeg.exists() {
        cmd.env("ECHOTRACE_FFMPEG", &bundled_ffmpeg);
    }

    cmd.stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|err| format!("spawn failed (cwd={:?}): {}", core, err))
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
        .text("open", "Open EchoTrace")
        .separator()
        .text("start_core", "Start Core")
        .text("stop_core", "Stop Core")
        .separator()
        .text("start_worker", "Start Worker")
        .text("stop_worker", "Stop Worker")
        .separator()
        .text("quit", "Quit EchoTrace")
        .build()?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("EchoTrace — running in background");

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id() {
            id if id == "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
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

                // Ensure Python venv is ready before spawning processes
                eprintln!("🔧 core_dir = {:?}", core_dir());
                eprintln!("🔧 python   = {:?}", python_command_with_app(&app_handle_clone));
                match setup_venv(&app_handle_clone) {
                    Ok(py) => eprintln!("✅ Venv ready: {:?}", py),
                    Err(e) => eprintln!("⚠️  Venv setup failed: {} — will try system Python", e),
                }

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
            // Hide window instead of killing processes — Worker keeps running in background.
            // User can quit fully via the tray menu "Quit EchoTrace".
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
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
