"""Add salary, address and CIN to Employee

Revision ID: ba74388674b9
Revises: cc7cfb50b1c4
Create Date: 2026-06-04 11:10:53.661115

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba74388674b9'
down_revision: Union[str, Sequence[str], None] = 'cc7cfb50b1c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('employees', sa.Column('salary', sa.Float(), nullable=True))
    op.add_column('employees', sa.Column('address', sa.String(), nullable=True))
    op.add_column('employees', sa.Column('cin', sa.String(), nullable=True))
    op.create_unique_constraint('uq_employees_cin', 'employees', ['cin'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_employees_cin', 'employees', type_='unique')
    op.drop_column('employees', 'cin')
    op.drop_column('employees', 'address')
    op.drop_column('employees', 'salary')
