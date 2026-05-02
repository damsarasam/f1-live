import streamlit as st
import os

try:
    import fastf1
    import fastf1.plotting
    import pandas as pd
    import matplotlib.pyplot as plt
except ImportError as e:
    st.error(f"Missing dependency: {e}")
    st.warning("🚨 **You are running Streamlit outside of the virtual environment!**\n\nPlease stop the terminal (Ctrl+C) and restart the app with:\n\n`source venv/bin/activate && streamlit run main.py`")
    st.stop()

# Setup caching and plotting
if not os.path.exists('ff1_cache'):
    os.makedirs('ff1_cache')
fastf1.Cache.enable_cache('ff1_cache')
fastf1.plotting.setup_mpl(misc_mpl_mods=False)

st.set_page_config(page_title="F1 Data Explorer", layout="wide", initial_sidebar_state="expanded")

st.title("Formula 1 Data Explorer")
st.markdown("Explore comprehensive telemetry, track maps, and timing data using `fastf1`.")

st.sidebar.header("Select Session")
year = st.sidebar.number_input("Year", min_value=2018, max_value=2026, value=2025)

@st.cache_data
def get_event_schedule(year):
    schedule = fastf1.get_event_schedule(year)
    # Filter out testing sessions (usually round 0)
    events = schedule[schedule['RoundNumber'] > 0]
    return events['EventName'].tolist()

events_for_year = get_event_schedule(year)

gp = st.sidebar.selectbox("Grand Prix", events_for_year, index=0 if len(events_for_year) > 0 else 0)
session_type = st.sidebar.selectbox("Session", ["FP1", "FP2", "FP3", "Q", "S", "SQ", "R"], index=6)

@st.cache_resource(show_spinner=False)
def load_session(year, gp, type):
    session = fastf1.get_session(year, gp, type)
    session.load()
    return session

if st.sidebar.button("Load Data"):
    loading_placeholder = st.empty()
    with loading_placeholder.container():
        st.markdown("<h1 style='text-align: center; margin-top: 25vh;'>Warming up the tyres...</h1>", unsafe_allow_html=True)
        st.markdown("<h3 style='text-align: center; color: #888;'>Fetching massive FastF1 Telemetry Datasets. This may take a minute!</h3>", unsafe_allow_html=True)
        
        try:
            session = load_session(year, gp, session_type)
            st.session_state['f1_session'] = session
            st.sidebar.success("Loaded successfully!")
        except Exception as e:
            st.error(f"Error loading session: {e}")
    
    # After loading finishes, wipe the loading screen
    loading_placeholder.empty()

