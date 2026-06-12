# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base
from app.models.user import User
from app.models.hr import Department, Employee, Absence, Document
from app.models.system import OnboardingTask, OffboardingTask, AuditLog, AiInteractionLog, Alert
