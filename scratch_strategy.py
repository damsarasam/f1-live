import fastf1
import pandas as pd

fastf1.Cache.enable_cache('ff1_cache')

current_gp = "Bahrain Grand Prix"
years_to_check = [2023, 2024]

strategies = []

for y in years_to_check:
    print(f"Loading {y} {current_gp}...")
    try:
        session = fastf1.get_session(y, current_gp, 'R')
        session.load(telemetry=False, weather=False, messages=False) # Only need laps/results
        
        laps = session.laps
        results = session.results
        
        # Get top 3 finishers for strategy
        top_3 = results['Abbreviation'].head(3).tolist()
        
        for driver in top_3:
            d_laps = laps.pick_driver(driver)
            stints = d_laps[['Stint', 'Compound', 'LapNumber']].groupby(['Stint', 'Compound']).count().reset_index()
            strategy_str = " -> ".join(stints['Compound'].dropna().astype(str).tolist())
            strategies.append({"Year": y, "Driver": driver, "Position": top_3.index(driver)+1, "Strategy": strategy_str})
    except Exception as e:
        print(f"Failed to load {y}: {e}")

print(pd.DataFrame(strategies))
