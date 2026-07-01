"""
Simple interactive tester for the Risk Agent / Orchestrator.
Run this, pick a sample member from the list (or enter your own),
and see the live risk assessment. Results get saved to test_results.json
so you have proof for slide 11.
"""

import json
import os
from datetime import datetime
from orchestrator import handle_event

MEMBERS_FILE = "test_members.json"
RESULTS_FILE = "test_results.json"


def load_members():
    with open(MEMBERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_result(member, result):
    results = []
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, "r", encoding="utf-8") as f:
            try:
                results = json.load(f)
            except json.JSONDecodeError:
                results = []

    results.append({
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "member": member,
        "result": result
    })

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


def print_menu(members):
    print("\n" + "=" * 50)
    print("  Wakeel Al-Jamiya -- Agent Tester")
    print("=" * 50)
    print("  -- Risk Agent (new member) --")
    for i, m in enumerate(members, start=1):
        print(f"  [{i}] {m['name']}  (income: {m['monthly_income']}, "
              f"history: {m['payment_history']})")
    print(f"  [c] Enter a custom member (Risk Agent)")
    print("  -- Other agents --")
    print(f"  [t] Test Turn Agent (assign turn order, sample group)")
    print(f"  [y] Test Yield Agent (calculate yield, sample pool)")
    print(f"  [m] Test Mediator Agent (missed payment, sample member)")
    print(f"  [r] Show saved results so far")
    print(f"  [q] Quit")
    print("=" * 50)


def enter_custom_member():
    print("\n--- Enter custom member ---")
    name = input("Name: ").strip()
    income = input("Monthly income (SAR): ").strip()
    months = input("Months in circle before: ").strip()
    history_raw = input(
        "Payment history (comma-separated, e.g. on_time,late_3_days,missed): "
    ).strip()
    history = [h.strip() for h in history_raw.split(",") if h.strip()]

    return {
        "name": name or "Unnamed",
        "monthly_income": int(income) if income.isdigit() else 0,
        "payment_history": history,
        "months_in_circle_before": int(months) if months.isdigit() else 0
    }


def show_results():
    if not os.path.exists(RESULTS_FILE):
        print("\nNo results saved yet. Run a test first.")
        return

    with open(RESULTS_FILE, "r", encoding="utf-8") as f:
        results = json.load(f)

    print(f"\n--- {len(results)} saved test result(s) ---")
    for r in results:
        m = r["member"]
        handled_by = r["result"].get("handled_by", "?")
        res = r["result"].get("result", {})

        # Figure out a readable label depending on which agent ran
        if "name" in m:
            label = m["name"]
        elif "group" in m:
            names = [member.get("name", "?") for member in m["group"]]
            label = f"group: {', '.join(names)}"
        elif "pooled_amount" in m:
            label = f"pool: {m['pooled_amount']} SAR / {m.get('months_idle', '?')} months"
        else:
            label = "unknown"

        # Pick the most relevant summary field depending on agent type
        if handled_by == "risk_agent":
            summary = f"{res.get('risk_level', '?')} | {res.get('reason', '')}"
        elif handled_by == "turn_agent":
            order = res.get("turn_order", [])
            summary = " -> ".join(f"M{t['month']}:{t['name']}" for t in order)
        elif handled_by == "yield_agent":
            summary = f"+{res.get('yield_earned', '?')} SAR -> {res.get('new_total', '?')} SAR"
        elif handled_by == "mediator_agent":
            summary = res.get("message_to_member", "")[:60] + "..."
        else:
            summary = json.dumps(res, ensure_ascii=False)[:60]

        print(f"[{r['timestamp']}] ({handled_by}) {label} -> {summary}")


def run_test(member):
    print(f"\nRunning Risk Agent on {member['name']}...")
    event = {"event_type": "new_member", "member_data": member}
    output = handle_event(event)

    print("\n--- Result ---")
    print(json.dumps(output, ensure_ascii=False, indent=2))

    save_result(member, output)
    print(f"\n(saved to {RESULTS_FILE})")


def run_turn_test():
    sample_group = [
        {"name": "Ahmed", "salary_date": 25, "financial_goal": "buying a laptop, needs money soon"},
        {"name": "Sara", "salary_date": 1, "financial_goal": "stable savings, no urgent need"},
        {"name": "Faisal", "salary_date": 27, "financial_goal": "wedding expenses in 3 months"},
    ]
    print("\nRunning Turn Agent on sample group...")
    event = {"event_type": "assign_turns", "members": sample_group}
    output = handle_event(event)
    print("\n--- Result ---")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    save_result({"group": sample_group}, output)
    print(f"\n(saved to {RESULTS_FILE})")


def run_yield_test():
    sample_pool = {"pooled_amount": 4000, "months_idle": 3}
    print("\nRunning Yield Agent on sample pool...")
    event = {"event_type": "calculate_yield", **sample_pool}
    output = handle_event(event)
    print("\n--- Result ---")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    save_result(sample_pool, output)
    print(f"\n(saved to {RESULTS_FILE})")


def run_mediator_test():
    sample_member = {
        "name": "Ahmed", "months_in_circle_before": 6,
        "payment_history": ["on_time", "on_time", "missed"],
        "amount_due": 500
    }
    print("\nRunning Mediator Agent on sample missed payment...")
    event = {"event_type": "payment_missed", "member_data": sample_member}
    output = handle_event(event)
    print("\n--- Result ---")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    save_result(sample_member, output)
    print(f"\n(saved to {RESULTS_FILE})")


def main():
    members = load_members()

    while True:
        print_menu(members)
        choice = input("\nPick an option: ").strip().lower()

        if choice == "q":
            print("Bye!")
            break
        elif choice == "r":
            show_results()
        elif choice == "c":
            member = enter_custom_member()
            run_test(member)
        elif choice == "t":
            run_turn_test()
        elif choice == "y":
            run_yield_test()
        elif choice == "m":
            run_mediator_test()
        elif choice.isdigit() and 1 <= int(choice) <= len(members):
            member = members[int(choice) - 1]
            run_test(member)
        else:
            print("Invalid choice, try again.")


if __name__ == "__main__":
    main()