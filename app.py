import streamlit as st
import json
import os
from orchestrator import handle_event

st.set_page_config(
    page_title="JamiyaTech — Agent Tester",
    page_icon="🏦",
    layout="wide"
)

# Header
st.markdown("""
    <h1 style='text-align: center; color: #032341;'>🏦 جمعية تيك</h1>
    <h3 style='text-align: center; color: #666;'>Multi-Agent System — Live Demo</h3>
    <hr>
""", unsafe_allow_html=True)

# Sidebar - choose agent
st.sidebar.title("اختر الوكيل")
agent = st.sidebar.radio("", [
    "🔴 Risk Agent — فحص المخاطر",
    "🔄 Turn Agent — ترتيب الأدوار",
    "💰 Yield Agent — حساب العائد",
    "🤝 Mediator Agent — حل النزاعات",
])

st.sidebar.markdown("---")
st.sidebar.markdown("**Powered by:** Groq + Llama 3.3 70B")
st.sidebar.markdown("**Framework:** LangChain Orchestrator Pattern")

# ─── Risk Agent ───────────────────────────────────────────────
if "Risk Agent" in agent:
    st.subheader("🔴 Risk Agent — فحص مخاطر العضو")
    st.markdown("أدخل بيانات العضو وسيقوم الوكيل بتقييم مخاطر التعثر فوراً.")

    col1, col2 = st.columns(2)
    with col1:
        name = st.text_input("اسم العضو", value="Ahmed")
        income = st.number_input("الدخل الشهري (ريال)", value=8000, step=500)
    with col2:
        months = st.number_input("عدد أشهر المشاركة السابقة", value=6, step=1)
        history_options = st.multiselect(
            "سجل المدفوعات",
            ["on_time", "late_3_days", "late_5_days", "late_10_days", "missed"],
            default=["on_time", "on_time", "late_3_days", "on_time"]
        )

    if st.button("🚀 تشغيل Risk Agent", use_container_width=True):
        with st.spinner("جاري تحليل بيانات العضو..."):
            member_data = {
                "name": name,
                "monthly_income": income,
                "payment_history": history_options,
                "months_in_circle_before": months
            }
            result = handle_event({"event_type": "new_member", "member_data": member_data})
            risk = result["result"]

        risk_level = risk.get("risk_level", "")
        reason = risk.get("reason", "")

        color = {"green": "#1E8449", "yellow": "#F39C12", "red": "#C0392B"}.get(risk_level, "#666")
        label = {"green": "✅ أخضر — منخفض المخاطر", "yellow": "⚠️ أصفر — متوسط المخاطر", "red": "🚨 أحمر — عالي المخاطر"}.get(risk_level, risk_level)

        st.markdown(f"""
        <div style='background:{color}; padding:20px; border-radius:12px; text-align:center; margin:20px 0;'>
            <h2 style='color:white; margin:0;'>{label}</h2>
        </div>
        """, unsafe_allow_html=True)

        st.markdown(f"**السبب:** {reason}")
        with st.expander("عرض البيانات الكاملة (JSON)"):
            st.json(result)

# ─── Turn Agent ───────────────────────────────────────────────
elif "Turn Agent" in agent:
    st.subheader("🔄 Turn Agent — ترتيب أدوار الجمعية")
    st.markdown("أضف أعضاء الجمعية وسيقوم الوكيل بتحديد الترتيب الأمثل.")

    st.markdown("**أعضاء الجمعية (نموذج تجريبي):**")
    members = [
        {"name": "Ahmed", "salary_date": 25, "financial_goal": "شراء لابتوب، يحتاج المال بسرعة"},
        {"name": "Sara", "salary_date": 1, "financial_goal": "ادخار مستقر، لا حاجة ملحّة"},
        {"name": "Faisal", "salary_date": 27, "financial_goal": "مصاريف زفاف خلال 3 أشهر"},
        {"name": "Noura", "salary_date": 15, "financial_goal": "سداد دين عائلي"},
    ]

    for m in members:
        st.markdown(f"- **{m['name']}** — يوم الراتب: {m['salary_date']} | الهدف: {m['financial_goal']}")

    if st.button("🚀 تشغيل Turn Agent", use_container_width=True):
        with st.spinner("جاري حساب الترتيب الأمثل..."):
            result = handle_event({"event_type": "assign_turns", "members": members})
            turn_order = result["result"]["turn_order"]

        st.markdown("### 📋 ترتيب الأدوار")
        for t in turn_order:
            st.markdown(f"""
            <div style='background:#1a1a2e; padding:16px 20px; border-right:6px solid #E8A838; margin:10px 0; border-radius:8px; display:flex; align-items:center;'>
                <span style='color:#E8A838; font-size:22px; font-weight:bold; min-width:120px;'>الشهر {t['month']}</span>
                <span style='color:#FFFFFF; font-size:18px; font-weight:bold; min-width:140px; margin:0 20px;'>{t['name']}</span>
                <span style='color:#AAAAAA; font-size:15px;'>{t.get('reason','')}</span>
            </div>
            """, unsafe_allow_html=True)

        with st.expander("عرض البيانات الكاملة (JSON)"):
            st.json(result)

