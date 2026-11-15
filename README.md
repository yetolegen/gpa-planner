# gpa planner

Plan the grades you need for the GPA you want. Free. Private. Runs in your browser. No account, no server.

Open `index.html`. That is it. Or host the folder anywhere (GitHub Pages, Netlify).

## what it does
- type grades as you get them. every empty box shows the score you need for your goal grade
- pick a goal grade per course. meter shows secured points, points still possible, goal line
- GPA if you hit goals, best possible, current pace, improved pace
- CGPA planner: target, terms per year, retakes, what each term must average
- works with any grading scale: US 4.0, plain A-F, Kazakhstan / AITU, or your own table
- `Ctrl K` command search: jump to a course or run any action. auto / light / dark theme
- all local: no server, no tracking, Inter font bundled in `fonts/` (OFL license)

## import
**syllabus** (PDF, Word .docx, or pasted text)
- finds the grading table (weights that add to 100%) and the letter scale if the file has one
- you review and fix a draft before the course is made
- read in your browser. nothing is uploaded

**Moodle grades**
- Moodle blocks other sites from reading it, and a page should never ask for your password. so no direct fetch
- instead: drag the "Grab Moodle grades" bookmark to your bookmarks bar. open Grades > User report in Moodle, click it, paste here
- or just select the grades table on the Moodle page, copy, paste here
- grades fill into an existing course by item name, or make a new course

## your data
- saved in your browser (localStorage). use Backup to copy or download it
- old backups from the GPA Planner artifact import fine

## limits
- syllabus reading is heuristic. always check the draft table
- scanned PDFs (pictures of text) can not be read, no OCR
- PDF and Word reading load a library from a CDN, so they need internet once
- Moodle bookmark is best effort. themes differ. paste works anywhere

## test
`npm test` (Node 20+, no packages)
