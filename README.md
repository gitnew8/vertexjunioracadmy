# Remix of Remix of Simply Report

Build a Weekly Student Report Web App with NO LOGIN or AUTHENTICATION.

APP PURPOSE:

Teachers create weekly, subject-wise progress reports for individual students.

Parents and students can only VIEW reports and DOWNLOAD them as PDF.

No user login, no password, no OTP, no sign-up.

TEACHER SIDE (WRITE ACCESS):

- Teacher can create a new weekly report.

- Input fields:

  - Coaching Name (saved once)

  - Coaching Logo upload (saved once)

  - Week selection (date range)

  - Student Name

  - Class

  - Roll Number

- Teacher can add, edit, or remove subjects dynamically (no fixed limit).

- For each subject, teacher can enter:

  - Topics Covered

  - Performance (Good / Average / Needs Improvement)

  - Homework Status (Completed / Incomplete)

  - Teacher Remarks

- Teacher can save reports and view a list of previously created reports.

REPORT ACCESS (NO LOGIN):

- Each report generates a unique, secure, read-only link.

- Example: https://appname.com/report/UNIQUECODE

- Anyone with the link can view the report.

- Viewers cannot type, edit, or modify anything.

PARENT / STUDENT SIDE (READ ONLY):

- Open report using the shared link.

- View weekly report in clean layout.

- Buttons available:

  - View PDF

  - Download PDF

- No edit, delete, or write access.

PDF GENERATION REQUIREMENTS:

- Auto-generate PDF when requested.

- PDF Header must include:

  - Coaching Logo (left aligned)

  - Coaching Name (large, bold)

  - Title: "Weekly Progress Report"

  - Week Date Range

- Student Details section:

  - Student Name

  - Class

  - Roll Number

- Subject-wise report in table format.

- Footer:

  - Teacher Name (optional)

  - Auto-generated date

  - Text: "This is a system-generated report"

SECURITY (WITHOUT LOGIN):

- Reports are read-only via unique links.

- No edit URLs exposed.

- Optional watermark on PDF (Student Name).

- Optional link expiry support.

UI REQUIREMENTS:

- Simple, clean, mobile-friendly UI.

- Large readable text for parents.

- One-click PDF generation and download.

TECH SUGGESTIONS (OPTIONAL):

- Frontend: React / Next.js

- Backend: Firebase / Supabase

- PDF: jsPDF or PDFKit

- Storage: Cloud storage for logos and PDFs

IMPORTANT:

- Absolutely NO authentication system.

- Parents and students must not be able to edit reports.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vertexjunioracadmy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9bcb3e5f-cb54-4d9d-8a2e-10c28f5febb4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
