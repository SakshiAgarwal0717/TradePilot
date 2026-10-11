def test_app_import():
    from app.main import app
    assert app.title == "TradePilot API"
