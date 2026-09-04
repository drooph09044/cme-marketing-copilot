# deploy/

Databricks Apps deployment scaffold.

## Layout

```
deploy/
├── README.md          # this file
├── app.yaml.tmpl      # Databricks App manifest template (committed)
└── build/             # generated bundle (gitignored; created by deploy script)
    ├── app/           # FastAPI package copied from apps/api/app/
    ├── static/        # Next.js static export copied from apps/web/out/
    ├── examples/      # segments + journey.json copied from examples/
    ├── requirements.txt
    └── app.yaml       # rendered from app.yaml.tmpl with the app name
```

## How to use

From the repo root:

```bash
./scripts/deploy-databricks.sh                  # full build + deploy
./scripts/deploy-databricks.sh --bundle-only    # build deploy/build/ but don't push
./scripts/deploy-databricks.sh --app-name foo   # use a different app slug
./scripts/deploy-databricks.sh --skip-frontend  # reuse existing apps/web/out
```

See [`docs/databricks-apps-deployment.md`](../docs/databricks-apps-deployment.md)
for the full walkthrough (prerequisites, one-time app creation, permissions
grants, troubleshooting).
