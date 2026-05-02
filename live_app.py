import streamlit as st
import datetime

try:
    import requests
    import pandas as pd
    import plotly.express as px
    import plotly.graph_objects as go
    from streamlit_autorefresh import st_autorefresh
except ImportError as e:
    st.error(f"Missing dependency: {e}")
    st.warning("🚨 **You are running Streamlit outside of the virtual environment!**\n\nPlease stop the terminal (Ctrl+C) and restart the app with:\n\n`source venv/bin/activate && streamlit run main.py`")
    st.stop()

# Page Config
st.set_page_config(page_title="🚨 LIVE F1 Dashboard", layout="wide", initial_sidebar_state="collapsed")
count = st_autorefresh(interval=5000, limit=None, key="f1_autorefresh")

st.title("🚨 Live Formula 1 Tracker")
st.markdown("Real-time data powered by the OpenF1 API")

BASE_URL = "https://api.openf1.org/v1"

@st.cache_data(ttl=60*5)
def get_driver_info(session_key):
    try:
        r = requests.get(f"{BASE_URL}/drivers?session_key={session_key}")
        if r.status_code == 200:
            df = pd.DataFrame(r.json())
            return df
    except Exception as e:
        return pd.DataFrame()

def get_latest_session():
    try:
        r = requests.get(f"{BASE_URL}/sessions")
        if r.status_code == 200:
            return r.json()[-1], None
        else:
            # Handle OpenF1's live restriction message
            err = r.json().get('detail', f'HTTP Error {r.status_code}')
            return None, err
    except Exception as e:
        return None, str(e)

def fetch_openf1(endpoint, session_key):
    try:
        r = requests.get(f"{BASE_URL}/{endpoint}?session_key={session_key}")
        if r.status_code == 200 and r.json():
            df = pd.DataFrame(r.json())
            return df.sort_values(by='date').drop_duplicates(subset=['driver_number'], keep='last') if 'driver_number' in df else df
    except:
        pass
    return pd.DataFrame()

# --- Main Dashboard Logic ---
latest_session, api_error = get_latest_session()

if api_error:
    st.error(f"📡 API Access Restricted: {api_error}")
    st.info("The OpenF1 free tier disables global access during live race sessions. You must provide an API key or wait until the session ends.")
    st.stop()
    
if not latest_session:
    st.warning("Could not find any recent sessions.")
    st.stop()

session_key = latest_session['session_key']
st.subheader(f"{latest_session.get('country_name', 'Unknown')} - {latest_session.get('session_name', 'Session')} (ID: {session_key})")

with st.spinner("Syncing OpenF1 data..."):
    drivers_df = get_driver_info(session_key)
    positions_df = fetch_openf1("position", session_key)
    locations_df = fetch_openf1("location", session_key)
    stints_df = fetch_openf1("stints", session_key)
    laps_df = fetch_openf1("laps", session_key)
    
    # Weather is global, not per driver
    weather_df = pd.DataFrame()
    try:
        wr = requests.get(f"{BASE_URL}/weather?session_key={session_key}")
        if wr.status_code == 200 and wr.json():
            weather_df = pd.DataFrame(wr.json()).sort_values(by='date').tail(1)
    except:
        pass

# --- WEATHER METRICS ---
st.markdown("### 🌤️ Live Track Weather Report")
w_data = weather_df.iloc[0] if not weather_df.empty else {}
m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Air Temp", f"{w_data.get('air_temperature', '--')} °C")
m2.metric("Track Temp", f"{w_data.get('track_temperature', '--')} °C")
m3.metric("Humidity", f"{w_data.get('humidity', '--')} %")
m4.metric("Wind Speed", f"{w_data.get('wind_speed', '--')} m/s")
rainfall_val = w_data.get('rainfall', None)
rainfall = "Yes" if str(rainfall_val) == "1" else ("No" if str(rainfall_val) == "0" else "--")
m5.metric("Rainfall", rainfall)
st.divider()

col1, col2 = st.columns([1.2, 1])

with col1:
    st.markdown("### 🏆 Live Leaderboard")
    if not positions_df.empty and not drivers_df.empty:
        # Merge all data
        df = pd.merge(positions_df, drivers_df, on='driver_number', how='left')
        
        if not stints_df.empty:
            df = pd.merge(df, stints_df[['driver_number', 'compound']], on='driver_number', how='left')
        else:
            df['compound'] = "--"
            
        if not laps_df.empty:
            df = pd.merge(df, laps_df[['driver_number', 'lap_duration']], on='driver_number', how='left')
        else:
            df['lap_duration'] = "--"
            
        display_df = df.copy()
        display_df['Driver'] = display_df['name_acronym'] + " (" + display_df['first_name'] + " " + display_df['last_name'] + ")"
        
        display_df = display_df.sort_values(by='position')
        
        show_cols = ['position', 'driver_number', 'Driver', 'team_name', 'compound', 'lap_duration']
        renames = {'position': 'Pos', 'driver_number': 'No', 'team_name': 'Team', 'compound': 'Tyre', 'lap_duration': 'Last Lap (s)'}
        
        final_table = display_df[[c for c in show_cols if c in display_df.columns]].rename(columns=renames)
        final_table.set_index('Pos', inplace=True)
        st.dataframe(final_table, use_container_width=True)
    else:
        st.warning("📡 Waiting for live position data stream...")
        empty_df = pd.DataFrame(columns=['No', 'Driver', 'Team', 'Tyre', 'Last Lap (s)'])
        empty_df.index.name = "Pos"
        st.dataframe(empty_df, use_container_width=True)

with col2:
    if not locations_df.empty and not drivers_df.empty:
        locations_df = pd.merge(locations_df, drivers_df[['driver_number', 'name_acronym', 'team_colour']], on='driver_number', how='left')
        
        st.markdown("### 🗺️ Track 2D Overview")
        fig2d = px.scatter(locations_df, x="x", y="y", text="name_acronym", color="name_acronym",
                           color_discrete_map={row['name_acronym']: f"#{row['team_colour']}" for _, row in locations_df.iterrows()})
        fig2d.update_traces(textposition='top center', marker=dict(size=12, line=dict(width=1, color='white')))
        fig2d.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='white',
                            xaxis=dict(visible=False), yaxis=dict(visible=False, scaleanchor="x", scaleratio=1),
                            showlegend=False, height=350, margin=dict(l=0, r=0, t=0, b=0))
        st.plotly_chart(fig2d, use_container_width=True)

        st.markdown("### ⛰️ Track Elevation Profile (3D)")
        # Map Z as elevation
        fig3d = go.Figure(data=[go.Scatter3d(
            x=locations_df['x'], y=locations_df['y'], z=locations_df['z'],
            mode='markers+text',
            text=locations_df['name_acronym'],
            marker=dict(size=8, color=[f"#{c}" if pd.notna(c) else "#FFFFFF" for c in locations_df['team_colour']],
                        line=dict(width=2, color='white'))
        )])
        fig3d.update_layout(
            scene=dict(
                xaxis_title='X', yaxis_title='Y', zaxis_title='Elevation (Z)',
                xaxis=dict(showbackground=False, visible=False),
                yaxis=dict(showbackground=False, visible=False),
                zaxis=dict(showbackground=False, visible=False)
            ),
            paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=0, r=0, b=0, t=0), height=350
        )
        st.plotly_chart(fig3d, use_container_width=True)
    else:
        st.warning("No location streaming available.")

st.caption(f"Last Refreshed: {datetime.datetime.now().strftime('%H:%M:%S')}")
