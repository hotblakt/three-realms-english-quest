"""Optional Forest 2.0 smoke check against the Vite development server."""
import json
import os
from pathlib import Path
import re
import subprocess

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[3]
WORLD = "./src/forest-v3/world/index.ts"


def model():
    return json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e",
         f"import {{hardColliders}} from '{WORLD}'; console.log(JSON.stringify(hardColliders));"],
        cwd=ROOT, text=True,
    ))


def check_scene(browser, base, renderer, expected):
    page = browser.new_page(
        viewport={"width": 852, "height": 393}, is_mobile=True, has_touch=True,
        reduced_motion="reduce",
    )

    def expose_scene(route):
        response = route.fetch()
        source, count = re.subn(r"postBoot:\s*\(?game\)?\s*=>\s*\{",
                                r"\g<0> window.__forestGeometryTest = game;", response.text())
        assert count == 1
        route.fulfill(response=response, body=source)

    page.route("**/forest-batch-b-preview/boot.ts*", expose_scene)
    page.goto(f"{base}/forest-preview/?renderer={renderer}")
    page.wait_for_function(
        "() => document.querySelector('#startup-state')?.textContent.includes('風靈地標已啟用')"
    )
    actual = page.evaluate("""() => {
        const scene = window.__forestGeometryTest.scene.getScene('misty-forest');
        return scene.obstacles.getChildren().map(({body}) => ({
          left: body.x, right: body.right, top: body.y, bottom: body.bottom
        }));
    }""")
    keys = ("left", "right", "top", "bottom")
    def project(entries):
        return {tuple(round(item[key], 6) for key in keys) for item in entries}

    observed, planned = project(actual), project(expected)
    assert len(actual) == len(expected) and observed == planned, (
        f"Static collider inventory differs ({len(actual)} vs {len(expected)}). "
        f"Observed only: {sorted(observed - planned)[:8]}. "
        f"Planned only: {sorted(planned - observed)[:8]}."
    )

    def place_player(x, y):
        page.evaluate("""([x, y]) => {
            const p = window.__forestGeometryTest.scene.getScene('misty-forest').player;
            p.body.reset(x, y);
            p.syncView();
        }""", [x, y])

    def walk(key, predicate):
        page.keyboard.down(key)
        try:
            page.wait_for_function(f"""() => {{
                const {{x, y}} = window.__forestGeometryTest.scene.getScene('misty-forest').player.body.center;
                return {predicate};
            }}""", timeout=5000)
        finally:
            page.keyboard.up(key)

    place_player(622, 451)
    walk("ArrowRight", "x >= 728 && Math.abs(y - 451) < 1")
    walk("ArrowLeft", "x <= 622 && Math.abs(y - 451) < 1")
    place_player(1085, 260)
    walk("e", "x === 477 && y === 766")
    page.close()
    print(f"{renderer}: {len(actual)} colliders, bridge both ways and east return passed")


if __name__ == "__main__":
    base_url = os.environ.get("FOREST_BASE_URL", "http://127.0.0.1:3000")
    with sync_playwright() as playwright:
        with playwright.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH"),
            args=["--no-sandbox", "--enable-unsafe-swiftshader"],
        ) as chromium:
            expected_colliders = model()
            for renderer_name in ("canvas", "webgl"):
                check_scene(chromium, base_url, renderer_name, expected_colliders)
