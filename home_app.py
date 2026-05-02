import streamlit as st

st.title("Formula 1 Data Hub")
st.markdown("Welcome to the ultimate engineering workstation for Formula 1 data. Select a module below to get started.")
st.divider()

col1, div1, col2, div2, col3 = st.columns([3, 0.5, 3, 0.5, 3])

with col1:
    st.markdown("<h3 style='text-align: center'>Historical Analysis</h3>", unsafe_allow_html=True)
    st.markdown("""
    Dive deep into past race data using FastF1 telemetry.
    - **Track & Laps:** 2D track maps based on GPS data.
    - **Tyre Strategies:** Analyze stint lengths and compounds.
    - **Lap Comparisons:** Head-to-head telemetry analysis.
    - **3D Replays:** Launch localized 3D simulations.
    """)
    st.markdown("<br><br>", unsafe_allow_html=True)
    if st.button("Launch Historical Analysis"):
        st.switch_page("app.py")

with div1:
    st.markdown("<div class='vertical-line'></div>", unsafe_allow_html=True)

with col2:
    st.markdown("<h3 style='text-align: center'>Live Race Tracker</h3>", unsafe_allow_html=True)
    st.markdown("""
    Real-time streaming dashboard for active race weekends powered by OpenF1.
    - **Live Weather:** Track temps, wind, and rainfall.
    - **Live Leaderboard:** Real-time positions and tyre data.
    - **Live Track Maps:** 2D footprints and 3D elevation profiles of the current cars on track.
    """)
    st.markdown("<br><br>", unsafe_allow_html=True)
    if st.button("Launch Live Race Tracker"):
        st.switch_page("live_app.py")

with div2:
    st.markdown("<div class='vertical-line'></div>", unsafe_allow_html=True)

with col3:
    st.markdown("<h3 style='text-align: center'>Strategy Predictions</h3>", unsafe_allow_html=True)
    st.markdown("""
    Predict optimal race strategies based on historical data.
    - **Past Winners:** Analyze strategies from previous years.
    - **Stint Predictions:** Estimate optimal pit windows.
    - **Compound Analysis:** See what tyre choices yield the best results on specific tracks.
    """)
    st.markdown("<br><br>", unsafe_allow_html=True)
    if st.button("Launch Strategy Predictions"):
        st.switch_page("predictions_app.py")

st.divider()
st.markdown("<p style='text-align: center; color: gray;'>Powered by FastF1, OpenF1, and Streamlit.</p>", unsafe_allow_html=True)
