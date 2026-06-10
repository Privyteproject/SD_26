import requests
import json
import uuid

BASE_URL = "http://localhost:8000/api/v1"
HEADERS = {
    "Authorization": "Bearer dev-rh-token",
    "Content-Type": "application/json"
}

def print_result(name, res):
    print(f"--- {name} ---")
    print(f"Status: {res.status_code}")
    try:
        print(json.dumps(res.json(), indent=2))
    except Exception:
        print(res.text)
    print("\n")

def run_tests():
    print("Testing Backend Endpoints...\n")
    
    # 1. List Employees
    res = requests.get(f"{BASE_URL}/employees", headers=HEADERS)
    print_result("GET /employees", res)
    
    # 2. Create Employee
    # Using a fake CIN with UUID to avoid uniqueness collisions on repeated runs
    fake_cin = f"CIN-{str(uuid.uuid4())[:8]}"
    emp_payload = {
        "first_name": "Test",
        "last_name": "Employee",
        "email": f"test.{fake_cin}@synapse.com",
        "cin": fake_cin,
        "phone": "0600000000",
        "status": "actif"
    }
    res = requests.post(f"{BASE_URL}/employees", headers=HEADERS, json=emp_payload)
    print_result("POST /employees", res)
    
    emp_id = None
    if res.status_code == 201:
        emp_id = res.json().get("data", {}).get("id")
        
    # 3. List Absences
    res = requests.get(f"{BASE_URL}/absences", headers=HEADERS)
    print_result("GET /absences", res)
    
    # 4. Create Absence if Employee created successfully
    if emp_id:
        abs_payload = {
            "employee_id": emp_id,
            "type": "maladie",
            "start_date": "2026-06-15",
            "end_date": "2026-06-16",
            "reason": "Fièvre"
        }
        res = requests.post(f"{BASE_URL}/absences", headers=HEADERS, json=abs_payload)
        print_result("POST /absences", res)

if __name__ == "__main__":
    run_tests()
