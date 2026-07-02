import pandas as pd

df = pd.read_csv("data/02_Cleaned_Dataset.csv")

print("="*40)
print("Dataset Shape")
print(df.shape)

print("="*40)
print("Missing Values")
print(df.isnull().sum())

print("="*40)
print("Duplicate Rows")
print(df.duplicated().sum())

print("="*40)
print("Data Types")
print(df.dtypes)

print("="*40)
print("Summary Statistics")
print(df.describe())