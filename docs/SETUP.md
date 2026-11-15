
# AgroShift Gambia — Setup Guide

## 1. Project Overview

AgroShift Gambia is an agricultural decision-support project.

It uses a decision engine, farmer-provided information and cached environmental evidence to generate field-level agricultural strategy recommendations.

This guide explains how to install, configure and run the backend API locally.

## 2. Requirements

Install the following:

- Python 3.12
- Git
- Visual Studio Code (recommended)

## 3. Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/Ousman445/agroshift-gambia.git
cd agroshift-gambia
```

If you already have the repository, open its project directory instead.

## 4. Create a Virtual Environment

### Linux (Ubuntu)

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

### Windows (PowerShell)

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
```

## 5. Install Dependencies

With the virtual environment activated, run:

```bash
python -m pip install -r requirements.txt
```

## 6. Run the API

From the project root directory, run:

```bash
python -m uvicorn app.main:app --reload
```

The API will run locally at:

http://127.0.0.1:8000

Keep the terminal running while testing the API.

## 7. Test the API

Open these addresses in a browser:

- http://127.0.0.1:8000/ — API home
- http://127.0.0.1:8000/health — Health check
- http://127.0.0.1:8000/api/v2/fields/field-001 — Demonstration field data
- http://127.0.0.1:8000/api/v2/engine — Engine information
- http://127.0.0.1:8000/docs — Interactive API documentation

### Test Environmental Evidence

In a second terminal, activate the virtual environment and run:

```bash
curl -s http://127.0.0.1:8000/api/v2/evidence/field-001 | python -m json.tool
```

The pilot cache is located at:

`pipeline/cache/field-001.json`

The endpoint returns the cached environmental evidence for the matching field.

### Test Strategy Generation

Run:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v2/strategies \
  -H "Content-Type: application/json" \
  -d '{"field_id":"field-001"}' | python -m json.tool
```

The response contains three agricultural strategies and an environmental evidence summary.

The environmental evidence summary is contextual metadata. It is not currently used to calculate strategy scores.

## 8. Stop the API

Press `CTRL + C` in the terminal running the API.

## 9. Important Notes

- Activate the virtual environment before running the API.
- Run commands from the project root directory.
- The current field data is demonstration data, not validated agricultural measurements.
- The environmental evidence represents the Manduar pilot location and is not a complete farm survey.
- Do not interpret missing values as zero.
- The application uses cached environmental evidence rather than live NASA requests during user interactions.
- Satellite-derived and modelled datasets must not be presented as direct farm measurements.
- Sentinel-2 evidence remains provisional and is excluded from engine scoring and recommendations.
- Agricultural recommendations require review by farmers and local agricultural experts.
