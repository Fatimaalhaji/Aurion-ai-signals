"""Smoke tests for the runnable application scaffold."""

import os
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_OUTPUT = "Aurion AI Signals scaffold is running."


class ApplicationSmokeTest(unittest.TestCase):
    """Smoke tests for the application entry point."""

    def test_application_entry_point_outputs_placeholder_text(self) -> None:
        """The entry point exits successfully and prints the scaffold text."""
        env = os.environ.copy()
        env["PYTHONPATH"] = str(ROOT / "src")

        result = subprocess.run(
            [sys.executable, "-m", "aurion_ai_signals"],
            cwd=ROOT,
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), EXPECTED_OUTPUT)
        self.assertEqual(result.stderr, "")


if __name__ == "__main__":
    unittest.main()
