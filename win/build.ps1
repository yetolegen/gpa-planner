$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path lib/WebView2Loader.dll)) {
  Invoke-WebRequest https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4314.35/microsoft.web.webview2.1.0.4314.35.nupkg -OutFile wv2.zip
  Expand-Archive wv2.zip _x -Force
  New-Item -ItemType Directory lib -Force | Out-Null
  Copy-Item _x/lib/net462/Microsoft.Web.WebView2.Core.dll, _x/lib/net462/Microsoft.Web.WebView2.WinForms.dll, _x/runtimes/win-x64/native/WebView2Loader.dll lib
}
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory dist/app/web | Out-Null
foreach ($f in "index.html", "style.css", "core.js", "app.js", "icons", "vendor") { Copy-Item "../$f" dist/app/web -Recurse }
Copy-Item lib/*.dll dist/app
$csc = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
& $csc -nologo -target:winexe "-out:dist/app/GPA Planner.exe" -win32icon:../icons/app.ico -win32manifest:app.manifest -r:lib/Microsoft.Web.WebView2.Core.dll -r:lib/Microsoft.Web.WebView2.WinForms.dll -r:System.Windows.Forms.dll -r:System.Drawing.dll -r:System.Web.Extensions.dll App.cs
$nsis = (Get-Command makensis -ErrorAction SilentlyContinue).Source
if (-not $nsis) { $nsis = (Get-ChildItem "$env:LOCALAPPDATA/electron-builder/Cache", "${env:ProgramFiles(x86)}/NSIS" -Recurse -Filter makensis.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
& $nsis /V1 installer.nsi
Get-Item dist/*.exe | Select-Object Name, Length
