"""Application configuration via Pydantic Settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Machine Monitoring Dashboard"
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./machine_monitor.db"
    collector_interval_default: int = 5
    offline_threshold: int = 3
    modbus_default_port: int = 502

    # Modbus simulator ports to avoid system port conflicts
    simulator_base_port: int = 5020

    ws_ping_interval: int = 30
    ws_ping_timeout: int = 10

    model_config = {"env_prefix": "MMD_", "env_file": ".env"}


settings = Settings()
