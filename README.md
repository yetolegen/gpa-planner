# gpa planner

plan the grades you need for the gpa you want. free. private. no account, no server.

## run it
- double click `start.bat` (needs python). opens http://localhost:8765. everything works, scans too
- or open `index.html`. works, but scan reading (ocr) needs http, so use start.bat for that
- or load as browser extension (below). needed for moodle sync

## what it does
- type grades as you get them. every empty box shows the score you need for your goal grade
- goal grade per course. bar shows secured points, points still possible, goal line
- gpa if you hit goals, best possible, now, if you improve
- cgpa planner: target, terms per year, retakes, what each term must average
- any grading scale: us 4.0, plain a-f, kazakhstan / aitu, or your own table
- `Ctrl K` command search. auto / light / dark
- all local. nothing leaves your device except the moodle sync call you set up yourself

## import
**syllabus**: pdf, word, text, or a photo/scan (png jpg webp). finds the grading table and the letter scale. you check the draft before the course is made
- scans and photos: text read on your device with bundled tesseract. pick the language (english, russian, kazakh)

**moodle grades, paste**: drag the "Grab Moodle grades" bookmark to your bar, open Grades > User report, click it, paste. or copy the table and paste

## moodle sync
grades fill in by themselves every 15 / 30 / 60 min while the app is open.
1. in moodle: profile menu > Preferences > Security keys. copy the key for "Moodle mobile web service"
2. in the app: Moodle sync > paste moodle address + key > Connect
3. tick courses. press Sync now. done

- key stays in this browser, goes only to your moodle address, left out of backups. read only
- a normal web page cannot read moodle (browser blocks it). run as extension:
  1. chrome://extensions > developer mode > Load unpacked > pick this folder
  2. click the extension icon. app opens. first connect asks for permission to your moodle site
- some schools turn the mobile service off. no key then. use paste import
- not tested on a real moodle yet. tested on a fake one with the same answer shape

## your data
- saved in your browser (localStorage). Backup copies or downloads it. old artifact backups import fine
- Backup leaves out the moodle key

## limits
- syllabus reading is a guess. always check the draft table
- ocr is slower on big scans. sharp scans read best
- sync runs only while the app tab is open
- bundled libs in `vendor/` (see `vendor/README.md`)

## test
`npm test` (node 20+, no packages)
