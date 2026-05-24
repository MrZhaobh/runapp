# QingLong Shell (Tauri Mobile)

Android WebView 壳工程，加载 `https://mrzhaobh.github.io/` 并绕开 HTTPS → HTTP 的 mixed content 限制。

## 工程结构

```
tauri-shell/
  frontend/index.html        # 启动跳板:问后端取上次 URL,否则跳 mrzhaobh.github.io/
  src-tauri/
    Cargo.toml               # Rust 依赖 (tauri 2 + plugin-store)
    tauri.conf.json          # Tauri 配置
    build.rs
    app-icon.png             # 1024px 图标源 (改图后 `tauri icon app-icon.png` 重新生成)
    src/
      main.rs                # 二进制入口 (调 lib)
      lib.rs                 # 命令注册 + setup() 创建窗口 + 注入脚本
      inject.js              # 注入到每个 webview 页面的 JS (历史记录 + 悬浮抽屉 UI)
    capabilities/
      default.json           # 放行远程 URL 调用 IPC
  set-env.ps1                # 设 JAVA_HOME / ANDROID_HOME / NDK_HOME
```

## 准备

```powershell
. .\set-env.ps1
```

要点:
- JAVA_HOME 用 Android Studio 自带的 JBR 21 (`D:\Android\Android Studio2\jbr`)
- Android SDK / NDK 在 `D:\project\ZBH\work\ASSDK\`
- 全局已装 `@tauri-apps/cli` (npm)

## 构建

```powershell
cd src-tauri
tauri android build --apk --debug
```

输出 APK:
```
src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
```

## 历史记录功能

页面右下角 `☰` 悬浮按钮 → 抽屉:
- 输入 URL 跳转
- 一键回首页
- 历史列表 (按访问时间倒序,自动去重,最多 200 条)
- 清空历史

历史持久化到 Android app 私有目录的 `history.json` (Tauri Store plugin)。
启动时自动恢复到上次最后访问的 URL。

## Mixed content / cleartext 配置

由 `tauri android init` 生成的 Android 工程默认已经允许 cleartext (Tauri 2 在
`AndroidManifest.xml` 加了 `usesCleartextTraffic`),WebView 的 mixed content mode
也已经被设置为 `MIXED_CONTENT_ALWAYS_ALLOW` (在生成的 `RustWebView.kt` 里)。

如果发现 HTTP 仍被拦截,检查:
- `gen/android/app/src/main/AndroidManifest.xml` 的 `<application android:usesCleartextTraffic="true">`
- `gen/android/app/src/main/java/.../RustWebView.kt` 的 `settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW`
