import streamlit as st
import os

try:
    import pandas as pd
    import fastf1
except ImportError as e:
    st.error(f"Missing dependency: {e}")
    st.warning("🚨 **You are running Streamlit outside of the virtual environment!**\n\nPlease stop the terminal (Ctrl+C) and restart the app with:\n\n`source venv/bin/activate && streamlit run main.py`")
    st.stop()
    
import ui_theme

ui_theme.apply_theme()

if not os.path.exists('ff1_cache'):
    os.makedirs('ff1_cache')
fastf1.Cache.enable_cache('ff1_cache')

st.title("🔮 Historical Strategy Predictions")
st.markdown("Predict optimal race strategies by analyzing stint lengths and tyre compounds from the top finishers of previous years.")

st.sidebar.header("Select Track")
year = st.sidebar.number_input("Target Year", min_value=2018, max_value=2026, value=2025)

@st.cache_data
def get_event_schedule(year):
    schedule = fastf1.get_event_schedule(year)
    events = schedule[schedule['RoundNumber'] > 0]
    return events['EventName'].tolist()

events_for_year = get_event_schedule(year)
gp = st.sidebar.selectbox("Grand Prix", events_for_year, index=0 if len(events_for_year) > 0 else 0)

if st.sidebar.button("Generate Predictions"):
    with st.spinner("Analyzing past 3 years of race telemetry data..."):
        try:
            years_to_analyze = [year - 1, year - 2, year - 3]
            historical_strategies = []
            
            for y in years_to_analyze:
                try:
                    # Try to silently fetch past session data
                    past_session = fastf1.get_session(y, gp, 'R')
                    past_session.load(telemetry=False, weather=False, messages=False)
                    
                    results = past_session.results
                    laps = past_session.laps
                    
                    # Analyze top 5 finishers to account for multiple strategies
                    top_5 = results['Abbreviation'].dropna().head(5).tolist()
                    for driver in top_5:
                        d_laps = laps.pick_driver(driver)
                        if not d_laps.empty:
                            stints = d_laps[['Stint', 'Compound', 'LapNumber']].groupby(['Stint', 'Compound']).count().reset_index()
                            stints = stints.sort_values(by='Stint')
                            strategy_arr = stints['Compound'].dropna().astype(str).tolist()
                            strategy_str = " ➔ ".join(strategy_arr)
                            historical_strategies.append({
                                "Year": y, 
                                "Driver": driver, 
                                "Pos": top_5.index(driver) + 1, 
                                "Strategy": strategy_str,
                                "Stints (Laps)": " ➔ ".join(stints['LapNumber'].astype(str).tolist()),
                                "Total Laps": stints['LapNumber'].sum()
                            })
                except Exception as e:
                    # Pass if we can't get data for that specific year
                    pass
                    
            if historical_strategies:
                strat_df = pd.DataFrame(historical_strategies)
                st.table(strat_df.sort_values(by=['Year', 'Pos'], ascending=[False, True]))
                
                # Find the most common strategy
                st.markdown("### Most Successful Strategies")
                common = strat_df['Strategy'].value_counts()
                for strat, count in common.items():
                    st.success(f"🏎️ **{strat}** (Used {count} times by top 5 finishers)")
            else:
                st.warning("Could not find enough historical data for this track to generate predictions. Note that some tracks are new to the calendar or were skipped in past years.")
                
        except Exception as e:
            st.error(f"Error predicting strategies: {e}")
else:
    st.info("👈 Please select a Grand Prix in the sidebar and click **Generate Predictions**.")
