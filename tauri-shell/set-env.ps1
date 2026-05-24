$env:JAVA_HOME    = 'D:\Android\Android Studio2\jbr'
$env:ANDROID_HOME = 'D:\project\ZBH\work\ASSDK'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME     = "$env:ANDROID_HOME\ndk\27.1.12297006"
$env:ANDROID_NDK_HOME = $env:NDK_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\8.0\bin;$env:Path"
Write-Host "JAVA_HOME    = $env:JAVA_HOME"
Write-Host "ANDROID_HOME = $env:ANDROID_HOME"
Write-Host "NDK_HOME     = $env:NDK_HOME"
& java -version 2>&1 | Out-String | Write-Host
