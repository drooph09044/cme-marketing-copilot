
Previewing README.md
EXL CDP Unified App
Single-repo React + Flask application that combines:

the EXL CDP Identity Resolution experience
the EXL AI Copilot activation workspace inside Activation
Run locally
Windows quick start
After cloning or pulling the repository on a Windows machine:

Run setup.bat
Run start.bat
Open http://127.0.0.1:5173/
setup.bat creates .venv, installs backend Python packages, and installs frontend npm packages. start.bat launches the Flask backend on port 5001 and the Vite frontend on port 5173.

Prerequisites: Python 3.10+ and Node.js 20+ available on PATH.

Manual start
Install frontend packages: npm install
Install backend packages: python -m pip install -r backend/requirements.txt
Start the Flask backend: npm run server
In a second terminal, start the frontend: npm run dev
Or start both together with:

npm run dev:full

The frontend proxies /api requests to http://127.0.0.1:5001.

Deploy to Databricks Apps
Deploy this project directory as the Databricks App source root. The deployed root must contain app.yaml, app.py, backend/, dist/, and legacy_idres/. If the application log starts with Serving Flask app 'legacy_idres_backend_app', the App is using an older manually configured command or the parent folder. A deployment using this project's app.yaml starts gunicorn app:app.

The App must have a SQL warehouse resource named sql_warehouse. app.yaml maps that resource to DATABRICKS_WAREHOUSE_ID; Node.js and npm are not needed in the Databricks runtime because the compiled dist/ bundle is deployed with the Python application.

After deployment, open:

/api/runtime/uc-health?source=media

The response checks the configured catalog (cmegtmdev), the marketing_sources and marketing_cdp schemas, and the exact source and identity-resolution tables. A 503 response includes the warehouse, permission, or table-access error without exposing credentials or table data.

The Databricks App service principal needs:

CAN USE on the bound SQL warehouse
USE CATALOG on cmegtmdev
USE SCHEMA and SELECT on cmegtmdev.marketing_sources
USE SCHEMA and SELECT on cmegtmdev.marketing_cdp
