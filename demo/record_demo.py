"""Records a captioned walkthrough of the app with Playwright.

Usage: python demo/record_demo.py [base_url]   (default http://localhost:5055)
Writes demo/joineazy-demo.webm. Expects a freshly seeded database.
"""
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5055"
OUT = Path(__file__).parent
PW = "password123"

CAPTION_JS = """(t) => {
  let el = document.getElementById('__demo_caption');
  if (!el) {
    el = document.createElement('div');
    el.id = '__demo_caption';
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;'
      + 'max-width:80%;padding:12px 22px;border-radius:12px;background:rgba(15,23,42,.88);color:#fff;'
      + 'font:600 18px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = t;
}"""


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=str(OUT / "_raw"),
            record_video_size={"width": 1280, "height": 720},
        )
        page = ctx.new_page()
        page.set_default_timeout(15000)

        def cap(text, hold=2.8):
            page.evaluate(CAPTION_JS, text)
            page.wait_for_timeout(int(hold * 1000))

        def slow_type(selector, text):
            page.click(selector)
            page.type(selector, text, delay=45)

        def login(email):
            page.goto(f"{BASE}/login")
            page.wait_for_selector("#email")
            slow_type("#email", email)
            slow_type("#password", PW)
            page.click("button:has-text('Sign in')")
            page.wait_for_load_state("networkidle")

        def logout():
            page.click("button:has-text('Log out'):visible")
            page.wait_for_selector("#email")

        # --- Intro ---
        page.goto(f"{BASE}/login")
        page.wait_for_selector("#email")
        cap("Joineazy – Student, Group & Assignment Management System", 3.5)
        cap("React + Tailwind · Node/Express · PostgreSQL · Docker · JWT auth with Student / Admin roles", 4)
        page.click("text=Create an account")
        page.wait_for_load_state("networkidle")
        cap("Students register here; professor sign-up needs an admin code, so students can't self-promote", 4)

        # --- Student without a group creates one ---
        login("isha@student.com")
        cap("Student view: Isha has no group yet, so she can't confirm submissions", 3.5)
        page.click("a:has-text(\'My Group\'):visible >> nth=0")
        page.wait_for_selector("#gname")
        cap("Students form their own groups and add members by email or student ID", 3)
        slow_type("#gname", "Team Gamma")
        page.click("button:has-text('Create group')")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
        cap("Group created – Isha is the owner and gets a shareable join code", 3.5)
        page.mouse.wheel(0, 500)
        cap("Owners can add members, approve join requests or regenerate the code", 3.5)
        page.mouse.wheel(0, -1000)
        logout()

        # --- Professor ---
        login("professor@joineazy.com")
        page.wait_for_timeout(1200)
        cap("Professor (Admin) dashboard: completion analytics and group performance", 4)
        page.mouse.wheel(0, 450)
        cap("Charts and summary counts are built from live submission data", 3.5)
        page.mouse.wheel(0, -900)
        page.click("a:has-text(\'Assignments\'):visible >> nth=0")
        page.wait_for_load_state("networkidle")
        cap("Professors create, edit and view assignments", 3)
        page.click("text=+ New assignment")
        page.wait_for_selector("#title")
        cap("New assignment: title, description, due date and OneDrive submission link", 3)
        slow_type("#title", "Final Project Presentation")
        slow_type("#desc", "Prepare a 10-minute group presentation of your final project.")
        due = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT17:00")
        page.fill("#due", due)
        slow_type("#link", "https://onedrive.live.com/final-project")
        cap("It can go to all students or to specific groups only", 3)
        page.click("button:has-text('Create assignment')")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        cap("Assignment published to every group", 2.5)
        page.goto(f"{BASE}/admin/assignments")
        page.wait_for_load_state("networkidle")
        page.click("a:has-text(\'Database Design Report\'):visible >> nth=0")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
        cap("Per-assignment tracking: which groups confirmed, who confirmed and when", 4)
        page.mouse.wheel(0, 400)
        page.wait_for_timeout(1500)
        page.mouse.wheel(0, -800)
        logout()

        # --- Student submits ---
        login("aarav@student.com")
        page.wait_for_timeout(1000)
        cap("Student view (Aarav, Team Alpha): all assigned work with status badges", 3.5)
        cap("The progress bar shows how much of the group's work is confirmed", 3)
        btn = page.locator("button:has-text('Mark as submitted')").first
        btn.scroll_into_view_if_needed()
        cap("Students upload on OneDrive first, then confirm here", 2.5)
        btn.click()
        page.wait_for_timeout(900)
        cap("Two-step verification – step 1: 'Yes, I have submitted'", 2.8)
        page.click("button:has-text('Yes, I have submitted')")
        page.wait_for_timeout(900)
        cap("Step 2: final confirmation, recorded for the whole group", 2.8)
        page.click("button:has-text('Confirm submission')")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        page.mouse.wheel(0, -2000)
        cap("Confirmed – badge and group progress update instantly", 3.5)
        page.click("a:has-text(\'My Group\'):visible >> nth=0")
        page.wait_for_load_state("networkidle")
        cap("Group page: members, join code and pending join requests", 3.5)
        logout()

        # --- Professor sees the update ---
        login("professor@joineazy.com")
        page.wait_for_timeout(1500)
        cap("Back in the admin dashboard, the new confirmation already shows in the analytics", 4)
        cap("Thanks for watching! Repo: github.com/Pragyark15/joineazy-task1", 4)

        video = page.video
        ctx.close()
        browser.close()
        dest = OUT / "joineazy-demo.webm"
        shutil.move(video.path(), dest)
        shutil.rmtree(OUT / "_raw", ignore_errors=True)
        print("saved", dest)


if __name__ == "__main__":
    run()
