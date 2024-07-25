@echo off
echo Creating virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install flask elasticsearch unidecode

echo Initializing Elasticsearch indices...
python init_db.py

echo Setup complete. You can now run start_server.bat to start the server.
pause