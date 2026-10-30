# Clinic Wait Time

A lightweight web app that shows patients a clinic's current estimated wait time, with a staff dashboard to keep it accurate.

## What it does

**Patient view** (`index.html`)
- Shows the current estimated wait and how many people are in the queue, with no account or login
- Knows the clinic's operating hours and shows open or closed automatically
- Updates from the database without a page refresh

**Staff dashboard** (`staff.html`)
- One-tap tally buttons to add or remove patients; the wait estimate recalculates from the average minutes per patient
- Manual wait-time override for unusual days
- Force the clinic open or closed, overriding the posted hours

## Built with

- Vanilla JavaScript, HTML, and CSS, with no framework
- Supabase (Postgres) for status and configuration, with row-level security enabled
- Netlify config with a Content Security Policy and frame protection

## Accessibility

Designed to WCAG AA: every color pair is contrast-tested (documented in the stylesheet), with a skip link, screen-reader labels, and full keyboard navigation.

## Testing

`test.html` runs an in-browser test suite covering wait-time math, open/closed logic, and override behavior.

## Setup

1. Create a Supabase project and run `schema.sql` in the SQL editor
2. Add your project URL and anon key to `js/config.js`
3. Deploy the folder to Netlify, or open `index.html` locally

## Known limitations (prototype)

- The staff login is a simple client-side PIN for demonstration. A production version would use Supabase Auth so database writes are tied to real staff accounts.
- Built for a single clinic location.
