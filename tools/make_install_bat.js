// 生成给最终用户用的「一键注册」批处理
//   node tools/make_install_bat.js [地址] [输出文件]
// 输出为 GBK 编码，中文在中文 Windows 的 cmd 里不会乱码。

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
let url = process.argv[2] || 'https://zeron-glitch.github.io/WPS-Curve-Anim/addon/'
if (!url.endsWith('/')) url += '/'
const out = process.argv[3] || path.join(ROOT, 'release', 'WpsCurveAnim-一键注册.bat')

const NAME = 'WpsCurveAnim'
const TYPE = 'wpp'

const bat = `@echo off
chcp 936 >nul
setlocal enabledelayedexpansion
set "URL=${url}"
set "DIR=%APPDATA%\\kingsoft\\wps\\jsaddons"
set "FILE=%DIR%\\publish.xml"
set "SILENT=0"
if /i "%~1"=="/y" set "SILENT=1"

title WPS 演示 动画曲线插件 - 注册工具
echo.
echo   ================================================
echo     WPS 演示 · 动画曲线插件
echo     注册工具
echo   ================================================
echo.
echo   插件地址:
echo   %URL%
echo.
echo   会写入这个文件:
echo   %FILE%
echo.

if "%SILENT%"=="0" (
  echo   提示: 请先完全退出 WPS，写完再打开。
  echo.
  pause
)

echo   [1/4] 检查网络...
where curl >nul 2>nul
if errorlevel 1 (
  echo         没有 curl，跳过检查
) else (
  for /f %%C in ('curl -s -o nul -w "%%{http_code}" --max-time 15 "%URL%ribbon.xml"') do set "CODE=%%C"
  if not "!CODE!"=="200" (
    echo         警告: 服务器返回 !CODE!，可能连不上。
    echo         如果是网络问题，装了也打不开，是否继续？
    if "%SILENT%"=="0" (
      choice /c YN /m "         继续写入"
      if errorlevel 2 goto :cancel
    )
  ) else (
    echo         正常 200
  )
)

echo   [2/4] 创建目录...
if not exist "%DIR%" mkdir "%DIR%"
if not exist "%DIR%" (
  echo         创建失败: %DIR%
  goto :fail
)
echo         就绪

echo   [3/4] 备份旧配置...
if not exist "%FILE%" goto :nobak
set "N=1"
:bkloop
if not exist "%DIR%\\publish.backup-%N%.xml" goto :bkmake
set /a N+=1
goto :bkloop
:bkmake
copy /y "%FILE%" "%DIR%\\publish.backup-%N%.xml" >nul
echo         已备份为 publish.backup-%N%.xml
goto :bakdone
:nobak
echo         没有旧配置，跳过
:bakdone

echo   [4/4] 写入注册文件...
> "%FILE%" echo ^<?xml version="1.0" encoding="UTF-8"?^>
>> "%FILE%" echo ^<jsplugins^>
>> "%FILE%" echo   ^<jspluginonline name="${NAME}" type="${TYPE}" url="%URL%" debug="" enable="enable_dev" install="null" customDomain=""/^>
>> "%FILE%" echo ^</jsplugins^>

if not exist "%FILE%" goto :fail
echo         完成

echo.
echo   ================================================
echo    好了。
echo.
echo    现在请:
echo      1. 完全退出 WPS 演示（所有窗口）
echo      2. 重新打开 WPS 演示
echo      3. 功能区应该出现「动画曲线」选项卡
echo.
echo    如果还是没有，多半是网络访问不了上面的地址，
echo    换手机热点试试，或者把情况反馈给作者。
echo   ================================================
echo.
if "%SILENT%"=="0" pause
exit /b 0

:cancel
echo.
echo   已取消，什么都没改。
if "%SILENT%"=="0" pause
exit /b 1

:fail
echo.
echo   写入失败。可以手动把下面的内容保存为 publish.xml:
echo   %FILE%
echo.
echo   ^<?xml version="1.0" encoding="UTF-8"?^>
echo   ^<jsplugins^>
echo   ^<jspluginonline name="${NAME}" type="${TYPE}" url="%URL%" debug="" enable="enable_dev" install="null" customDomain=""/^>
echo   ^</jsplugins^>
echo.
if "%SILENT%"=="0" pause
exit /b 1
`

fs.mkdirSync(path.dirname(out), { recursive: true })
// 先写 UTF-8 临时文件，交给调用方转 GBK
const tmp = out + '.utf8'
fs.writeFileSync(tmp, bat.replace(/\r?\n/g, '\r\n'), 'utf8')
console.log('已生成 UTF-8 草稿: ' + tmp)
console.log('目标地址: ' + url)
