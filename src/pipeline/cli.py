from __future__ import annotations

from pathlib import Path

import typer
from rich import print

from .config import load_config
from .orchestrator import run_pipeline

app = typer.Typer(help="Media cleaning pipeline CLI")


@app.command()
def run(config: Path = typer.Option(Path("configs/default.yaml"), help="Path to the pipeline config")):
    """Execute the full ingestion → transcription → export workflow."""
    cfg = load_config(config)
    print(f"[bold green]Running pipeline with config:[/bold green] {config}")
    run_pipeline(config)
    print("[bold green]Done[/bold green]")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
