"""Initial schema

Revision ID: 202606180001
Revises: 
Create Date: 2026-06-18 21:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '202606180001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get dialect
    dialect = op.get_bind().dialect.name
    
    # 1. Create enum types if postgresql
    if dialect == 'postgresql':
        op.execute("CREATE TYPE plan_enum AS ENUM ('free', 'pro', 'enterprise')")
        op.execute("CREATE TYPE role_enum AS ENUM ('admin', 'analyst', 'viewer')")
        op.execute("CREATE TYPE db_type_enum AS ENUM ('postgresql', 'mysql')")
        op.execute("CREATE TYPE chat_role_enum AS ENUM ('user', 'assistant')")
        
        plan_enum_type = sa.Enum('free', 'pro', 'enterprise', name='plan_enum')
        role_enum_type = sa.Enum('admin', 'analyst', 'viewer', name='role_enum')
        db_type_enum_type = sa.Enum('postgresql', 'mysql', name='db_type_enum')
        chat_role_enum_type = sa.Enum('user', 'assistant', name='chat_role_enum')
    else:
        plan_enum_type = sa.String(50)
        role_enum_type = sa.String(50)
        db_type_enum_type = sa.String(50)
        chat_role_enum_type = sa.String(50)

    # 2. Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('plan', plan_enum_type, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', role_enum_type, nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # 4. Create database_connections table
    op.create_table(
        'database_connections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('db_type', db_type_enum_type, nullable=False),
        sa.Column('host_encrypted', sa.LargeBinary(), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False),
        sa.Column('database_name', sa.String(length=255), nullable=False),
        sa.Column('username_encrypted', sa.LargeBinary(), nullable=False),
        sa.Column('password_encrypted', sa.LargeBinary(), nullable=False),
        sa.Column('iv', sa.LargeBinary(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_tested_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. Create schema_metadata table
    op.create_table(
        'schema_metadata',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('connection_id', sa.UUID(), nullable=False),
        sa.Column('table_name', sa.String(length=255), nullable=False),
        sa.Column('column_name', sa.String(length=255), nullable=False),
        sa.Column('data_type', sa.String(length=100), nullable=False),
        sa.Column('is_pk', sa.Boolean(), nullable=False),
        sa.Column('is_fk', sa.Boolean(), nullable=False),
        sa.Column('ref_table', sa.String(length=255), nullable=True),
        sa.Column('ref_column', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['connection_id'], ['database_connections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_schema_metadata_table_name', 'schema_metadata', ['table_name'], unique=False)

    # 6. Create query_history table
    op.create_table(
        'query_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('connection_id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('natural_language', sa.Text(), nullable=False),
        sa.Column('generated_sql', sa.Text(), nullable=False),
        sa.Column('optimized_sql', sa.Text(), nullable=False),
        sa.Column('optimization_report', sa.JSON(), nullable=False),
        sa.Column('execution_time_ms', sa.Integer(), nullable=False),
        sa.Column('row_count', sa.Integer(), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['connection_id'], ['database_connections.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_query_history_session_id', 'query_history', ['session_id'], unique=False)

    # 7. Create conversation_history table
    op.create_table(
        'conversation_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role', chat_role_enum_type, nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('sql_generated', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_conversation_history_session_id', 'conversation_history', ['session_id'], unique=False)

    # 8. Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('connection_id', sa.UUID(), nullable=True),
        sa.Column('sql_hash', sa.String(length=64), nullable=False),
        sa.Column('sql_preview', sa.String(length=200), nullable=False),
        sa.Column('execution_time_ms', sa.Integer(), nullable=False),
        sa.Column('row_count', sa.Integer(), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['connection_id'], ['database_connections.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    dialect = op.get_bind().dialect.name

    op.drop_table('audit_logs')
    
    op.drop_index('ix_conversation_history_session_id', table_name='conversation_history')
    op.drop_table('conversation_history')
    
    op.drop_index('ix_query_history_session_id', table_name='query_history')
    op.drop_table('query_history')
    
    op.drop_index('ix_schema_metadata_table_name', table_name='schema_metadata')
    op.drop_table('schema_metadata')
    
    op.drop_table('database_connections')
    
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
    
    op.drop_table('organizations')

    if dialect == 'postgresql':
        op.execute("DROP TYPE chat_role_enum")
        op.execute("DROP TYPE db_type_enum")
        op.execute("DROP TYPE role_enum")
        op.execute("DROP TYPE plan_enum")
