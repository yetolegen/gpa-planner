# gpa planner

plan the grades you need for the gpa you want. free. private. no account, no server.

## run it
- double click `start.bat` (needs python). opens http://localhost:8765. everything works, scans too
- or open `index.html`. works, but scan reading (ocr) needs http, so use start.bat for that

## download (windows)
get **GPA-Planner-Setup-1.2.0.exe** (8 MB) from the [latest release](https://github.com/yetolegen/gpa-planner/releases/latest). run it. done.

- installs for your user only, no admin needed
- a small widget card sits on your desktop, like a weather widget: GPA, CGPA plan, and per course what you need. drag it where you want. it starts with windows
- tray icon opens the full planner
- small because it uses the Edge WebView2 that Windows 11 already has (Windows 10: get it from microsoft)
- windows may warn "unknown publisher" because the app is not code signed. click More info, then Run anyway
- data stays on your device. use Backup / Restore to move it

build it yourself (needs NSIS: `winget install NSIS.NSIS`):
```
powershell -File win/build.ps1
```
the installer lands in `win/dist`.

## what it does
- type grades as you get them. every empty box shows the score you need for your goal grade
- goal grade per course. bar shows secured points, points still possible, goal line
- gpa if you hit goals, best possible, now, if you improve
- cgpa planner: target, terms per year, retakes, what each term must average
- any grading scale: us 4.0, plain a-f, kazakhstan / aitu, or your own table
- `Ctrl K` command search. auto / light / dark
- all local. nothing leaves your device

## import
**syllabus**: pdf, word, text, or a photo/scan (png jpg webp). finds the grading table and the letter scale. you check the draft before the course is made
- scans and photos: text read on your device with bundled tesseract. pick the language (english, russian, kazakh)

**moodle grades, paste**: drag the "Grab Moodle grades" bookmark to your bar, open Grades > User report, click it, paste. or copy the table and paste

## your data
- saved in your browser (localStorage). Backup copies or downloads it. old artifact backups import fine

## limits
- syllabus reading is a guess. always check the draft table
- ocr is slower on big scans. sharp scans read best
- bundled libs in `vendor/` (see `vendor/README.md`)

## test
`npm test` (node 20+, no packages)