# ─── Yield Agent ──────────────────────────────────────────────
elif "Yield Agent" in agent:
    st.subheader("💰 Yield Agent — حساب العائد على الأموال الخاملة")
    st.markdown("أدخل المبلغ المتجمع وعدد الأشهر لحساب العائد المتوقع.")

    col1, col2 = st.columns(2)
    with col1:
        amount = st.number_input("المبلغ المتجمع (ريال)", value=4000, step=500)
    with col2:
        months_idle = st.number_input("عدد الأشهر الخاملة", value=3, step=1)

    if st.button("🚀 تشغيل Yield Agent", use_container_width=True):
        with st.spinner("جاري حساب العائد..."):
            result = handle_event({
                "event_type": "calculate_yield",
                "pooled_amount": amount,
                "months_idle": months_idle
            })
            yield_data = result["result"]

        col1, col2, col3 = st.columns(3)
        col1.metric("المبلغ الأصلي", f"{amount:,.0f} ريال")
        col2.metric("العائد المكتسب", f"+{yield_data['yield_earned']:,.2f} ريال", delta=f"+{yield_data['yield_earned']:,.2f}")
        col3.metric("المجموع الجديد", f"{yield_data['new_total']:,.2f} ريال")

        st.info(f"💬 {yield_data.get('explanation', '')}")

        with st.expander("عرض البيانات الكاملة (JSON)"):
            st.json(result)

# ─── Mediator Agent ───────────────────────────────────────────
elif "Mediator Agent" in agent:
    st.subheader("🤝 Mediator Agent — حل نزاع التعثر")
    st.markdown("أدخل بيانات العضو المتعثر وسيقوم الوكيل بصياغة رسالة وخيارات حل.")

    col1, col2 = st.columns(2)
    with col1:
        name = st.text_input("اسم العضو", value="Ahmed")
        amount_due = st.number_input("المبلغ المستحق (ريال)", value=500, step=100)
    with col2:
        months_prev = st.number_input("أشهر المشاركة السابقة", value=6, step=1)
        history = st.multiselect(
            "سجل المدفوعات",
            ["on_time", "late_3_days", "missed"],
            default=["on_time", "on_time", "missed"]
        )

    if st.button("🚀 تشغيل Mediator Agent", use_container_width=True):
        with st.spinner("جاري صياغة الرسالة وخيارات الحل..."):
            member_data = {
                "name": name,
                "months_in_circle_before": months_prev,
                "payment_history": history,
                "amount_due": amount_due
            }
            result = handle_event({"event_type": "payment_missed", "member_data": member_data})
            med = result["result"]

        st.markdown("### 💬 الرسالة المرسلة للعضو")
        st.info(med.get("message_to_member", ""))

        st.markdown("### 🔄 خيارات إعادة الجدولة")
        for i, opt in enumerate(med.get("restructuring_options", []), 1):
            st.markdown(f"""
            <div style='background:#1a1a2e; padding:16px 20px; border-right:6px solid #E8A838; margin:10px 0; border-radius:8px;'>
                <span style='color:#E8A838; font-size:16px; font-weight:bold;'>الخيار {i}:</span>
                <span style='color:#FFFFFF; font-size:15px; margin-right:10px;'>{opt}</span>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("### 📄 مسودة العقد")
        st.warning(med.get("draft_contract_note", ""))

        with st.expander("عرض البيانات الكاملة (JSON)"):
            st.json(result)

# Footer
st.markdown("---")
st.markdown("<p style='text-align:center; color:#aaa;'>JamiyaTech © 2026 | Amad Hackathon | Alinma × Tuwaiq Academy</p>", unsafe_allow_html=True)