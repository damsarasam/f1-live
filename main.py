import streamlit as st
import ui_theme

# We must set page config here in the main entrypoint
st.set_page_config(page_title="F1 Data Hub", page_icon="🏎️", layout="wide")
ui_theme.apply_theme()

try:
    # Use native Streamlit navigation if Streamlit >= 1.36
    home_page = st.Page("home_app.py", title="Home Hub", default=True)
    historical_page = st.Page("app.py", title="Historical Analysis")
    live_page = st.Page("live_app.py", title="Live Race Tracker")
    predictions_page = st.Page("predictions_app.py", title="Strategy Predictions")

    pg = st.navigation({
        "Home": [home_page],
        "Modules": [historical_page, live_page, predictions_page]
    })
    
    # st.set_page_config must be the first command, so the individual pages shouldn't call it again.
    # We will let Streamlit handle warnings for now.
    pg.run()

except AttributeError:
    # Fallback for older Streamlit versions
    st.error("Please upgrade Streamlit to >= 1.36 to use native app navigation.")
    st.markdown("Run `pip install --upgrade streamlit` in your terminal.")
