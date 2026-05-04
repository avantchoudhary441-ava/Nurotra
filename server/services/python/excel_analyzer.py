import pandas as pd
import numpy as np
import io

def analyze_excel_buffer(buffer_data):
    try:
        # Load the spreadsheet (assuming it's a binary buffer)
        # In a real scenario, this might be a file path or a bytes stream
        df = pd.read_excel(io.BytesIO(buffer_data))
        return analyze_dataframe(df)
    except Exception as e:
        return {"error": str(e)}

def analyze_dataframe(df):
    if df.empty:
        return {"error": "Empty dataframe"}
    
    # 1. Basic properties
    info = {
        "columns": list(df.columns),
        "num_rows": len(df),
        "num_cols": len(df.columns),
        "sheets_detected": 1 # Simplified for single-df
    }
    
    # 2. Identify numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    
    # 3. Statistical analysis
    stats = {}
    for col in numeric_cols:
        col_stats = {
            "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None,
            "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
            "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
            "std": float(df[col].std()) if not pd.isna(df[col].std()) else None,
            "sum": float(df[col].sum()) if not pd.isna(df[col].sum()) else None
        }
        stats[col] = col_stats
        
    # 4. Trend detection (if there's a plausible time-series column)
    trends = []
    # Simple check for 'year' or 'date' in columns
    time_series_col = next((c for c in categorical_cols + numeric_cols if 
                           any(x in c.lower() for x in ['year', 'date', 'month', 'quarter'])), None)
    
    if time_series_col and numeric_cols:
        try:
            # Sort by time-series col
            df_sorted = df.sort_values(by=time_series_col)
            for col in numeric_cols:
                if col != time_series_col:
                    first_val = df_sorted[col].iloc[0]
                    last_val = df_sorted[col].iloc[-1]
                    if first_val != 0:
                        change_pct = ((last_val - first_val) / abs(first_val)) * 100
                        trend_type = "Growth" if change_pct > 0 else "Decline"
                        trends.append(f"{col} showed {trend_type} of {change_pct:.2f}% from {df_sorted[time_series_col].iloc[0]} to {df_sorted[time_series_col].iloc[-1]}.")
        except:
            pass
            
    # 5. Anomaly detection (Z-score approach)
    anomalies = []
    for col in numeric_cols:
        if stats[col]["std"] > 0:
            z_scores = (df[col] - stats[col]["mean"]) / stats[col]["std"]
            outliers = df[np.abs(z_scores) > 3]
            if not outliers.empty:
                anomalies.append(f"Detected {len(outliers)} anomalies/outliers in {col} column.")

    # 6. Dominant entities
    dominants = []
    for col in categorical_cols:
        if df[col].nunique() < len(df):
            top_val = df[col].value_counts().idxmax()
            top_pct = (df[col].value_counts().max() / len(df)) * 100
            if top_pct > 30: # If one value dominates more than 30%
                dominants.append(f"'{top_val}' dominates '{col}' column ({top_pct:.1f}% frequency).")

    return {
        "info": info,
        "numeric_stats": stats,
        "trends": trends,
        "anomalies": anomalies,
        "dominant_insights": dominants,
        "summary": f"Dataset with {len(df)} rows and {len(df.columns)} columns analyzed."
    }

if __name__ == "__main__":
    # Test with mockup data
    data = {
        'Year': [2018, 2019, 2020, 2021, 2022],
        'Sales': [100, 150, 400, 450, 900],
        'Company': ['Tesla', 'Tesla', 'Tesla', 'BYD', 'BYD']
    }
    df = pd.DataFrame(data)
    print(analyze_dataframe(df))
