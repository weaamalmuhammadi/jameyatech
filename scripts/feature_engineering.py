"""
---------------------------------------------------------
Wakeel Al-Jamiya
Feature Engineering Pipeline
Author: Hajer Al-Dhafairi
---------------------------------------------------------
This script transforms the cleaned dataset into a
synthetic Jamiya dataset used by the AI Agents.

Pipeline:
Cleaned Dataset
        ↓
Feature Engineering
        ↓
Synthetic Jamiya Dataset
---------------------------------------------------------
"""

import pandas as pd
import numpy as np

# --------------------------------------------------
# Load cleaned dataset
# --------------------------------------------------

df = pd.read_csv("data/02_Cleaned_Dataset.csv")

# --------------------------------------------------
# Member ID
# --------------------------------------------------

df["Member_ID"] = range(1001, 1001 + len(df))

# --------------------------------------------------
# Monthly Salary
# --------------------------------------------------

df["Monthly_Salary"] = (
    df["Annual_Income"] / 12
).round().astype(int)

# --------------------------------------------------
# Salary Date
# --------------------------------------------------

salary_days = [25, 27, 28, 1]
probabilities = [0.15, 0.45, 0.30, 0.10]

df["Salary_Date"] = np.random.choice(
    salary_days,
    len(df),
    p=probabilities
)

# --------------------------------------------------
# Monthly Contribution
# --------------------------------------------------

contribution = (
    df["Monthly_Salary"] * 0.10
)

contribution = contribution.clip(
    lower=500,
    upper=3000
)

df["Monthly_Contribution"] = contribution.round().astype(int)

# --------------------------------------------------
# Membership Years
# --------------------------------------------------

df["Membership_Years"] = (
    df["Employment_Years"]
).round(1)

# --------------------------------------------------
# Payment Behaviour
# --------------------------------------------------

np.random.seed(42)

df["On_Time_Payments"] = np.random.randint(
    10,
    25,
    len(df)
)

df["Late_Payments"] = np.random.randint(
    0,
    5,
    len(df)
)

df["Missed_Payments"] = np.random.randint(
    0,
    2,
    len(df)
)

# --------------------------------------------------
# Previous Default
# --------------------------------------------------

df["Previous_Default"] = (
    df["Previous_Default"]
        .map({1: "Yes", 0: "No"})
)

# --------------------------------------------------
# Trust Score
# --------------------------------------------------

grade_score = {
    "A": 25,
    "B": 20,
    "C": 15,
    "D": 10,
    "E": 5,
    "F": 0
}

df["Trust_Score"] = (

    40

    + df["Credit_Grade"].map(grade_score)

    + (df["Membership_Years"] * 3)

    - (df["Late_Payments"] * 4)

    - (df["Missed_Payments"] * 12)

)

df.loc[
    df["Previous_Default"] == "Yes",
    "Trust_Score"
] -= 15

df["Trust_Score"] = (
    df["Trust_Score"]
        .clip(0,100)
        .round()
        .astype(int)
)

# --------------------------------------------------
# Risk Label
# --------------------------------------------------

conditions = [

    df["Trust_Score"] >= 80,

    df["Trust_Score"] >= 60,

    df["Trust_Score"] < 60

]

choices = [

    "Green",

    "Yellow",

    "Red"

]

df["Risk_Label"] = np.select(
    conditions,
    choices,
    default="Yellow"
)

# --------------------------------------------------
# Turn Eligibility
# --------------------------------------------------

df["Eligible_For_Turn"] = np.where(

    df["Risk_Label"] == "Red",

    "No",

    "Yes"

)

# --------------------------------------------------
# Current Turn
# --------------------------------------------------

eligible = (
    df[df["Eligible_For_Turn"] == "Yes"]
        .sort_values(
            by=[
                "Trust_Score",
                "Membership_Years"
            ],
            ascending=False
        )
)

eligible["Current_Turn"] = range(
    1,
    len(eligible)+1
)

df = df.merge(

    eligible[["Member_ID","Current_Turn"]],

    on="Member_ID",

    how="left"

)

# --------------------------------------------------
# Keep Final Columns
# --------------------------------------------------

final_columns = [

    "Member_ID",

    "Monthly_Salary",

    "Salary_Date",

    "Monthly_Contribution",

    "Membership_Years",

    "On_Time_Payments",

    "Late_Payments",

    "Missed_Payments",

    "Previous_Default",

    "Trust_Score",

    "Risk_Label",

    "Eligible_For_Turn",

    "Current_Turn"

]

final_df = df[final_columns]

# --------------------------------------------------
# Save
# --------------------------------------------------

final_df.to_csv(

    "data/03_Synthetic_Jamiya_Dataset.csv",

    index=False

)

print("="*50)
print("Feature Engineering Completed Successfully")
print("="*50)
print(final_df.head())
print("="*50)
print("Dataset Shape:", final_df.shape)
print("="*50)