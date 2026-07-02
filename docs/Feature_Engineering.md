# Feature Engineering

## Overview

This document describes the feature engineering process used to transform the cleaned dataset into a synthetic Jamiya dataset suitable for AI-powered decision making.

The engineered features were designed to simulate realistic member behavior while supporting the project's AI agents.

---

# Pipeline

```
Raw Dataset
      ↓
Data Cleaning
      ↓
Feature Engineering
      ↓
Synthetic Jamiya Dataset
      ↓
AI Agents
```

---

# Engineered Features

## 1. Monthly Salary

**Source**

Annual_Income

**Transformation**

Monthly_Salary = Annual_Income / 12

**Purpose**

Represents each member's estimated monthly income and is used for contribution planning and risk assessment.

---

## 2. Salary Date

**Generation Method**

Synthetic values generated based on common salary payment dates in Saudi Arabia.

Possible values:

- 1
- 25
- 27
- 28

**Purpose**

Used by the Turn Agent to determine the most suitable collection schedule.

---

## 3. Monthly Contribution

**Formula**

Approximately 10% of Monthly Salary.

Values are constrained between:

- Minimum: 500 SAR
- Maximum: 3000 SAR

**Purpose**

Represents the expected monthly payment to the Jamiya.

---

## 4. Membership Years

**Source**

Employment_Years

**Purpose**

Represents the member's estimated participation duration and contributes to the Trust Score.

---

## 5. Payment Behaviour

Three behavioural indicators were generated:

- On_Time_Payments
- Late_Payments
- Missed_Payments

These indicators simulate historical payment performance.

---

## 6. Previous Default

Derived from the original credit dataset.

Values:

- Yes
- No

This feature has a direct impact on the Trust Score.

---

## 7. Trust Score

The Trust Score is a composite indicator ranging from **0 to 100**.

It is calculated using multiple factors:

- Credit Grade
- Membership Years
- Previous Default
- Late Payments
- Missed Payments

Higher scores indicate more reliable members.

---

## 8. Risk Label

Members are automatically classified into three categories:

| Trust Score | Risk Label |
|-------------|-----------|
| 80–100 | Green |
| 60–79 | Yellow |
| 0–59 | Red |

This feature is consumed directly by the Risk Agent.

---

## 9. Eligible for Turn

Members are evaluated for turn eligibility.

Rules:

- Green → Eligible
- Yellow → Eligible
- Red → Not Eligible

---

## 10. Current Turn

Eligible members are ranked according to:

1. Trust Score
2. Membership Years

The resulting order is consumed by the Turn Agent.

---

# Output Dataset

The final engineered dataset contains the following fields:

- Member_ID
- Monthly_Salary
- Salary_Date
- Monthly_Contribution
- Membership_Years
- On_Time_Payments
- Late_Payments
- Missed_Payments
- Previous_Default
- Trust_Score
- Risk_Label
- Eligible_For_Turn
- Current_Turn

---

# Purpose

The engineered dataset serves as the primary data source for all AI agents within the Wakeel Al-Jamiya platform.

It enables:

- Risk Assessment
- Turn Prioritization
- Contribution Planning
- Conflict Resolution

while maintaining a structured and reproducible data pipeline.