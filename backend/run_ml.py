from app.db.session import SessionLocal
from app.services.ml_predictions import batch_score

db = SessionLocal()
try:
    res = batch_score(db)
    print("Batch score done:", res)
finally:
    db.close()
