"""Script to generate mock CSV files for bulk importing HR data."""

import csv
import random
from datetime import date, timedelta
import os

def generate_data():
    num_employees = 50
    
    employees = []
    absences = []
    
    first_names = ["Arush", "Sarah", "Mohamed", "Fatima", "Youssef", "Imane", "Mehdi", "Khadija", "Omar", "Amina", "Amine", "Nawal", "Karim", "Salma", "Hassan"]
    last_names = ["Ramisami", "Alaoui", "Bennani", "El Fassi", "Tazi", "Chraibi", "Bennis", "El Amrani", "Guessous", "Lahlou"]
    positions = ["Développeur", "Manager", "Analyste", "Consultant", "Directeur"]
    
    # Generate Employees
    cins = []
    for i in range(1, num_employees + 1):
        cin = f"AB{100000 + i}"
        cins.append(cin)
        hire_date = date.today() - timedelta(days=random.randint(100, 2000))
        
        emp = {
            "first_name": random.choice(first_names),
            "last_name": random.choice(last_names),
            "position": random.choice(positions),
            "hire_date": hire_date.isoformat(),
            "status": "active",
            "salary": random.randint(8000, 30000),
            "address": "Casablanca, Maroc",
            "cin": cin
        }
        employees.append(emp)
        
    # Generate Absences (injecting risks for the disengagement algorithm)
    for i, cin in enumerate(cins):
        # 20% of employees have risky behavior (disengagement candidates)
        is_risky = (i % 5 == 0)
        
        if is_risky:
            # Generate 3-5 sudden short absences
            for _ in range(random.randint(3, 5)):
                start = date.today() - timedelta(days=random.randint(1, 30))
                absences.append({
                    "cin": cin,
                    "type": "absence_injustifiee",
                    "start_date": start.isoformat(),
                    "end_date": (start + timedelta(days=1)).isoformat(),
                    "status": "approved"
                })
        else:
            # Normal employees (0-1 normal absence like annual leave or sickness)
            if random.random() > 0.5:
                start = date.today() - timedelta(days=random.randint(30, 180))
                absences.append({
                    "cin": cin,
                    "type": "conge_maladie",
                    "start_date": start.isoformat(),
                    "end_date": (start + timedelta(days=3)).isoformat(),
                    "status": "approved"
                })

    with open("mock_employees.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=employees[0].keys())
        writer.writeheader()
        writer.writerows(employees)
        
    if absences:
        with open("mock_absences.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=absences[0].keys())
            writer.writeheader()
            writer.writerows(absences)
            
    print(f"Successfully generated mock_employees.csv ({len(employees)} rows) and mock_absences.csv ({len(absences)} rows).")

if __name__ == "__main__":
    generate_data()