if 'f1_session' in st.session_state:
    session = st.session_state['f1_session']
    st.header(f"{session.event['EventName']} - {session.name} ({year})")
    
    col1, col2 = st.columns([3, 1])
    with col2:
        if st.button("🏁 Launch 3D Race Replay", use_container_width=True):
            import subprocess
            
            # Map Streamlit session type to f1-race-replay arguments
            cmd_args = ["python", "ref-app/main.py", "--viewer", "--year", str(year), "--round", str(session.event['RoundNumber'])]
            
            if session_type == 'Q':
                cmd_args.append("--qualifying")
            elif session_type == 'S':
                cmd_args.append("--sprint")
            elif session_type == 'SQ':
                cmd_args.append("--sprint-qualifying")
                
            with st.spinner("Launching 3D Replay Window..."):
                try:
                    subprocess.Popen(cmd_args, cwd=os.path.dirname(os.path.abspath(__file__)))
                    st.success("Replay launched in a separate window!")
                except Exception as e:
                    st.error(f"Failed to launch replay: {e}")
    
    tab1, tab2, tab3, tab4 = st.tabs(["Track & Laps", "Rankings", "Tyre Strategies", "Lap Comparisons"])
    
    with tab1:
        st.subheader("Fastest Lap Track Visualization")
        try:
            fastest_lap = session.laps.pick_fastest()
            driver_name = fastest_lap['Driver']
            tel = fastest_lap.get_telemetry()
            
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.plot(tel['X'], tel['Y'], color='white', linewidth=3, label=f'{driver_name} Fastest Lap')
            ax.set_facecolor('#0A0B0E')
            fig.patch.set_facecolor('#0A0B0E')
            ax.axis('off')
            ax.set_title(f"Track map generated from {driver_name}'s fastest lap", color='white')
            st.pyplot(fig)
        except Exception as e:
            st.error(f"Could not load track viz: {e}")
            
    with tab2:
        st.subheader("Session Results")
        try:
            results = session.results.copy()
            
            # Format elapsed time natively for readability
            if 'Time' in results.columns:
                def format_timedelta(td):
                    if pd.isna(td):
                        return ""
                    total_seconds = td.total_seconds()
                    hours, remainder = divmod(total_seconds, 3600)
                    minutes, seconds = divmod(remainder, 60)
                    
                    if hours > 0:
                        return f"{int(hours)}:{int(minutes):02d}:{seconds:06.3f}"
                    else:
                        return f"{int(minutes)}:{seconds:06.3f}"
                
                results['Time'] = results['Time'].apply(format_timedelta)
                
            cols = ['Position', 'DriverNumber', 'Abbreviation', 'FullName', 'TeamName', 'Time', 'Status', 'Points']
            available = [c for c in cols if c in results.columns]
            st.table(results[available])
        except Exception as e:
            st.error(f"Could not load rankings: {e}")
            
    with tab3:
        st.subheader("Tyre Strategies")
        st.markdown("Visualizing the tyre usage throughout the session.")
        try:
            laps = session.laps
            drivers = session.results['Abbreviation'].dropna().tolist()
            
            stints = laps[['Driver', 'Stint', 'Compound', 'LapNumber']].groupby(['Driver', 'Stint', 'Compound']).count().reset_index()
            stints = stints.rename(columns={'LapNumber': 'StintLength'})
            
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.set_facecolor('#0A0B0E')
            fig.patch.set_facecolor('#0A0B0E')
            ax.tick_params(axis='x', colors='white')
            ax.tick_params(axis='y', colors='white')
            ax.set_xlabel("Lap Number", color='white')
            
            for driver in drivers:
                driver_stints = stints.loc[stints['Driver'] == driver]
                previous_stint_end = 0
                for idx, row in driver_stints.iterrows():
                    try:
                        c_color = fastf1.plotting.get_compound_color(row['Compound'], session=session)
                    except:
                        c_color = 'gray'
                        
                    ax.barh(driver, row['StintLength'], left=previous_stint_end, color=c_color, edgecolor="black")
                    previous_stint_end += row['StintLength']
                    
            ax.invert_yaxis()
            ax.spines['bottom'].set_color('white')
            ax.spines['left'].set_color('white')
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            
            # Create a legend for the tyre compounds
            import matplotlib.patches as mpatches
            handles = []
            for comp in stints['Compound'].dropna().unique():
                try:
                    c_color = fastf1.plotting.get_compound_color(comp, session=session)
                except:
                    c_color = 'gray'
                handles.append(mpatches.Patch(color=c_color, label=comp))
            
            if handles:
                leg = ax.legend(handles=handles, title="Compounds", bbox_to_anchor=(1.05, 1), loc='upper left', facecolor='#0A0B0E', edgecolor='white', labelcolor='white')
                plt.setp(leg.get_title(), color='white')
            
            st.pyplot(fig)
        except Exception as e:
            st.error(f"Could not load tyre strategy: {e}")
            
    with tab4:
        st.subheader("Telemetry Comparison")
        st.markdown("Compare the speed of two drivers over their fastest lap.")
        try:
            drivers = session.results['Abbreviation'].dropna().tolist()
            col1, col2 = st.columns(2)
            d1 = col1.selectbox("Driver 1", drivers, index=0)
            d2 = col2.selectbox("Driver 2", drivers, index=1 if len(drivers)>1 else 0)
            
            if st.button("Generate Comparison"):
                lap1 = session.laps.pick_driver(d1).pick_fastest()
                lap2 = session.laps.pick_driver(d2).pick_fastest()
                
                tel1 = lap1.get_car_data().add_distance()
                tel2 = lap2.get_car_data().add_distance()
                
                fig, ax = plt.subplots(figsize=(12, 5))
                ax.set_facecolor('#0A0B0E')
                fig.patch.set_facecolor('#0A0B0E')
                
                try:
                    c1 = fastf1.plotting.driver_color(d1)
                except:
                    c1 = 'blue'
                try:
                    c2 = fastf1.plotting.driver_color(d2)
                except:
                    c2 = 'red'
                    
                ax.plot(tel1['Distance'], tel1['Speed'], label=f"{d1}", color=c1)
                ax.plot(tel2['Distance'], tel2['Speed'], label=f"{d2}", color=c2)
                
                ax.set_xlabel("Distance (m)", color='white')
                ax.set_ylabel("Speed (km/h)", color='white')
                ax.tick_params(axis='both', colors='white')
                ax.spines['bottom'].set_color('white')
                ax.spines['left'].set_color('white')
                ax.spines['top'].set_visible(False)
                ax.spines['right'].set_visible(False)
                ax.legend(facecolor='#0A0B0E', edgecolor='white', labelcolor='white')
                
                st.pyplot(fig)
                
        except Exception as e:
            st.error(f"Could not generate comparison: {e}")



else:
    st.info("👈 Please configure your session in the sidebar and click **Load Data**.")
