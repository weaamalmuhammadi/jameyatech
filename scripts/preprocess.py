import pandas as pd

raw = pd.read_csv("data/01_Raw_Credit_Dataset.csv")

df = raw.drop_duplicates().copy()

for col in df.columns:
    if df[col].dtype.kind in "biufc":
        df[col] = df[col].fillna(df[col].median())
    else:
        m = df[col].mode()
        if not m.empty:
            df[col] = df[col].fillna(m.iloc[0])

df = df.rename(columns={
    "person_age":"Age",
    "person_income":"Annual_Income",
    "person_home_ownership":"Home_Ownership",
    "person_emp_length":"Employment_Years",
    "loan_intent":"Loan_Purpose",
    "loan_grade":"Credit_Grade",
    "loan_amnt":"Loan_Amount",
    "loan_int_rate":"Interest_Rate",
    "loan_status":"Loan_Status",
    "loan_percent_income":"Loan_Percent_Income",
    "cb_person_default_on_file":"Previous_Default",
    "cb_person_cred_hist_length":"Credit_History_Years"
})

df.to_csv("data/02_Cleaned_Dataset.csv", index=False)

print("Cleaning completed.")
print("Shape:", df.shape)
print("Missing Values:")
print(df.isnull().sum())
print("Duplicates:", df.duplicated().sum())
