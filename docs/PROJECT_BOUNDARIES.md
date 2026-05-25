# Project Boundaries

This workspace is the **radial control design** project.

## 1. Radial Control Design

- **GitHub:** https://github.com/Mikeishiring/radial-dial
- **Local workspace:** `C:\Users\micha\Projects\radial-dial`
- **Package:** `@mikeishiring/radial-dial`
- **Purpose:** Improve the radial option control as a reusable React component: interaction feel, option layout, visual hints, gesture logic, polish, API shape, documentation, and the example product lab.
- **Work that belongs here:**
  - Radial/menu/dial gesture mechanics.
  - Option preview, commit, backtrack, reset, keyboard, touch, and reduced-motion behavior.
  - Visual design and motion for the dial itself.
  - Example app scenarios that prove the dial as a tool.
  - Public library API and package docs.
- **Work that does not belong here:**
  - Job-board ranking product logic.
  - Candidate/personality sorting logic.
  - Shape Rotator onboarding flows beyond demo data needed to test the dial.
  - Web3 Jobs production data, Supabase, Cloudflare, or host-app routes.

## 2. Sorting Hat / Ranking

- **Current known local workspace:** `C:\Projects\web3-jobs-rank-sort`
- **Current known GitHub remote from that workspace:** https://github.com/Mikeishiring/Web3jobsandcompanies
- **Purpose:** Sorting, ranking, matching, and job/company intelligence logic.
- **Boundary rule:** Do not add Sorting Hat product logic to `radial-dial`. If the radial control needs sorting-hat-like data, use mock data in `example/` only, and keep it labeled as demo data.
- **Open question:** If there is a more specific Sorting Hat repository, use that repo instead of `Web3jobsandcompanies` once identified.

## 3. Onboarding

- **GitHub:** https://github.com/Mikeishiring/Shape-onboarding
- **Purpose:** Shape Rotator onboarding and routing instrument demos.
- **Boundary rule:** Do not build onboarding product flows in `radial-dial`. If an onboarding scenario is useful for proving the dial, keep it inside the radial demo as a small fixture or example, not as the product source of truth.
- **Local workspace:** Not found during the latest audit. Clone or locate it before making onboarding changes.

## Operating Rules

- Keep branches, issues, and PRs scoped to one project at a time.
- If a task mentions more than one project, start by naming the target repo and the boundary.
- Do not move code between these projects without an explicit request.
- Prefer mock fixtures in `radial-dial/example` when testing how the dial would support another product.
- Keep production product data and host-app implementation out of the reusable component library.
