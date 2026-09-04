import os
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(PROJECT_ROOT) in sys.path:
    sys.path.remove(str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_ROOT) in sys.path:
    sys.path.remove(str(BACKEND_ROOT))
sys.path.insert(1, str(BACKEND_ROOT))
for module_name in list(sys.modules):
    if module_name == "services" or module_name.startswith("services."):
        del sys.modules[module_name]
os.environ.setdefault("CODEX_DATA_SOURCE", "local")

from app import app


RUN_GLOBALS = app.view_functions["run_all"].__globals__
RUN_STATUS = RUN_GLOBALS["_run_status"]
RUN_LOCK = RUN_GLOBALS["_enhanced_pipeline_lock"]


def _successful_step(step, source_system=None):
    return subprocess.CompletedProcess(
        args=[step.get("script", "")],
        returncode=0,
        stdout=f"{source_system or 'default'} complete\n",
        stderr="",
    )


class PipelineApiContractTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()
        with RUN_LOCK:
            RUN_STATUS.clear()

    def _wait_for_status(self, path, expected="done", attempts=200):
        last_payload = None
        for _attempt in range(attempts):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
            last_payload = response.get_json()
            if last_payload.get("status") in {"done", "error"}:
                break
            time.sleep(0.01)
        self.assertIsNotNone(last_payload)
        self.assertEqual(last_payload.get("status"), expected, last_payload)
        return last_payload

    def test_uc_pipeline_status_polling_never_checks_table_paths(self):
        with (
            patch.dict(os.environ, {"CODEX_DATA_SOURCE": "uc"}),
            patch.object(Path, "exists", side_effect=AssertionError("Path.exists must not run")),
        ):
            response = self.client.get("/api/pipeline/steps")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload)
        self.assertTrue(all(step["run_status"] == "idle" for step in payload))
        self.assertTrue(all(step["outputs_ready"] is False for step in payload))

    def test_full_pipeline_is_run_specific_for_every_supported_domain(self):
        for source in ("media", "sports", "automotive", "telecom"):
            with self.subTest(source=source):
                with RUN_LOCK:
                    RUN_STATUS.clear()
                calls = []

                def successful_step(step, source_system=None):
                    calls.append((step["id"], source_system))
                    return _successful_step(step, source_system)

                with (
                    patch.dict(os.environ, {"CODEX_DATA_SOURCE": "local"}),
                    patch.dict(
                        RUN_GLOBALS,
                        {
                            "_run_pipeline_step_script": successful_step,
                            "_build_customer_profile_rows": lambda source=None: [],
                            "_write_customer_profile_export": (
                                lambda _rows, source=None: RUN_GLOBALS["ROOT"]
                                / "customer_profile_export.csv"
                            ),
                            "_rebuild_activity_detail_fields": lambda: 0,
                            "_invalidate_reporting_caches": lambda _source=None: None,
                        },
                    ),
                ):
                    response = self.client.post(
                        "/api/pipeline/run-all",
                        json={"source_system": source},
                    )
                    self.assertEqual(response.status_code, 202, response.get_data(as_text=True))
                    started = response.get_json()
                    self.assertEqual(started["source_system"], source)
                    self.assertTrue(started["run_id"])
                    status = self._wait_for_status(
                        f"/api/pipeline/runs/{started['run_id']}"
                    )

                self.assertTrue(status["steps"])
                self.assertTrue(all(step["status"] == "done" for step in status["steps"]))
                self.assertEqual(
                    calls,
                    [
                        (step["id"], source)
                        for step in RUN_GLOBALS["PIPELINE_STEPS"]
                    ],
                )

    def test_enhanced_media_and_sports_runs_are_run_specific(self):
        for source in ("media", "sports"):
            with self.subTest(source=source):
                with RUN_LOCK:
                    RUN_STATUS.clear()
                with (
                    patch.object(
                        RUN_GLOBALS["subprocess"],
                        "run",
                        return_value=subprocess.CompletedProcess(
                            args=[],
                            returncode=0,
                            stdout="complete\n",
                            stderr="",
                        ),
                    ),
                    patch.dict(
                        RUN_GLOBALS,
                        {"_invalidate_reporting_caches": lambda _source=None: None},
                    ),
                ):
                    response = self.client.post(
                        "/api/enhanced-identity/run",
                        json={"source_system": source},
                    )
                    self.assertEqual(response.status_code, 202, response.get_data(as_text=True))
                    started = response.get_json()
                    status = self._wait_for_status(
                        f"/api/enhanced-identity/run/{started['run_id']}"
                    )

                self.assertEqual(status["source_system"], source)
                self.assertEqual(len(status["steps"]), 4)
                self.assertTrue(all(step["status"] == "done" for step in status["steps"]))

    def test_pipeline_failure_marks_remaining_steps_and_finishes_polling(self):
        call_count = 0

        def failed_second_step(step, source_system=None):
            nonlocal call_count
            call_count += 1
            return subprocess.CompletedProcess(
                args=[],
                returncode=1 if call_count == 2 else 0,
                stdout="",
                stderr="controlled failure" if call_count == 2 else "",
            )

        with (
            patch.dict(
                RUN_GLOBALS,
                {
                    "_run_pipeline_step_script": failed_second_step,
                    "_invalidate_reporting_caches": lambda _source=None: None,
                },
            ),
        ):
            response = self.client.post(
                "/api/pipeline/run-all",
                json={"source_system": "automotive"},
            )
            self.assertEqual(response.status_code, 202)
            run_id = response.get_json()["run_id"]
            status = self._wait_for_status(
                f"/api/pipeline/runs/{run_id}",
                expected="error",
            )

        self.assertEqual(call_count, 2)
        self.assertEqual(status["steps"][1]["status"], "error")
        self.assertTrue(
            all(step["status"] == "error" for step in status["steps"][1:])
        )


if __name__ == "__main__":
    unittest.main()
